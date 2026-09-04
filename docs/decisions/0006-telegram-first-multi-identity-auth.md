# ADR 0006: Telegram-first auth with a multi-identity model from day one

## Status

Accepted

## Context

Telegram is the only identity provider at launch, but Android/iOS will add phone+SMS,
Yandex ID, and possibly Sign in with Apple. If `users` is modeled 1:1 with "a Telegram
account", migrating a Telegram user into the mobile app later would either create a
second, disconnected account or require a data migration under load.

## Decision

- `users` holds the app-level identity (`display_name`, `base_currency`, `timezone`,
  `locale`) and owns everything financial.
- `user_identities` is a separate table: `(user_id, provider, provider_user_id, ...)`,
  many rows per user. Telegram is just the first `provider` value; `phone_sms`,
  `yandex`, `apple`, `telegram-link` are the same shape, added without touching
  `users` or any financial table.
- Telegram Mini App flow: client sends Telegram `initData` → server verifies the HMAC
  signature and freshness against `TELEGRAM_BOT_TOKEN` → resolves or creates the
  `user_identities` row → issues our own session (access + refresh JWT; refresh token
  stored only hashed, per spec).
- Linking a second identity to an existing user requires proving ownership of both
  identities — never silent merge on matching phone/email.

## Consequences

- No "migrate Telegram user to mobile" step is ever needed — it is the same user row with
  a second identity attached.
- Replay/IDOR tests are written against the identity-resolution step specifically, since
  that is the highest-value attack surface in this model.
