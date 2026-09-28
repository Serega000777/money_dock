import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  /** The silent Telegram login gave up — the boot screen steps aside for the demo-mode
   * home instead of spinning forever. */
  loginFailed: boolean;
  hydrated: boolean;
  setTokens: (tokens: { accessToken: string; refreshToken: string; userId: string }) => void;
  setLoginFailed: () => void;
  clear: () => void;
}

const LEGACY_STORAGE_KEY = "money-dock-auth";
const NATIVE_STORAGE_KEY = "amola.auth.session";

type StoredSession = Pick<AuthState, "accessToken" | "refreshToken" | "userId">;

function persistNative(session: StoredSession | null): void {
  if (Platform.OS === "web") return;
  const operation = session
    ? SecureStore.setItemAsync(NATIVE_STORAGE_KEY, JSON.stringify(session), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      })
    : SecureStore.deleteItemAsync(NATIVE_STORAGE_KEY);
  void operation.catch(() => undefined);
}

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
  loginFailed: false,
  hydrated: Platform.OS === "web",
  setTokens: (tokens) => {
    persistNative(tokens);
    set({ ...tokens, loginFailed: false, hydrated: true });
  },
  setLoginFailed: () => set({ loginFailed: true }),
  clear: () => {
    persistNative(null);
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      loginFailed: false,
      hydrated: true,
    });
  },
}));

export async function hydrateAuth(): Promise<void> {
  if (Platform.OS === "web" || useAuthStore.getState().hydrated) return;
  try {
    const raw = await SecureStore.getItemAsync(NATIVE_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as StoredSession;
      if (stored.accessToken && stored.refreshToken && stored.userId) {
        useAuthStore.setState({ ...stored, hydrated: true });
        return;
      }
    }
  } catch {
    // A corrupt/inaccessible Keychain entry must not prevent a fresh sign-in.
  }
  useAuthStore.setState({ hydrated: true });
}
