# Money Dock — личный финансовый директор

Финансовый автопилот: собирает операции, категоризирует их, следит за дублями и
показывает, сколько денег можно безопасно потратить. Первичная платформа — Telegram Mini
App; тот же клиентский код (Expo) позже становится Android/iOS-приложением без
переписывания. Подробности — `docs/architecture/overview.md`, обоснования решений —
`docs/decisions/`.

## Стек

- **Backend**: NestJS + TypeScript, PostgreSQL, Drizzle ORM. Модульный монолит (ADR 0001).
- **Client**: Expo Router (React Native + `react-native-web`) — один код для Telegram Mini
  App сегодня и Android/iOS позже (ADR 0004).
- **Monorepo**: pnpm workspaces + Turborepo (ADR 0002).
- **Shared**: `packages/shared-types`, `packages/validation` (Zod), `packages/business-rules`
  (детерминированная доменная математика), `packages/design-tokens`, `packages/api-client`.

## Быстрый старт

Требуется Node 20+, pnpm 9+, Docker (для Postgres).

```bash
pnpm install
cp .env.example .env        # заполните TELEGRAM_BOT_TOKEN, JWT_ACCESS_SECRET
pnpm docker:up               # поднимает Postgres в Docker
pnpm db:migrate                # накатывает схему
pnpm db:seed                    # системные категории (продукты, транспорт, ...)
pnpm dev                         # api на :3000, Expo dev server для apps/app
```

Проверить, что всё поднялось:

```bash
curl http://localhost:3000/health
# {"status":"ok","db":"ok"}
```

Открыть клиент в браузере (как будет выглядеть Telegram Mini App):

```bash
pnpm --filter @money-dock/app web
```

## Частые команды

```bash
pnpm build           # turbo build всех пакетов и приложений
pnpm lint             # eslint по всему монорепо
pnpm typecheck         # tsc --noEmit по всему монорепо
pnpm test               # unit-тесты (vitest в packages/*, jest в apps/api)
pnpm format               # prettier --write
pnpm db:generate            # сгенерировать SQL-миграцию из схемы Drizzle
pnpm db:migrate               # применить миграции к DATABASE_URL
pnpm db:seed                    # заполнить системные категории
pnpm docker:down                  # остановить Postgres
```

## Структура репозитория

```
apps/
  api/            NestJS backend
  app/             Expo Router client (Telegram Mini App → Android/iOS)
packages/
  shared-types/     доменные типы без зависимостей от фреймворков
  validation/         Zod-схемы — источник правды для DTO
  business-rules/       детерминированная доменная математика (money math, дальше — аналитика)
  api-client/              типизированный fetch-клиент
  design-tokens/            spacing/typography/цвета, light/dark
  config/                     общие tsconfig/eslint/prettier
infrastructure/
  docker/                       docker-compose.yml (локальный Postgres), docker-compose.prod.yml + Caddyfile (боевой стек)
  migrations/                     SQL-миграции (drizzle-kit)
docs/
  deploy.md · architecture/ · api/ · database/ · security/ · decisions/
```

## Деплой (Telegram Mini App)

Один VPS, три контейнера (Postgres, API, Caddy с автоматическим HTTPS), одна команда —
см. [`docs/deploy.md`](docs/deploy.md): от покупки домена до кнопки в @BotFather.

## Правила разработки (не переносим в код без причины)

- Деньги — целые минорные единицы, никогда `float` (ADR 0005).
- Бизнес-логика не зависит от Telegram SDK, конкретного speech/LLM-провайдера — только от
  интерфейсов-адаптеров (ADR 0001, ADR 0004).
- Redis/очереди/S3 не добавляются "про запас" — только когда появляется реальный кейс
  (ADR 0007).
- Каждое архитектурное решение с альтернативами — ADR в `docs/decisions/`, а не устная
  договорённость.

## Roadmap

См. таблицу этапов в `docs/architecture/overview.md`. Готово: Stage 1–6 — учёт, импорт
выписок, voice/text-команды, тарифы, заметки, захват через Siri/виджет
(`docs/siri-and-widget.md`), soft-delete с undo, error envelope, audit-логи, экспорт,
категоризация (алиасы/MCC/keyword), Insights, контракт `BankProvider`, редактирование
операций, регулярные платежи («Обязательные расходы») и цели накоплений (`/goals`),
онбординг и экран регистрации для отдельного приложения, юридические документы (152-ФЗ).
Впереди: Yandex ID / VK ID (серверные заглушки уже есть), регистрация по телефону,
Telegram-уведомления, подключение банков по API, admin-панель, LLM fallback для
категоризации (ADR 0009).
