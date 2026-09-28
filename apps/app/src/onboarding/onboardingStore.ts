import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";

interface OnboardingState {
  hasSeenOnboarding: boolean;
  hydrated: boolean;
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
  if (Platform.OS !== "web") {
    void AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => undefined);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage can be unavailable — onboarding simply reappears next launch.
  }
}

/**
 * Whether the intro carousel + sign-in screen have already run once. Native persists
 * this harmless preference in AsyncStorage; credentials stay separately in Keychain.
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasSeenOnboarding: load(),
  hydrated: Platform.OS === "web",
  markSeen: () => {
    save();
    set({ hasSeenOnboarding: true });
  },
}));

export function hydrateOnboarding(): void {
  if (Platform.OS === "web" || useOnboardingStore.getState().hydrated) return;
  void AsyncStorage.getItem(STORAGE_KEY)
    .then((value) =>
      useOnboardingStore.setState({ hasSeenOnboarding: value === "1", hydrated: true }),
    )
    .catch(() => useOnboardingStore.setState({ hydrated: true }));
}
