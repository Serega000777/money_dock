import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme/useTheme";

import { GlowBlob, GradientBox } from "./Gradient";
import { Icon, type IconName } from "./Icon";

/**
 * The glossy, neon-on-dark square the goal reference art uses — a gradient tile with a
 * corner highlight (same "not flat" trick as the mic button and hero card, see
 * Gradient.tsx) plus a soft colour bloom behind it, rather than the flat tinted circle
 * every other icon badge in the app uses. Goals are the one place the product leans into
 * that look — see `GoalRow` and `CreateGoalSheet`.
 */
export function GoalIconBadge({ name, size = 44 }: { name: IconName; size?: number }) {
  const theme = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      <GlowBlob top="-30%" left="-30%" size={size * 1.9} color={theme.accent} opacity={0.55} />
      <GradientBox
        colors={theme.accentGradient}
        diagonal
        radius={size / 3.2}
        highlight
        highlightSize={size * 1.4}
        style={styles.tile}
      >
        <View style={styles.inner}>
          <Icon name={name} color="#FFFFFF" size={size * 0.44} strokeWidth={1.9} />
        </View>
      </GradientBox>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1 },
  inner: { flex: 1, alignItems: "center", justifyContent: "center" },
});
