import { elevation, radii, typography } from "@money-dock/design-tokens";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Platform, StyleSheet, View } from "react-native";

import { useTheme } from "../../src/theme/useTheme";
import { GradientBox } from "../../src/ui/Gradient";
import { Icon, type IconName } from "../../src/ui/Icon";

// expo-router types the tint as ColorValue; our themes are always plain strings.
const icon =
  (name: IconName) =>
  ({ color }: { color: ColorValue }) => <Icon name={name} color={String(color)} size={23} />;

/** The middle tab is the app's main action, so it reads as a button, not as an icon. */
function AddButton() {
  const theme = useTheme();
  return (
    <GradientBox
      colors={theme.accentGradient}
      diagonal
      radius={radii.pill}
      style={StyleSheet.flatten([styles.fab, { shadowColor: theme.accent }, elevation.float])}
    >
      <View style={styles.fabInner}>
        <Icon name="plus" color={theme.onAccent} size={26} strokeWidth={2.1} />
      </View>
    </GradientBox>
  );
}

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
          height: Platform.OS === "web" ? 84 : 90,
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
        // Screens paint their own gradient; a flat colour here would show through on push.
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Главная", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="transactions" options={{ title: "Операции", tabBarIcon: icon("list") }} />
      <Tabs.Screen
        name="add"
        options={{ title: "", tabBarIcon: () => <AddButton />, tabBarItemStyle: { paddingTop: 2 } }}
      />
      <Tabs.Screen name="analytics" options={{ title: "Аналитика", tabBarIcon: icon("chart") }} />
      <Tabs.Screen name="account" options={{ title: "Кабинет", tabBarIcon: icon("person") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: { width: 52, height: 52, marginTop: -14 },
  fabInner: { flex: 1, alignItems: "center", justifyContent: "center" },
});
