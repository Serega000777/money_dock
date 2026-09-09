import { radii, spacing, typography } from "@money-dock/design-tokens";
import { Link, Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Platform, StyleSheet, View } from "react-native";

import { useTheme } from "../../src/theme/useTheme";
import { Icon, type IconName } from "../../src/ui/Icon";
import { PressableScale } from "../../src/ui/primitives";

// expo-router types the tint as ColorValue; our themes are always plain strings.
// Solid silhouette when active, bold outline otherwise — matches the reference tab bar.
const icon =
  (name: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={name} color={String(color)} size={25} strokeWidth={2.1} filled={focused} />
  );

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 78 : 84;

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <View style={styles.flex}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.accent,
          // Darker than textTertiary — the reference's inactive icons read as bold, not faint.
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopWidth: 0,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            height: TAB_BAR_HEIGHT,
            paddingBottom: Platform.OS === "web" ? 12 : 24,
            paddingTop: 8,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 12,
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
        <Tabs.Screen
          name="transactions"
          options={{ title: "Операции", tabBarIcon: icon("list") }}
        />
        <Tabs.Screen name="analytics" options={{ title: "Аналитика", tabBarIcon: icon("chart") }} />
        <Tabs.Screen name="account" options={{ title: "Кабинет", tabBarIcon: icon("person") }} />
      </Tabs>

      {/* Bottom-right, mostly sitting inside the tab bar's row — flat accent fill, no
          gradient sheen, light shadow. Matches the reference: a plain round button next
          to the tabs, not a hovering fintech FAB. Outside the Tabs' scene, so a screen's
          own scrolling never moves it and it isn't tied to any one tab's focus effect. */}
      <Link href="/add-transaction" asChild>
        <PressableScale
          accessibilityLabel="Добавить операцию"
          style={StyleSheet.flatten([
            styles.fab,
            {
              bottom: TAB_BAR_HEIGHT - 40,
              backgroundColor: theme.accent,
              shadowColor: theme.accent,
            },
          ])}
        >
          <Icon name="plus" color="#FFFFFF" size={24} strokeWidth={2.4} />
        </PressableScale>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
});
