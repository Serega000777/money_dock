import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Root HTML document for the static web export. This is what gets embedded as the
 * Telegram Mini App — loading the official telegram-web-app.js bridge here is what makes
 * `window.Telegram.WebApp` (see src/telegram/webapp.ts) available at runtime.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <ScrollViewStyleReset />
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
