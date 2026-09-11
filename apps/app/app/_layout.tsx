import { typography } from "@money-dock/design-tokens";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "../src/api/queryClient";
import { AuthProvider } from "../src/auth/AuthProvider";
import { useAuthStore } from "../src/auth/authStore";
import { useOnboardingStore } from "../src/onboarding/onboardingStore";
import { TelegramProvider, useTelegram } from "../src/telegram/TelegramProvider";
import { useTheme } from "../src/theme/useTheme";

/**
 * Onboarding + the sign-in screen (Telegram / Yandex ID / VK ID) are for the standalone
 * app — a plain browser today, a future native mobile build eventually. Inside a real
 * Telegram Mini App, `AuthProvider` already signs the user in silently from `initData`
 * before this could ever redirect anywhere, so this gate steps aside entirely there
 * rather than interrupting the one flow that already works end to end.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { isInsideTelegram } = useTelegram();
  const hasSeenOnboarding = useOnboardingStore((state) => state.hasSeenOnboarding);
  const accessToken = useAuthStore((state) => state.accessToken);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isInsideTelegram) return;
    const onGateRoute = segments[0] === "onboarding" || segments[0] === "sign-in";
    if (onGateRoute) return;

    if (!hasSeenOnboarding) {
      router.replace("/onboarding");
    } else if (!accessToken) {
      router.replace("/sign-in");
    }
  }, [isInsideTelegram, hasSeenOnboarding, accessToken, segments, router]);

  return <>{children}</>;
}

function ThemedStack() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.name === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.textPrimary,
          headerTitleStyle: { ...typography.headline, color: theme.textPrimary },
          headerShadowVisible: false,
          // Screens paint their own gradient, so the stack itself stays out of the way.
          contentStyle: { backgroundColor: theme.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <TelegramProvider>
          <AuthProvider>
            <AuthGate>
              <ThemedStack />
            </AuthGate>
          </AuthProvider>
        </TelegramProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
