# Архитектура — обзор

## Принцип

Модульный монолит на NestJS + один универсальный клиент на Expo. Домен не знает про
Telegram, LLM или конкретного банковского провайдера — только про интерфейсы адаптеров.
Деньги — целые числа в минорных единицах, вся арифметика в `packages/business-rules`.
Подробности решений — в `docs/decisions/*` (ADR).

## Дерево репозитория

```
money-dock/
  apps/
    api/            # NestJS + TypeScript + Drizzle + PostgreSQL
    app/             # Expo Router (React Native + react-native-web) — Telegram Mini App
                      # сегодня, Android/iOS позже без переписывания
    admin/            # появится при необходимости (Stage 6+)
  packages/
    shared-types/     # framework-free доменные типы (Money, TransactionType, ...)
    validation/        # zod-схемы — единый источник правды для DTO
    business-rules/    # детерминированная доменная математика (money math, позже —
                        # аналитика, safe-to-spend, forecast)
    api-client/         # типизированный fetch-клиент для apps/app
    design-tokens/       # spacing/typography/radii/light-dark темы
    config/               # общие tsconfig/eslint/prettier
  infrastructure/
    docker/                # docker-compose (postgres + api)
    migrations/             # SQL-миграции, генерируются drizzle-kit
  docs/
    architecture/            # этот файл
    api/                      # описание эндпоинтов (растёт по мере модулей)
    database/                  # ERD и описание таблиц
    security/                   # threat model
    decisions/                   # ADR
  tests/                          # e2e/integration, что не колокейтится с исходниками
```

## Границы модулей backend

Каждый модуль (`AuthModule`, `UsersModule`, `AccountsModule`, `CategoriesModule`,
`TransactionsModule`, `ImportModule`, `ReviewInboxModule`, `CategorizationModule`,
`AnalyticsModule`, `CommandsModule`, `EntitlementsModule`, `ExportModule`,
`InsightsModule`, `BankingModule`, `NotesModule` — все реализованы; `AdminModule`,
`NotificationsModule` — ещё нет) владеет своими таблицами и экспортирует только
сервисы — не репозитории и не сущности. Модули добавляются по этапам roadmap (ниже), не
все сразу. Исключение: `DbModule` помечен `@Global()` (даёт `DATABASE` и
`AuditLogService` без явного импорта), как и `AuthModule` (экспортирует `JwtAuthGuard`) —
оба инфраструктурные, не доменная логика.
`BankingModule` — частный случай: он не владеет таблицами и не экспортирует HTTP-роуты,
только контракт `BankProvider` + два MVP-адаптера (`ManualBankProvider`,
`CsvBankProvider`), готовых для будущего потребителя.

## Клиент

`apps/app` — Expo Router приложение. `src/telegram/` — единственное место, которое
знает про `window.Telegram.WebApp` (см. ADR 0004). `app/+html.tsx` подключает
`telegram-web-app.js` в веб-сборку, которая и есть Telegram Mini App. Экраны используют
`@money-dock/design-tokens` напрямую и `@tanstack/react-query` + `@money-dock/api-client`
для данных.

## Интеллект без дорогого ИИ

Analytics Engine, safe-to-spend, Insights (`InsightsService`), категоризация
(`CategorizationService`: личное правило → история → глобальный алиас мерчанта → MCC →
локальный keyword-классификатор) и дедупликация — детерминированный TypeScript/SQL,
без единого сетевого вызова к LLM. Спека оставляет между локальным классификатором и
"не определено" слот под LLM fallback — он сознательно не подключён: до появления
платящих пользователей это чистые расходы без окупающей их выручки (см.
`docs/api/README.md#категоризация-stage-6`). LLM никогда не считает суммы — см. ADR 0005.

## Roadmap (этапы, не спринты)

| Этап       | Содержание                                               |
| ---------- | -------------------------------------------------------- |
| 0 (готово) | repo, CI, Docker, Postgres, конвенции, ADR, health-check |
| 1 (готово) | Telegram auth, users/sessions, accounts/categories       |
| 2 (готово) | transactions, ручной ввод, правила баланса               |
| 3 (готово) | analytics engine, safe-to-spend, главный экран           |
| 4 (готово) | import framework, dedup, Review Inbox, user rules        |
| 5 (готово) | voice pipeline, rule-based parser, entitlements          |
| 6 (в процессе) | заметки, безопасный захват (Siri/виджет), export, delete account, soft-delete транзакций, единый error envelope, audit-логи, insights/финансовый директор, категоризация (global alias/MCC/keyword), banking-контракт — сделаны; admin, notifications, LLM fallback — впереди |
| 7          | security hardening, observability, staging → production  |

Не переходим к следующему этапу, пока не выполнены критерии текущего (тесты зелёные,
lint/typecheck чистые, документация обновлена).
