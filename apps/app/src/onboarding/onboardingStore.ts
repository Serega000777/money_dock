import { Platform } from "react-native";
import { create } from "zustand";

interface OnboardingState {
  hasSeenOnboarding: boolean;
  markSeen: () => void;
}

const STORAGE_KEY = "money-dock-onboarding";

function load(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function save(): void {
  if (Platform.OS !== "web") return;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage can be unavailable — onboarding simply reappears next launch.
  }
}

/**
 * Whether the intro carousel + sign-in screen have already run once. Native has no
 * persistence yet (mirrors `useSettingsStore` — this whole store is scaffolding ahead of
 * a real mobile build, where this should move to AsyncStorage or expo-secure-store).
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasSeenOnboarding: load(),
  markSeen: () => {
    save();
    set({ hasSeenOnboarding: true });
  },
}));
