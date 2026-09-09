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

// A shorter, inset, fully-rounded pill — floating above the screen edge with a gap on
// every side. The "+" is a separate circle beside it at the same height, not stacked on
// top of it, so the pill only spans the width the four tabs actually need.
const TAB_BAR_HEIGHT = 60;
const TAB_BAR_MARGIN_H = spacing.md;
const TAB_BAR_MARGIN_B = Platform.OS === "web" ? spacing.md : spacing.xl;
const FAB_SIZE = 52;
const FAB_GAP = spacing.sm;

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
            borderRadius: radii.xl,
            marginLeft: TAB_BAR_MARGIN_H,
            marginRight: TAB_BAR_MARGIN_H + FAB_SIZE + FAB_GAP,
            marginBottom: TAB_BAR_MARGIN_B,
            height: TAB_BAR_HEIGHT,
            paddingBottom: 6,
            paddingTop: 6,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 14,
            elevation: 12,
          },
          tabBarLabelStyle: {
            ...typography.overline,
            fontSize: 10,
            letterSpacing: 0.1,
            textTransform: "none",
            lineHeight: 13,
          },
          tabBarItemStyle: { gap: 3, paddingHorizontal: 0 },
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

      {/* Beside the pill at the same height, not stacked on it — a separate flat-accent
          circle. Outside the Tabs' scene, so a screen's own scrolling never moves it and
          it isn't tied to any one tab's focus effect. */}
      <Link href="/add-transaction" asChild>
        <PressableScale
          accessibilityLabel="Добавить операцию"
          style={StyleSheet.flatten([
            styles.fab,
            {
              bottom: TAB_BAR_MARGIN_B + (TAB_BAR_HEIGHT - FAB_SIZE) / 2,
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
    right: TAB_BAR_MARGIN_H,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
});
