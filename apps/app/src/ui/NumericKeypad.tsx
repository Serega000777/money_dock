import { radii, spacing, typography } from "@money-dock/design-tokens";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme/useTheme";

import { Icon } from "./Icon";
import { Text } from "./Text";
import { PressableScale } from "./primitives";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

/** On-screen amount entry — the app's own key style instead of the OS keyboard, so it
 * looks the same on the Telegram web view, a browser, and native. Appending/backspacing
 * the amount string is the caller's job (`onKey`); this component only draws the grid. */
export function NumericKeypad({ onKey }: { onKey: (key: (typeof KEYS)[number]) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        // PressableScale puts `style` on an inner Animated.View, so a percentage width
        // there never reaches the actual flex item — size this wrapper instead and let
        // the button fill it.
        <View key={key} style={styles.keySlot}>
          <PressableScale
            onPress={() => onKey(key)}
            accessibilityLabel={key === "back" ? "Стереть" : key}
            style={StyleSheet.flatten([styles.key, { backgroundColor: theme.surface }])}
          >
            {key === "back" ? (
              <Icon name="backspace" color={theme.textSecondary} size={22} />
            ) : (
              <Text style={[styles.keyText, { color: theme.textPrimary }]}>{key}</Text>
            )}
          </PressableScale>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  keySlot: { width: "31%", aspectRatio: 1.6 },
  key: {
    flex: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { ...typography.title, fontWeight: "600" },
});
