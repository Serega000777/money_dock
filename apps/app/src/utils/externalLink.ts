import { Platform } from "react-native";

import type { TelegramWebApp } from "../telegram/types";

/**
 * Opens a link outside the app — a support/feedback chat on t.me, or a mailto:. Inside
 * the Mini App's sandboxed WebView a plain `window.open`/`location.href` is unreliable
 * (see TelegramWebApp.openTelegramLink/openLink), so this prefers Telegram's own bridge
 * when it's available and falls back to normal web navigation in a plain browser.
 */
export function openExternalLink(url: string, webApp: TelegramWebApp | null): void {
  if (Platform.OS !== "web") return;

  if (url.startsWith("mailto:")) {
    if (webApp?.openLink) webApp.openLink(url);
    else window.location.href = url;
    return;
  }
  if (url.includes("t.me/") && webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }
  if (webApp?.openLink) webApp.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
