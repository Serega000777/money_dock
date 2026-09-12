import { typography } from "@money-dock/design-tokens";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "../src/api/queryClient";
import { AuthProvider } from "../src/auth/AuthProvider";
import { useAuthStore } from "../src/auth/authStore";
import { OnboardingFlow } from "../src/onboarding/OnboardingFlow";
import { TelegramProvider, useTelegram } from "../src/telegram/TelegramProvider";
import { useTheme } from "../src/theme/useTheme";

/**
 * Onboarding + registration (Telegram / Yandex ID / VK ID) are for the standalone app —
 * a plain browser today, a future native mobile build eventually. Inside a real Telegram
 * Mini App, `AuthProvider` signs the user in silently from `initData`, so the gate stays
 * out of the way there.
 *
 * It's an overlay on top of the navigator, not a route: redirecting from the root layout
 * (whether via router.replace in an effect or a <Redirect> in place of the <Stack>) either
 * races expo-router's initial-route resolution on web or unmounts the very navigator it
 * is trying to navigate. Painting over the stack has neither problem, on any platform.
 */
function OnboardingGate() {
  const { isInsideTelegram } = useTelegram();
  const accessToken = useAuthStore((state) => state.accessToken);

  if (isInsideTelegram || accessToken) return null;
  return <OnboardingFlow />;
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
            <View style={styles.flex}>
              <ThemedStack />
              <OnboardingGate />
            </View>
          </AuthProvider>
        </TelegramProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
