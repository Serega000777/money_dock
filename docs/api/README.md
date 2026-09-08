# API

Формальный OpenAPI/Swagger подключится, когда поверхность станет достаточно большой,
чтобы ручное поддержание этого файла стало обузой. Пока — ручное описание, растёт вместе
с модулями.

Все эндпоинты кроме `/health` и `/auth/*` требуют `Authorization: Bearer <accessToken>`.
Access-токен живёт 15 минут; когда истёк — `POST /auth/refresh`.

Ошибки — единый конверт `{ code, message, correlationId, details? }` (см.
`apps/api/src/common/http-exception.filter.ts`); `correlationId` также приходит с любым
ответом в заголовке `x-correlation-id` (эхо клиентского значения, если он его прислал).

## `GET /health`

```json
{ "status": "ok", "db": "ok" }
```

## Auth (Stage 1)

### `POST /auth/telegram`

Тело: `{ "initData": string }` — сырая строка `initData` из `window.Telegram.WebApp`.
Сервер проверяет HMAC-подпись и свежесть `auth_date` (ADR 0006), при первом входе создаёт
`users` + `user_identities`, при повторном — переиспользует существующего пользователя.

```json
{ "user": { "id": "...", "displayName": "...", "baseCurrency": "RUB", ... },
  "accessToken": "...", "refreshToken": "..." }
```

401, если подпись неверна или `auth_date` протух (> 24ч) или из будущего.

### `POST /auth/refresh`

Тело: `{ "refreshToken": string }`. Ротирует токен: старая сессия отзывается, выдаётся
новая пара. Повторное использование уже отозванного `refreshToken` → 401.

### `POST /auth/logout`

Тело: `{ "refreshToken": string }`. Отзывает сессию. `204 No Content`.

Все три эндпоинта ограничены rate-limit'ом (20 запросов/60с на IP).

## Users

### `GET /users/me`

Профиль текущего пользователя.

### `DELETE /users/me`

Удаляет аккаунт безвозвратно — `onDelete: cascade` уносит все счета, операции, заметки,
правила категоризации, сессии и т.д. `204 No Content`. Пишет `audit_logs`
(`account.delete`) и структурированный лог до удаления — сама запись в `audit_logs`
каскадно удаляется вместе с пользователем, так что переживает удаление только серверный
лог (известное ограничение MVP, см. ТЗ §11 про grace period).

## Accounts

Все операции скоуплены владельцем — чужой `id` возвращает `404`, не `403` (не палим
существование чужих данных).

- `GET /accounts` — список неархивных счетов, каждый с `currentBalanceMinor` (Stage 2:
  `initialBalanceMinor` + сумма связанных операций, считается в БД).
- `POST /accounts` — `{ type, name, currency, initialBalanceMinor }`.
- `GET /accounts/:id`
- `PATCH /accounts/:id` — частичное обновление.
- `DELETE /accounts/:id` — мягкое удаление (`archived_at`).

## Categories

- `GET /categories` — системные (общие) + свои кастомные.
- `POST /categories` — `{ type, name, parentId?, icon? }`.
- `DELETE /categories/:id` — только свои кастомные; системные категории удалить нельзя
  ни при каких условиях (даже владельцу — `404`, т.к. `user_id` у системных всегда `null`).

## Transactions (Stage 2)

Все — скоуплены владельцем, как Accounts. `clientId` (UUID) обязателен на создании —
повтор с тем же `clientId` идемпотентен (возвращает уже созданную операцию, не дублирует).

- `GET /transactions?accountId=&limit=&offset=` — список, новые сверху.
- `POST /transactions` — `{ type: expense|income, accountId, categoryId?, amountMinor,
currency, occurredAt?, merchant?, note?, clientId, splits? }`. `splits` — опционально,
  сумма обязана совпадать с `amountMinor` (`400`, если нет).
- `POST /transactions/transfer` — `{ fromAccountId, toAccountId, amountMinor, currency,
clientId, note? }`. Создаёт две связанные строки, не попадает в доходы/расходы, только
  двигает баланс между счетами.
