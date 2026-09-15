import { typography } from "@money-dock/design-tokens";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "../src/api/queryClient";
import { AuthProvider } from "../src/auth/AuthProvider";
import { useAuthStore } from "../src/auth/authStore";
import { OnboardingFlow } from "../src/onboarding/OnboardingFlow";
import { TelegramProvider, useTelegram } from "../src/telegram/TelegramProvider";
import { useTheme } from "../src/theme/useTheme";
import { BootScreen } from "../src/ui/BootScreen";

/**
 * Two overlays share the top of the tree, painted over the navigator rather than routed
 * to (redirecting from the root layout — router.replace in an effect, or a <Redirect> in
 * place of the <Stack> — either races expo-router's initial-route resolution on web or
 * unmounts the very navigator it is trying to navigate):
 *
 * - The boot screen, from the very first paint until the app knows who you are. The
 *   static export pre-renders the tree with no Telegram bridge and no token, which used
 *   to mean the onboarding tour flashed on every Mini App launch until the JS bundle
 *   booted and `isInsideTelegram` flipped. Nothing decides "not in Telegram" before the
 *   client has actually run (`booted`), and inside Telegram the screen stays up through
 *   the silent sign-in so the home screen never shows in demo mode first.
 * - Onboarding + registration (Telegram / Yandex ID / VK ID), for the standalone app — a
 *   plain browser today, a future native build eventually.
 */
function BootGate() {
  const { isInsideTelegram } = useTelegram();
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginFailed = useAuthStore((state) => state.loginFailed);
  const [booted, setBooted] = useState(false);
  useEffect(() => setBooted(true), []);

  const signedIn = Boolean(accessToken);
  const booting = !booted || (isInsideTelegram && !signedIn && !loginFailed);
  const showOnboarding = booted && !isInsideTelegram && !signedIn;

  return (
    <>
      {showOnboarding ? <OnboardingFlow /> : null}
      <BootScreen visible={booting} />
    </>
  );
}

function ThemedStack() {
  const theme = useTheme();
  const { webApp } = useTelegram();

  // Keep the host chrome in the same theme as the app. Telegram otherwise keeps the
  // first (usually white) bottom/header colours until something causes a repaint,
  // which is why toggling light -> dark appeared to fix the menu after launch.
  useEffect(() => {
    webApp?.setHeaderColor?.(theme.background);
    webApp?.setBackgroundColor?.(theme.background);
    webApp?.setBottomBarColor?.(theme.background);

    if (Platform.OS === "web") {
      document.documentElement.style.backgroundColor = theme.background;
      document.documentElement.style.colorScheme = theme.name;
      document.body.style.backgroundColor = theme.background;
    }
  }, [theme, webApp]);

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
              <BootGate />
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
