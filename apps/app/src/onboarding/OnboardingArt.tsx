import { categoryPalette, radii, spacing, typography } from "@money-dock/design-tokens";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme/useTheme";
import { Donut } from "../ui/Donut";
import { GlowBlob, GradientBox } from "../ui/Gradient";
import { Icon, type IconName } from "../ui/Icon";
import { Text } from "../ui/Text";

import type { OnboardingArtVariant } from "./content";

const [FOOD_COLOR, TRANSPORT_COLOR, FUN_COLOR, OTHER_COLOR] = categoryPalette;

// Donut/formatMinor expect minor units (kopecks) — these are demo rubles ×100.
const ANALYTICS_SLICES = [
  { id: "food", label: "Продукты", color: FOOD_COLOR, value: 18400_00 },
  { id: "transport", label: "Транспорт", color: TRANSPORT_COLOR, value: 9200_00 },
  { id: "fun", label: "Развлечения", color: FUN_COLOR, value: 6100_00 },
  { id: "other", label: "Другое", color: OTHER_COLOR, value: 4300_00 },
];

const QUICK_ADD_CATEGORIES: { icon: IconName; color: string }[] = [
  { icon: "cart", color: FOOD_COLOR },
  { icon: "cutlery", color: TRANSPORT_COLOR },
  { icon: "car", color: FUN_COLOR },
  { icon: "coffee", color: OTHER_COLOR },
];

/** Not a captured screenshot — a small, faithful recreation of the real screen using the
 * same components and tokens (`GradientBox`, `Donut`, the category palette), so it never
 * drifts out of sync with the actual UI the way a static image would. */
export function OnboardingArt({ variant }: { variant: OnboardingArtVariant }) {
  const theme = useTheme();

  if (variant === "accounts") {
    return (
      <View style={styles.frame}>
        <GradientBox
          colors={theme.accentGradient}
          diagonal
          highlight
          radius={radii.xl}
          style={styles.heroCard}
        >
          <Text style={[styles.heroLabel, { color: theme.onAccent }]}>Общий баланс</Text>
          <Text style={[styles.heroValue, { color: theme.onAccent }]}>128 450 ₽</Text>
          <View style={styles.tileRow}>
            <AccountTile icon="wallet" label="Наличные" value="12 300 ₽" onAccent />
            <AccountTile icon="card" label="Карта" value="116 150 ₽" onAccent />
          </View>
        </GradientBox>
      </View>
    );
  }

  if (variant === "quickAdd") {
    return (
      <View style={styles.frame}>
        <View style={[styles.surfaceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.categoryRow}>
            {QUICK_ADD_CATEGORIES.map(({ icon, color }) => (
              <View key={icon} style={[styles.categoryChip, { backgroundColor: `${color}22` }]}>
                <Icon name={icon} color={color} size={20} />
              </View>
            ))}
          </View>

          <View style={styles.micWrap}>
            <GlowBlob top="0%" left="0%" size={140} color={theme.accent} opacity={0.5} />
            <GradientBox colors={theme.accentGradient} radius={radii.pill} style={styles.micButton}>
              <Icon name="mic" color={theme.onAccent} size={26} />
            </GradientBox>
          </View>

          <View style={[styles.recognizedChip, { backgroundColor: theme.positiveSoft }]}>
            <Icon name="check" color={theme.positive} size={16} />
            <Text style={[styles.recognizedText, { color: theme.positive }]}>
              «Кофе 250» распознано
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={[styles.surfaceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Donut slices={ANALYTICS_SLICES} caption="Расходы" />
      </View>
    </View>
  );
}

function AccountTile({
  icon,
  label,
  value,
  onAccent,
}: {
  icon: IconName;
  label: string;
  value: string;
  onAccent?: boolean;
}) {
  const theme = useTheme();
  const tint = onAccent ? "rgba(255,255,255,0.16)" : theme.surfaceSunken;
  const textColor = onAccent ? theme.onAccent : theme.textPrimary;
  return (
    <View style={[styles.accountTile, { backgroundColor: tint }]}>
      <Icon name={icon} color={textColor} size={18} />
      <Text style={[styles.accountLabel, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.accountValue, { color: textColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center", minHeight: 260 },
  heroCard: { width: "100%", padding: spacing.lg, gap: spacing.md },
  heroLabel: { ...typography.caption, opacity: 0.85 },
  heroValue: { ...typography.display, fontWeight: "700" },
  tileRow: { flexDirection: "row", gap: spacing.sm },
  accountTile: { flex: 1, borderRadius: radii.md, padding: spacing.sm, gap: 4 },
  accountLabel: { ...typography.caption },
  accountValue: { ...typography.callout, fontWeight: "700" },

  surfaceCard: {
    width: "100%",
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  categoryRow: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" },
  categoryChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  micWrap: {
    width: 140,
    height: 140,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.xs,
  },
  micButton: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  recognizedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  recognizedText: { ...typography.caption, fontWeight: "600" },
});
