import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

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
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
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
