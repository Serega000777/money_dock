import { typography } from "@money-dock/design-tokens";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Platform, StyleSheet } from "react-native";

import { useTheme } from "../../src/theme/useTheme";
import { TabIcon, type TabIconName } from "../../src/ui/TabIcon";

// expo-router types the tint as ColorValue; our themes are always plain strings.
const icon =
  (name: TabIconName) =>
  ({ color }: { color: ColorValue }) => <TabIcon name={name} color={String(color)} />;

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
          height: Platform.OS === "web" ? 82 : 88,
          paddingBottom: Platform.OS === "web" ? 16 : 28,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          ...typography.overline,
          letterSpacing: 0.2,
          textTransform: "none",
          lineHeight: 16,
        },
        tabBarItemStyle: { gap: 4, paddingVertical: 2 },
        sceneStyle: { backgroundColor: theme.background },
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
