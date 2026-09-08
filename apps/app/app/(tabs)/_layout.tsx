import { typography } from "@money-dock/design-tokens";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Platform, StyleSheet } from "react-native";

import { useTheme } from "../../src/theme/useTheme";
import { Icon, type IconName } from "../../src/ui/Icon";

// expo-router types the tint as ColorValue; our themes are always plain strings.
const icon =
  (name: IconName) =>
  ({ color }: { color: ColorValue }) => <Icon name={name} color={String(color)} size={25} />;

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "web" ? 78 : 84,
          paddingBottom: Platform.OS === "web" ? 12 : 24,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...typography.overline,
          letterSpacing: 0.1,
          textTransform: "none",
          lineHeight: 14,
        },
        tabBarItemStyle: { gap: 3 },
        // Screens paint their own gradient; a flat colour here would show through on push.
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Главная", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="transactions" options={{ title: "Операции", tabBarIcon: icon("list") }} />
      <Tabs.Screen name="add" options={{ title: "Добавить", tabBarIcon: icon("plus") }} />
      <Tabs.Screen name="analytics" options={{ title: "Аналитика", tabBarIcon: icon("chart") }} />
      <Tabs.Screen name="account" options={{ title: "Кабинет", tabBarIcon: icon("person") }} />
    </Tabs>
  );
}
