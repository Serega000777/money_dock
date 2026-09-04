# База данных — обзор

Stage 0: схема пуста (`apps/api/src/db/schema/index.ts`), проверено только подключение
к Postgres через `/health`. Таблицы добавляются модулями начиная со Stage 1.

## Плановый минимальный набор таблиц (по ТЗ)

`users`, `user_identities`, `sessions`, `accounts`, `categories`, `transactions`,
`transaction_splits`, `transfers`, `import_jobs`, `review_items`, `category_rules`,
`merchant_aliases`, `budgets`, `recurring_rules`, `insights`, `voice_requests`,
`subscriptions`, `usage_counters`, `audit_logs`.

Правила:

- Деньги — `integer`/`bigint` минорные единицы, никогда `float` (ADR 0005).
- Все `timestamp` — UTC (`timestamptz`); таймзона пользователя — отдельное поле
  `users.timezone`.
- `transactions.type = 'transfer'` не попадает в доходы/расходы — связывается через
  `transfers (outgoing_transaction_id, incoming_transaction_id)`.
- Soft-delete там, где нужна история (счета, категории), foreign keys и unique
  constraints — по каждой таблице при её появлении.

ERD появится в этом файле вместе с первой миграцией (Stage 1, `AuthModule` +
`AccountsModule` + `CategoriesModule`).
