import { radii, spacing, typography } from "@money-dock/design-tokens";
import { Link, Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Platform, StyleSheet, View } from "react-native";

import { useTheme } from "../../src/theme/useTheme";
import { GradientBox } from "../../src/ui/Gradient";
import { Icon, type IconName } from "../../src/ui/Icon";
import { PressableScale } from "../../src/ui/primitives";

// expo-router types the tint as ColorValue; our themes are always plain strings.
// Solid silhouette when active, outline otherwise — matches the reference tab bar.
const icon =
  (name: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={name} color={String(color)} size={25} filled={focused} />
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
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: TAB_BAR_HEIGHT,
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
        <Tabs.Screen
          name="transactions"
          options={{ title: "Операции", tabBarIcon: icon("list") }}
        />
        <Tabs.Screen name="analytics" options={{ title: "Аналитика", tabBarIcon: icon("chart") }} />
        <Tabs.Screen name="account" options={{ title: "Кабинет", tabBarIcon: icon("person") }} />
      </Tabs>

      {/* Bottom-right, straddling the tab bar's top edge — outside the Tabs' scene, so a
          screen's own scrolling never moves it, and it isn't tied to (or looping
          through) any one tab's focus effect. */}
      <Link href="/add-transaction" asChild>
        <PressableScale
          accessibilityLabel="Добавить операцию"
          style={StyleSheet.flatten([styles.fab, { bottom: TAB_BAR_HEIGHT - 26 }])}
        >
          <GradientBox
            colors={theme.accentGradient}
            diagonal
            radius={radii.pill}
            style={StyleSheet.flatten([styles.fabInner, { shadowColor: theme.accent }])}
          >
            <View style={styles.fabIconWrap}>
              <Icon name="plus" color="#FFFFFF" size={26} strokeWidth={2.4} />
            </View>
          </GradientBox>
        </PressableScale>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fab: { position: "absolute", right: spacing.lg },
  fabInner: {
    width: 56,
    height: 56,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  fabIconWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
});
