import { Platform } from "react-native";
import { create } from "zustand";

interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
}

interface AuthState extends StoredTokens {
  setTokens: (tokens: { accessToken: string; refreshToken: string; userId: string }) => void;
  clear: () => void;
}

const STORAGE_KEY = "money-dock-auth";

function loadPersisted(): StoredTokens {
  const empty: StoredTokens = { accessToken: null, refreshToken: null, userId: null };
  if (Platform.OS !== "web") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...empty, ...(JSON.parse(raw) as Partial<StoredTokens>) } : empty;
  } catch {
    return empty;
  }
}

function persist(tokens: StoredTokens): void {
  if (Platform.OS !== "web") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Storage can be unavailable (private mode, disabled cookies) — auth just won't persist.
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadPersisted(),
  setTokens: (tokens) => {
    persist(tokens);
    set(tokens);
  },
  clear: () => {
    persist({ accessToken: null, refreshToken: null, userId: null });
    set({ accessToken: null, refreshToken: null, userId: null });
  },
}));
