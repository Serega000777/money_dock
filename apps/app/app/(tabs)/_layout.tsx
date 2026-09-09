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
// every side, not a full-width strip flush with the bottom.
const TAB_BAR_HEIGHT = 60;
const TAB_BAR_MARGIN_H = spacing.md;
const TAB_BAR_MARGIN_B = Platform.OS === "web" ? spacing.md : spacing.xl;
const TAB_BAR_TOP = TAB_BAR_MARGIN_B + TAB_BAR_HEIGHT;

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
            marginHorizontal: TAB_BAR_MARGIN_H,
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
              bottom: TAB_BAR_TOP - 26,
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
