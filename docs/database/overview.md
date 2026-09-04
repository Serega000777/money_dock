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

## Дальше

`transactions`, `transaction_splits`, `transfers` — Stage 2. `import_jobs`, `review_items`,
`category_rules`, `merchant_aliases` — Stage 4. `budgets`, `recurring_rules`, `insights` —
Stage 3/6. `voice_requests` — Stage 5. `subscriptions`, `usage_counters` — Stage 5.
`audit_logs` — вводится вместе с первым модулем, где решения пользователя нужно
аудировать (Review Inbox, Stage 4).
