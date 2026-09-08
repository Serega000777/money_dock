import type { TextScaleName } from "@money-dock/design-tokens";
import { Platform } from "react-native";
import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";
/** Which figure the home hero card's left footer slot shows. */
export type HomeLeftMetric = "expense" | "income";
/** Which figure the home hero card's right footer slot shows. */
export type HomeRightMetric = "remaining" | "free";

interface Settings {
  themeMode: ThemeMode;
  textScale: TextScaleName;
  homeLeftMetric: HomeLeftMetric;
  homeRightMetric: HomeRightMetric;
}

interface SettingsState extends Settings {
  setThemeMode: (mode: ThemeMode) => void;
  setTextScale: (scale: TextScaleName) => void;
  setHomeLeftMetric: (metric: HomeLeftMetric) => void;
  setHomeRightMetric: (metric: HomeRightMetric) => void;
}

const STORAGE_KEY = "money-dock-settings";
const defaults: Settings = {
  themeMode: "system",
  textScale: "medium",
  homeLeftMetric: "expense",
  homeRightMetric: "free",
};

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
  setHomeLeftMetric: (homeLeftMetric) => {
    save({ ...get(), homeLeftMetric });
    set({ homeLeftMetric });
  },
  setHomeRightMetric: (homeRightMetric) => {
    save({ ...get(), homeRightMetric });
    set({ homeRightMetric });
  },
}));
