# Деплой и выпуск в App Store — пошаговый гайд владельца

## 0. Что уже сделано в коде (iOS-сборка)

Флаги в `apps/app/src/platform/appStore.ts` (на iOS выключено, в Telegram/вебе всё как было):

- `CAN_SELL_PRO` — в iOS нет покупки Pro и упоминаний о ней (Apple разрешает продавать
  подписку только через свой IAP; оплата Apple в РФ не работает). Лимиты 3/мес действуют,
  при исчерпании — нейтральное «Лимит на месяц исчерпан, обновится 1-го».
- `SHOW_BANK_BRANDING` — в iOS нет логотипов/дизайнов карт банков (санкционные банки +
  разрешение на знаки ещё не получено).
- `APPLE_SIGN_IN_ONLY` — в iOS вход только через Apple (нерабочие «скоро»-кнопки убраны).
- `SHOW_COMING_SOON` — в iOS нет плашек «Скоро» и пустых ссылок поддержки.
- В Кабинете → «Данные» есть **«Удалить аккаунт»** (требование Apple 5.1.1(v)).
- iOS: поле ввода ИИ поднимается над клавиатурой; картинки карт вшиты в бандл.
- `app.json`: bundle id `app.amola.finance`, Sign in with Apple, микрофон/фото — тексты
  разрешений, privacy manifest, русский регион. JS-бандл iOS проверен (`expo export`).

## 1. Деплой сервера (сначала!)

```bash
cd /root/money_dock && git pull && docker compose --env-file .env.production -f infrastructure/docker/docker-compose.prod.yml up -d --build
```

Проверить: `git log --oneline -1`; в Telegram открыть Mini App, Кабинет → видна строка
«Удалить аккаунт». В `.env.production` должны быть `OWNER_TELEGRAM_ID`,
`DEEPSEEK_VISION_MODEL`, `APPLE_CLIENT_ID=app.amola.finance` (по умолчанию уже такой).

## 2. Apple Developer Program ($99/год)

1. Apple ID с двухфакторной защитой → developer.apple.com/programs/enroll → Individual
   (физлицо) или Organization (нужен D-U-N-S номер компании).
2. Оплата: российские карты не проходят. Для физлица Apple требует **свою** карту, иначе
   попросит документы. Рабочие варианты меняются — уточни у поддержки Apple Developer
   (developer.apple.com/contact) до оплаты. Не плати «через посредников» чужой картой.
3. Ждать подтверждения (от суток до нескольких недель).

## 3. Подготовка в Apple Developer / App Store Connect

1. Certificates, IDs & Profiles → Identifiers → App ID `app.amola.finance`, включить
   **Sign in with Apple**.
2. App Store Connect → Мои приложения → «+» → iOS, имя «Amola Finance», язык Русский,
   bundle id `app.amola.finance`, SKU `amola-finance`.
3. Соглашения: для бесплатного приложения достаточно Free Apps Agreement (Paid Apps —
   только когда будет IAP).

## 4. Сборка и загрузка (с Windows — через EAS, Mac не нужен)

```bash
cd apps/app
npx expo install --fix          # обновить 8 пакетов до версий SDK 57 (expo-doctor просит)
npx expo-doctor                 # должно быть без ошибок; если ругается на app.json — пришли вывод
npx eas-cli login               # аккаунт expo.dev (бесплатный)
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

EAS сам создаст сертификаты (спросит Apple ID). Сборка уходит в TestFlight.
Перед сборкой можно вписать в `apps/app/eas.json` → `build.production.env`
`EXPO_PUBLIC_SUPPORT_TELEGRAM_URL` и `EXPO_PUBLIC_FEEDBACK_TELEGRAM_URL` (те же ссылки, что
`SUPPORT_TELEGRAM_URL`/`FEEDBACK_TELEGRAM_URL` на сервере), иначе строки поддержки скрыты.

## 5. Проверка на iPhone через TestFlight

Установить TestFlight → сборка → проверить: вход через Apple (первый и повторный),
голос (удержание кнопки, отказ в микрофоне), ИИ-чат с клавиатурой, шторки (свайп вниз),
импорт CSV/PDF, удаление счёта и аккаунта, тёмная/светлая тема, перезапуск (сессия жива).

## 6. Карточка приложения в App Store Connect

- **Privacy Policy URL**: `https://amola-finance.ru/legal/privacy` — сначала заполни
  реальные данные Оператора в `apps/app/src/legal/content.ts` (сейчас плейсхолдеры!).
- **Support URL**: любая публичная страница с контактом (можно t.me-ссылка поддержки).
- Категория: Финансы. Цена: бесплатно. Регионы — на твой выбор.
- Скриншоты 6.9" (1320×2868) — минимум 3, снять в симуляторе/на iPhone из TestFlight.
- Описание, ключевые слова, подзаголовок — на русском.
- **App Privacy**: собираются имя/e-mail (Apple ID), финансовая информация (операции),
  аудио (голос — передаётся в Yandex SpeechKit, не хранится), фото (аватар/чек). Не для
  рекламы и трекинга.
- **Age rating**: заполнить анкету (включая вопросы про соцсети — у нас их нет) → 4+.
- Шифрование: уже `usesNonExemptEncryption: false`.
- **Review notes**: «Вход через Sign in with Apple. Голосовой ввод: удерживайте кнопку
  микрофона на главном экране и скажите „кофе 350“. Подписки в iOS-версии нет.»

## 7. Отправка на ревью

Выбрать сборку → «Отправить на проверку». Обычно 1–3 дня. Если отказ — пришли текст из
Resolution Center, поправим.

## Известные риски

- Pro, купленный через Telegram, в iOS тоже действует; Apple (3.1.3(b)) формально хочет,
  чтобы такое было доступно и через IAP. Ревьюер видит свой новый бесплатный аккаунт.
- При удалении аккаунта с Sign in with Apple Apple рекомендует отзывать токен через REST
  API — пока не сделано (нужен ключ Sign in with Apple .p8).
- Чтобы вернуть в iOS оплату/карты банков — StoreKit IAP и флаги выше.
