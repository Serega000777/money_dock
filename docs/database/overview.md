# База данных — обзор

Схема определена в `apps/api/src/db/schema/*.ts`, миграции генерируются `drizzle-kit`
в `infrastructure/migrations`. Ниже — то, что уже есть после Stage 1.

## Таблицы (Stage 1)

**users** — `id, display_name, base_currency, timezone, locale, status, created_at, updated_at`.
Одна строка на человека независимо от того, сколько способов входа у него привязано.

**user_identities** — `id, user_id, provider, provider_user_id, phone, email, verified_at, created_at`.
`provider` — `telegram | phone_sms | yandex | apple | telegram_link` (ADR 0006). Уникальность
на `(provider, provider_user_id)` — не даёт создать два identity на один и тот же внешний
аккаунт. Миграция Telegram-пользователя в мобильное приложение — это просто ещё один
identity на тот же `user_id`, без нового пользователя.

**sessions** — `id, user_id, refresh_token_hash, device_id, expires_at, revoked_at, created_at`.
Refresh-токен — случайные 256 бит (`node:crypto.randomBytes`), в БД хранится только
sha256-хэш. При рефреше старая сессия помечается `revoked_at` и выпускается новая —
попытка переиспользовать уже отозванный токен отклоняется (защита от replay).

**accounts** — `id, user_id, type(cash|card|bank), name, currency, initial_balance_minor,
archived_at, created_at, updated_at`. `initial_balance_minor` — `bigint`, целые минорные
единицы (ADR 0005), никогда float. Мягкое удаление через `archived_at`.

**categories** — `id, user_id(nullable), type(expense|income), name, parent_id, icon,
system_code, created_at`. `user_id = null` → системная категория (общая для всех,
неудаляемая); `system_code` уникален только среди системных категорий (NULL не
конфликтует сам с собой) — этим достигается идемпотентность `pnpm db:seed`.

## Индексы и constraints

FK с `ON DELETE CASCADE` от `user_identities/sessions/accounts/categories` на `users.id`.
Индексы по `user_id` на `accounts`, `categories`, `sessions` — все выборки в Stage 1
идут через `WHERE user_id = :ownerId`, это и есть механизм защиты от IDOR на уровне
сервиса (см. `docs/security/threat-model.md`).

## Таблицы (Stage 2)

**transactions** — `id, user_id, account_id, category_id, type(expense|income|transfer),
amount_minor, currency, transfer_direction(out|in, только для transfer), occurred_at,
merchant, note, source, status, client_id, created_at, updated_at`. `amount_minor` всегда
положительный — знак задаёт `type`/`transfer_direction` (см. `AccountsService.netMovement`).
`client_id` — идемпотентность: повторный POST с тем же `(user_id, client_id)` возвращает
уже созданную операцию, а не дублирует её. Перевод — две связанные строки с одним
исходным `clientId`, разведённые суффиксами `:out`/`:in` (поэтому колонка `text`, а не
`uuid` — то, что видит клиент, Zod всё равно валидирует как UUID).

**transaction_splits** — `id, transaction_id, category_id, amount_minor`. Сумма сплитов
обязана совпадать с `amount_minor` родительской операции — проверяется до записи в БД
через `packages/business-rules` (`assertSplitsMatchTotal`), а не полагается на constraint.

**transfers** — `id, outgoing_transaction_id, incoming_transaction_id` (оба unique) —
связывает две строки `transactions` одного перевода. Удаление любой из двух строк удаляет
обе (см. `TransactionsService.remove`).

Баланс счёта не хранится отдельным полем — считается на лету:
`initial_balance_minor + SUM(...)` по знаку `type`/`transfer_direction`, одним SQL-запросом
на всю выборку через `LEFT JOIN` + `GROUP BY` (не построчно в Node — дешевле при росте
истории).

## Таблицы (Stage 6)

**merchant_aliases** — `id, normalized_name, raw_pattern, default_category_id, created_at`.
Глобальный (не per-user) справочник мерчант → категория, сид в `db/seed.ts`.
`raw_pattern` — нормализованная подстрока ("ozon", "пятерочка"), не полное имя мерчанта.

**insights** — `id, user_id, type, entity_id, severity, payload_json,
message_template_key, priority, valid_until, read_at, created_at`. Уникальность на
`(user_id, type, entity_id)` — повторная генерация обновляет существующую строку, а не
плодит дубли; `read_at` не сбрасывается, если пересчитанные факты не изменились.

**transactions.deleted_at** — добавлен в Stage 6: мягкое удаление вместо `DELETE`, с
окном отмены (`TransactionsService.restore`). Все выборки по `transactions` фильтруют
`deleted_at IS NULL`.

## Дальше

`budgets`, `recurring_rules` — не реализованы (нет UI/API поверх них, добавляются вместе
с конкретной фичей, а не заранее). `voice_requests`, `subscriptions`, `usage_counters` —
Stage 5. `bank_connections`, `external_transactions` — ждут реального банковского
провайдера (контракт уже есть, см. `docs/api/README.md#banking-provider-stage-6`).
