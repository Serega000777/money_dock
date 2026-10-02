# AGENTS.md — правила для любого ИИ-агента в этом репозитории

Читают все: Claude Code, Codex, OpenClaw и любой другой агент, на любой машине (Windows,
Mac, VPS). `CLAUDE.md` просто ссылается сюда. **Источник правды — GitHub (`main`), а не
чья-то локальная папка и не чья-то память чата.**

Проект — **Amola Finance** (репозиторий `Serega000777/money_dock`): личный финансовый
помощник, Telegram Mini App + будущее iOS/Android-приложение. Прод: https://amola-finance.ru.
Владелец пишет по-русски — отвечай по-русски, коротко, без воды.

## ПРОТОКОЛ ЗАДАЧИ (обязателен, это главная причина этого файла)

Журнал — [`docs/AGENT_LOG.md`](docs/AGENT_LOG.md). Он дописывается только в конец.

**Перед тем как начать любую задачу:**

1. `git pull --rebase origin main`.
2. Прочитай [`docs/STATUS.md`](docs/STATUS.md) и последние записи `docs/AGENT_LOG.md`.
   Если там есть запись со статусом `in-progress` на те же файлы/модуль — **остановись и
   спроси владельца**, не лезь параллельно. Две правки одной области одновременно — главный
   источник путаницы.
3. Допиши в конец `docs/AGENT_LOG.md` запись (формат ниже) со статусом `in-progress`:
   кто ты, на какой машине, что за задача, какие области затронешь.
4. Закоммить и запушь **только этот файл** (`git add docs/AGENT_LOG.md`,
   коммит `log: <agent> started <коротко>`). Только после этого начинай работу.

**Когда закончил (или остановился):**

1. Проверки: `pnpm typecheck`, `pnpm lint`, тесты затронутых модулей (см. «Подводные камни»).
2. Обнови свою запись в журнале: статус `done` / `blocked` / `abandoned`, итог в 1–3
   строках, хеш коммита, что осталось недоделанным.
3. Если изменилось то, что реализовано / как деплоить — обнови `docs/STATUS.md`.
4. Коммит + `git push origin main`. Незапушенная работа считается несуществующей.

**Формат записи** (в конец `docs/AGENT_LOG.md`):

```
### 2026-10-02 14:30 · Claude Code (Windows) · in-progress
Задача: <что просил владелец, одной строкой>
Области: <модули/файлы, которые трогаю>
Итог: —            (заполняется при завершении)
Коммиты: —
Осталось: —
```

Агент называет себя честно: `Claude Code (Windows|Mac|VPS)`, `Codex (VPS)`, `OpenClaw (VPS)`.
Если сессия оборвалась и запись осталась `in-progress` — следующий агент не удаляет её,
а спрашивает владельца, дописывает `abandoned`/`done` и только потом берётся за область.

## Общие правила работы

- Одну папку с кодом не правят два агента одновременно. Для параллельной работы — отдельная
  ветка или `git worktree`, слияние через владельца.
- Не коммить секреты: `.env`, `.env.production` и ключи **не в git** и живут на каждой
  машине отдельно. Новые переменные окружения добавляй в `.env.example` /
  `.env.production.example` и в `docs/STATUS.md` (раздел «Окружение»), значения не пиши.
- Не делай необратимых действий (force-push, удаление данных/томов, `docker volume rm`,
  правки прод-БД) без явной команды владельца.
- Код короткий и чистый, стиль — как у соседних файлов. Лишних зависимостей и «про запас»
  инфраструктуры не добавляй (ADR 0007). Комментарии — только про «почему».
- Перед правкой — прочитай окружающий код; не пересоздавай то, что уже есть.
- Каждое архитектурное решение с альтернативами — ADR в `docs/decisions/`.

## Архитектурные инварианты

- Деньги — **только целые минорные единицы** (копейки), никогда `float` (ADR 0005).
  Вся денежная арифметика — `packages/business-rules`.
- ИИ/LLM **никогда не считает деньги и не видит SQL**: он только классифицирует/перефразирует
  запрос; суммы считает бэкенд. Любая запись от ассистента — сначала pending action, потом
  подтверждение пользователем.
- Бизнес-логика не знает про Telegram, конкретного LLM/speech-провайдера — только
  интерфейсы-адаптеры (ADR 0001/0004). `apps/app/src/telegram/` — единственное место, которое
  знает про `window.Telegram.WebApp`.
- Валидация DTO — Zod в `packages/validation`, единый источник правды (ADR 0008).
- Модуль владеет своими таблицами и экспортирует только сервисы.

## Карта репозитория

```
apps/api            NestJS + Drizzle + Postgres (модули в apps/api/src/modules/*)
apps/app            Expo Router (RN + react-native-web): экраны apps/app/app/*, фичи apps/app/src/*
packages/           shared-types · validation · business-rules · api-client · design-tokens · config
infrastructure/     docker (локально и прод) + SQL-миграции drizzle
docs/               deploy.md · architecture · decisions (ADR) · STATUS.md · AGENT_LOG.md
```

## Команды

```bash
pnpm install
pnpm docker:up && pnpm db:migrate && pnpm db:seed   # локальный Postgres
pnpm dev                                            # api :3000 + Expo
pnpm --filter @money-dock/app web                   # клиент в браузере
pnpm typecheck && pnpm lint && pnpm test
```

Деплой (на VPS, под root, `/root/money_dock`):

```bash
cd /root/money_dock && git pull && docker compose --env-file .env.production -f infrastructure/docker/docker-compose.prod.yml up -d --build
```

## Подводные камни (уже наступали)

- **Jest e2e в `apps/api`**: гонять `--runInBand`, пачками по несколько файлов (иначе падает
  процесс). Внутри describe все тесты шарят одного пользователя, поэтому **лимиты бесплатного
  тарифа** (3 в месяц) их ломают: для тестов с множеством вызовов ставь пользователю Pro
  (`EntitlementsService.setPlan(userId, "pro")`) или создавай свежего. Throttler считается на
  экземпляр Nest-приложения. `pdf-parse` в тестах мокается.
- **Типы shared-types** потребляются из `dist`: после правки `packages/shared-types`
  выполни `pnpm --filter @money-dock/shared-types build`, иначе `apps/app` не увидит новые
  поля.
- **`pnpm --filter @money-dock/app lint --fix`** трогает посторонние файлы — смотри
  `git status` и откатывай чужое.
- **Expo web / Metro**: `EXPO_PUBLIC_API_URL` вшивается при сборке; после смены нужен
  `expo export --clear`. Для проверки в браузере вход — «Продолжить без регистрации»
  (`/auth/dev-login`, в проде 404). Токены на web нигде не сохраняются (после перезагрузки
  нужен вход заново). Проверять UI удобнее в свежей вкладке; в `PressableScale` стиль
  применяется к внутреннему `Animated.View`, а не к элементу с `aria-label`.
- В RN-web у `View` по умолчанию `position: relative`; абсолютный `<svg>` градиента
  (`GradientBox`) перекрывает статичных соседей — детей кладите во `View`.
- Docker Desktop на машине владельца (Windows) «мигает»; при сбое — подождать и повторить.
  Диск C: заполнялся `docker_data.vhdx` — `docker builder prune` + `docker desktop stop`.
- Prod-API отдаёт `/auth/dev-login` как 404 (`NODE_ENV=production`). Админ-ссылка в кабинете
  видна только владельцу (`OWNER_TELEGRAM_ID`).
