# API

Формальный OpenAPI/Swagger подключится, когда поверхность станет достаточно большой,
чтобы ручное поддержание этого файла стало обузой. Пока — ручное описание, растёт вместе
с модулями.

Все эндпоинты кроме `/health` и `/auth/*` требуют `Authorization: Bearer <accessToken>`.
Access-токен живёт 15 минут; когда истёк — `POST /auth/refresh`.

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

## Accounts

Все операции скоуплены владельцем — чужой `id` возвращает `404`, не `403` (не палим
существование чужих данных).

- `GET /accounts` — список неархивных счетов.
- `POST /accounts` — `{ type, name, currency, initialBalanceMinor }`.
- `GET /accounts/:id`
- `PATCH /accounts/:id` — частичное обновление.
- `DELETE /accounts/:id` — мягкое удаление (`archived_at`).

## Categories

- `GET /categories` — системные (общие) + свои кастомные.
- `POST /categories` — `{ type, name, parentId?, icon? }`.
- `DELETE /categories/:id` — только свои кастомные; системные категории удалить нельзя
  ни при каких условиях (даже владельцу — `404`, т.к. `user_id` у системных всегда `null`).
