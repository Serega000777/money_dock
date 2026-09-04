# ADR 0004: One universal Expo app for Telegram Mini App today, Android/iOS tomorrow

## Status

Accepted

## Context

The base tech spec suggests `apps/telegram-web` (plain React + Vite) now and a separate
`apps/mobile` (React Native + Expo) later, created only after the Telegram MVP ships. That
avoids scope creep, but it also means the entire UI layer gets rewritten once mobile
starts — every screen, every style, every piece of client-side state re-implemented in a
different framework. The product brief explicitly asks to lay the client architecture out
under Expo from day one so that doesn't happen.

Telegram Mini Apps are just websites loaded in a WebView/iframe with a JS bridge
(`window.Telegram.WebApp`, injected via `telegram-web-app.js`). Expo's web target
(`react-native-web` under Metro) produces exactly that: a static site. Nothing about the
Mini App constraint requires a React-DOM-specific stack.

## Decision

`apps/app` is a single Expo Router (React Native + `react-native-web`) application.

- Today it is built for web (`expo export --platform web`) and that static bundle is what
  gets hosted and opened as the Telegram Mini App. `app/+html.tsx` injects
  `telegram-web-app.js` into the document head for the web target.
- All Telegram-specific access goes through `src/telegram/` (`TelegramProvider` +
  `useTelegram()`), which reads the injected global directly (no third-party Telegram SDK
  dependency, matching the "domain code must not depend on a specific provider" rule from
  the spec) and degrades to a "demo mode" (`isInsideTelegram: false`) when the app is
  opened outside Telegram or built for native.
- When Android/iOS builds start, it is the same `apps/app` gaining native entitlements
  (SMS/Yandex/Apple sign-in per ADR 0006) — not a new app importing a different UI kit.
- `apps/mobile` is deliberately _not_ created as a separate workspace member — there is
  only ever one client app, `apps/app`; native builds are a build target of it via EAS,
  not a second codebase.

## Consequences

- One design-tokens package, one screen tree, one state layer (`@tanstack/react-query` +
  `zustand`) for every platform — screens built for the Telegram launch are directly
  reusable, not reference material for a rewrite.
- Some native-only capabilities (deep OS-level bank notification import, push
  notifications) are inert on the web target and get feature-detected/gated per platform
  (`Platform.OS`), same as `useTelegram()` already gates Telegram-only behavior.
- Web-target bundle size carries some React Native abstraction overhead compared to a
  hand-tuned Vite/React app; acceptable given a Mini App is not a marketing landing page
  and the alternative cost (a full rewrite for mobile) is much larger.