- `GET /transactions/:id`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id` — мягкое удаление (`deleted_at`), не пропадает из БД; для
  перевода помечает удалёнными обе связанные строки. Пишет `audit_logs`
  (`transaction.delete`).
- `POST /transactions/:id/restore` — отменяет удаление, пока не истекли 5 минут (`400`,
  если окно закрылось). Восстанавливает обе стороны перевода.

## Analytics (Stage 3)

### `GET /analytics/summary`

Всё детерминированно (никакого LLM), считается в SQL/TS — см.
`packages/business-rules/src/{period,analytics}.ts`. Периоды — по таймзоне пользователя
(`users.timezone`), не по UTC.

```json
{
  "totalBalanceMinor": 123400,
  "safeToSpendPerDayMinor": 4113,
  "daysRemainingInMonth": 30,
  "daysInMonth": 31,
  "monthEndForecastMinor": 98000,
  "currentMonthExpenseMinor": 25400,
  "currentMonthIncomeMinor": 80000,
  "expenseChangePercent": 18.2,
  "todayExpenseMinor": 3280
}
```

`expenseChangePercent` — сравнение с тем же числом дней прошлого месяца (не всего месяца
целиком — иначе середина месяца искажает рост в меньшую сторону); `null`, если в
сравниваемом периоде прошлого месяца расходов не было (нет базы для роста).

## Commands (Stage 5)

### `POST /commands/parse`

Тело: `{ "text": string, "source": "voice" | "text" }`. Возвращает **черновик**, ничего
не сохраняя — по ТЗ нельзя автосохранять сомнительно распознанное.

```json
{
  "type": "expense",
  "amountMinor": 84000,
  "currency": "RUB",
  "accountId": "...",
  "accountName": "Наличные",
  "categoryId": "...",
  "categoryName": "Кафе и рестораны",
  "occurredAt": "...",
  "confidence": 0.88,
  "explanation": ["сумма", "тип операции", "категория", "счёт", "дата"]
}
```

400, если в фразе нет суммы. `source: "voice"` расходует голосовой лимит тарифа,
текстовый ввод — бесплатный.

Распознавание речи выполняется **на устройстве** (Web Speech API), сервер получает уже
текст — голосовая операция не стоит серверу ничего. Серверный STT-провайдер
(Yandex SpeechKit) понадобится только для клиентов без этого API.

## Entitlements (Stage 5)

### `GET /entitlements`

```json
{ "plan": "free", "limits": { "voice": 10, "import": -1 }, "used": { "voice": 3, "import": 0 } }
```

`-1` — без ограничений. Free: 10 голосовых операций и 1 импорт в месяц. Истёкший платный
тариф ведёт себя как free, а не блокирует пользователя. Счётчик увеличивается атомарно
одним upsert, поэтому параллельные запросы не могут превысить лимит.

## Export (Stage 6)

### `POST /exports`

Без тела. Возвращает синхронно JSON со всеми данными пользователя: профиль, счета,
категории, все неудалённые операции (со splits), Review Inbox (все статусы), личные
правила категоризации, заметки, тариф. Ограничение — 5 запросов/60с. Пишет `audit_logs`
(`data.export`).

## Категоризация (Stage 6)

Пайплайн (`CategorizationService.categorize`), по убыванию уверенности:

| # | Источник | Уверенность | Проходит порог review (60)? |
| - | -------- | ----------- | ---------------------------- |
| 1 | Личное правило пользователя | 100 | да |
| 2 | История пользователя по этому мерчанту | 75 | да |
| 3 | Глобальный алиас мерчанта (`merchant_aliases`, сид в `db/seed.ts`) | 70 | да |
| 4 | MCC (`packages/business-rules/src/mcc.ts`) | 55 | нет — уходит в Review Inbox |
| 5 | Локальный классификатор по ключевым словам | 40 | нет — уходит в Review Inbox |
| 6 | LLM fallback | — | **не реализован** (сознательно — см. ADR ниже) |
| 7 | Не определено | 0 | нет |

LLM fallback предусмотрен спекой между шагом 5 и «не определено», но не подключён: до
появления платящих пользователей сетевой вызов — чистые дополнительные расходы без
выручки, которая бы их окупала. Слот в пайплайне зарезервирован (`categorize()` просто
не доходит до него) — подключается без изменения вызывающего кода, когда появится
экономическое обоснование.

Строка Review Inbox теперь всегда несёт предложенную категорию, если она есть (раньше
`suggestedJson.categoryId` оставался пустым для строк с низкой, но не нулевой,
уверенностью — баг, обнаруженный при добавлении шагов 3–5 и исправленный вместе с ними).

## Insights / Financial Director (Stage 6)

### `GET /insights/daily-summary`

Детерминированная сводка дня — переиспользует `AnalyticsService`, ничего не пересчитывает
дважды.

```json
{
  "yesterdayExpenseMinor": 468000,
  "yesterdayVsAverageChangePercent": 22.4,
  "safeToSpendPerDayMinor": 184000,
  "reviewCount": 2
}
```

`yesterdayVsAverageChangePercent` — `null`, если вчера было 1-е число месяца (нет базы
для сравнения). Обязательные платежи и "дни до дохода" из раздела 12 ТЗ **не включены** —
для них нет источника данных (`recurring_rules`/расписание доходов не реализованы),
показывать их означало бы придумывать цифры.

### `GET /insights`

Список персистентных инсайтов (таблица `insights`), обновляется при каждом запросе.
Пока один тип — `category_growth` (спека §20, шаблонные сообщения, не LLM):

```json
[{
  "id": "...",
  "code": "category_growth",
  "severity": "warning",
  "messageTemplateKey": "insight.category_growth",
  "facts": { "categoryId": "...", "categoryName": "Кафе и рестораны", "currentMinor": 400000, "previousMinor": 200000, "growthPercent": 100, "windowDays": 30 },
  "priority": 100,
  "createdAt": "...",
  "readAt": null
}]
```

Клиент рендерит текст из `messageTemplateKey` + `facts` (сервер не формулирует
предложение — тот же принцип, что и `explanation` в `/commands/parse`). Порог: рост ≥20%
и ≥1000₽ в абсолютных цифрах от базы ≥1000₽ — иначе шум на маленьких категориях.

### `POST /insights/:id/read`

Отмечает прочитанным. `204`. Повторный пересчёт не сбрасывает `readAt`, если факты не
изменились с прошлого раза — иначе «прочитано» слетало бы на каждый следующий `GET`.

## Banking provider (Stage 6, контракт без реального банка)

`apps/api/src/modules/banking/bank-provider.ts` — интерфейс `BankProvider` (спека §23),
с двумя MVP-адаптерами: `ManualBankProvider` (нет внешнего банка — все методы no-op) и
`CsvBankProvider` (нормализует загруженную выписку в `ExternalTransactionPage`). Ни один
адаптер не подключён как HTTP-эндпоинт и `CsvBankProvider` пока не используется
`ImportModule` (у него другая, более сложная построчная логика — построчная
устойчивость к ошибкам и dedup/категоризация в одном проходе, что не ложится в общий
bulk-контракт без потери требования "битая строка не валит весь импорт"). Контракт
существует, чтобы будущий официальный банк подключался без изменения TransactionsModule.
