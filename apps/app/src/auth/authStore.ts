import { Platform } from "react-native";
import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  setTokens: (tokens: { accessToken: string; refreshToken: string; userId: string }) => void;
  clear: () => void;
}

const LEGACY_STORAGE_KEY = "money-dock-auth";

/**
 * Earlier builds persisted both tokens — including a 30-day refresh token — in
 * `localStorage`, which any script running on the page can read: one XSS meant a month of
 * account access that survived logging out. Nothing is persisted now, so this only clears
 * what those builds left behind on devices that already have it.
 */
function dropLegacyPersistedTokens(): void {
  if (Platform.OS !== "web") return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, disabled cookies) — nothing to clear.
  }
}

dropLegacyPersistedTokens();

/**
 * Tokens live in memory only, for the lifetime of the page. That is affordable because
 * signing back in needs no stored credential: inside Telegram, `AuthProvider` re-issues a
 * session from `initData` on every launch. A reload therefore costs one silent login
 * instead of leaving a long-lived credential at rest.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  setTokens: (tokens) => set(tokens),
  clear: () => set({ accessToken: null, refreshToken: null, userId: null }),
}));
