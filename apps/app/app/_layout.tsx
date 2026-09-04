import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "../src/api/queryClient";
import { TelegramProvider, useTelegram } from "../src/telegram/TelegramProvider";
import { useTheme } from "../src/theme/useTheme";

function ThemedStack() {
  const theme = useTheme();
  const { webApp } = useTelegram();

  return (
    <>
      <StatusBar style={webApp?.colorScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
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
          <ThemedStack />
        </TelegramProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
