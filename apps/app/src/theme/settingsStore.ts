import type { TextScaleName } from "@money-dock/design-tokens";
import { Platform } from "react-native";
import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

interface Settings {
  themeMode: ThemeMode;
  textScale: TextScaleName;
}

interface SettingsState extends Settings {
  setThemeMode: (mode: ThemeMode) => void;
  setTextScale: (scale: TextScaleName) => void;
}

const STORAGE_KEY = "money-dock-settings";
const defaults: Settings = { themeMode: "system", textScale: "medium" };

function load(): Settings {
  if (Platform.OS !== "web") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) } : defaults;
  } catch {
    return defaults;
  }
}

function save(settings: Settings): void {
  if (Platform.OS !== "web") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable — the choice simply won't survive a reload.
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...load(),
  setThemeMode: (themeMode) => {
    save({ ...get(), themeMode });
    set({ themeMode });
  },
  setTextScale: (scale) => {
    save({ ...get(), textScale: scale });
    set({ textScale: scale });
  },
}));
