import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/** Where the API lives, so `connect-src` can name it instead of allowing every host. */
function apiOrigin(): string {
  try {
    return new URL(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").origin;
  } catch {
    return "";
  }
}

/**
 * Content-Security-Policy for the exported web build.
 *
 * The point of this policy is to break the *exfiltration* half of an XSS: `connect-src`
 * means injected code cannot post anything to an attacker's server, and `script-src`
 * means it cannot pull a payload from one. `'unsafe-inline'`/`'unsafe-eval'` stay in
 * `script-src` because the React Native Web bundle needs them — tightening those would
 * white-screen the app, and they are not what stops a token walking out of the page.
 *
 * `frame-ancestors` is deliberately absent: browsers ignore it in a <meta> CSP, so
 * clickjacking protection has to come from a real header on whatever serves this export
 * (`frame-ancestors https://telegram.org https://web.telegram.org`).
 */
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin()}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Root HTML document for the static web export. This is what gets embedded as the
 * Telegram Mini App — loading the official telegram-web-app.js bridge here is what makes
 * `window.Telegram.WebApp` (see src/telegram/webapp.ts) available at runtime.
 */
export default function Root({ children }: PropsWithChildren) {
  // Metro's dev server needs websockets and inline eval for fast refresh, which a CSP
  // this strict would cut off — so it only ships with the production export.
  const csp = process.env.NODE_ENV === "production" ? contentSecurityPolicy() : null;

  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {csp ? <meta httpEquiv="Content-Security-Policy" content={csp} /> : null}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <ScrollViewStyleReset />
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
