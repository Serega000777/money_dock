import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

import { AmolaLogo } from "../ui/AmolaLogo";
import { GlowBlob, GradientBox } from "../ui/Gradient";
import { Icon, type IconName } from "../ui/Icon";
import { Text } from "../ui/Text";
import { PressableScale } from "../ui/primitives";

import { ob } from "./palette";

export function OnboardingLogo() {
  return (
    <View style={styles.logo}>
      <AmolaLogo width={172} subColor="#E8D6F5" />
    </View>
  );
}

/**
 * The reference's handwritten notes. No font file is bundled for this — a system cursive
 * stack keeps it to zero new dependencies and zero external requests (which also keeps
 * the CSP in `+html.tsx` as tight as it is); platforms without one fall back to italic.
 */
export function Handwritten({
  text,
  style,
}: {
  text: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.scriptWrap, style]} pointerEvents="none">
      <Text style={styles.script}>{text}</Text>
    </View>
  );
}

export function GlassCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

/** A rounded-square icon badge — the floating decorations and every feature tile use it. */
export function IconBadge({
  name,
  size = 44,
  iconSize = 22,
  color = ob.textPrimary,
  style,
}: {
  name: IconName;
  size?: number;
  iconSize?: number;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 3.4 },
        style,
      ]}
    >
      <Icon name={name} color={color} size={iconSize} strokeWidth={1.9} />
    </View>
  );
}

/** The big glowing orb (microphone on the welcome/voice screens, chart on analytics). */
export function GlowOrb({ name, size = 96 }: { name: IconName; size?: number }) {
  return (
    <View style={[styles.orbWrap, { width: size * 1.7, height: size * 1.7 }]}>
      <GlowBlob top="0%" left="0%" size={size * 1.7} color={ob.glowPink} opacity={0.5} />
      <View
        style={[
          styles.orbRing,
          { width: size * 1.24, height: size * 1.24, borderRadius: size },
        ]}
      />
      <GradientBox
        colors={ob.primaryGradient}
        diagonal
        radius={size / 2}
        style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      >
        {/* A bare <svg> is position:static on web and paints under the absolute gradient. */}
        <View>
          <Icon name={name} color="#FFFFFF" size={size * 0.42} strokeWidth={1.9} />
        </View>
      </GradientBox>
    </View>
  );
}

export function FeatureRow({
  items,
}: {
  items: { icon: IconName; title: string; subtitle: string }[];
}) {
  return (
    <View style={styles.featureRow}>
      {items.map((item) => (
        <View key={item.title} style={styles.featureTile}>
          <IconBadge name={item.icon} size={34} iconSize={17} />
          <Text style={styles.featureTitle}>{item.title}</Text>
          <Text style={styles.featureSubtitle}>{item.subtitle}</Text>
        </View>
      ))}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  trailingArrow = true,
}: {
  label: string;
  onPress: () => void;
  trailingArrow?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={styles.ctaShadow}>
      <GradientBox
        colors={ob.buttonGradient}
        horizontal
        radius={ob.buttonRadius}
        style={styles.cta}
      >
        <Text style={styles.ctaLabel}>{label}</Text>
        {trailingArrow ? (
          <View style={styles.ctaArrow}>
            <Icon name="arrowRight" color="#FFFFFF" size={22} strokeWidth={2.1} />
          </View>
        ) : null}
      </GradientBox>
    </PressableScale>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={styles.ghost}>
      <Text style={styles.ghostLabel}>{label}</Text>
    </PressableScale>
  );
}

export function Dots({ total, active }: { total: number; active: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === active
              ? { backgroundColor: ob.glowPink, width: 9, height: 9 }
              : { backgroundColor: "rgba(255,255,255,0.22)" },
          ]}
        />
      ))}
    </View>
  );
}

/** Thin gradient progress bar used by the budget and goal cards. */
export function ObProgress({ share, height = 8 }: { share: number; height?: number }) {
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height }]}>
      <View style={{ width: `${Math.max(3, Math.min(100, share * 100))}%` }}>
        <GradientBox
          colors={ob.secondaryGradient}
          horizontal
          radius={height}
          style={{ height }}
        />
      </View>
    </View>
  );
}

export function ScreenHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const cursive = Platform.select({
  web: '"Segoe Script", "Bradley Hand", "Snell Roundhand", "Brush Script MT", cursive',
  default: undefined,
});

const styles = StyleSheet.create({
  logo: { alignItems: "center" },

  scriptWrap: { maxWidth: 130 },
  script: {
    color: ob.script,
    fontSize: 13,
    lineHeight: 17,
    fontStyle: cursive ? "normal" : "italic",
    ...(cursive ? { fontFamily: cursive } : null),
  },

  glass: {
    backgroundColor: ob.cardBackground,
    borderColor: ob.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ob.cardRadius,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 10,
  },

  badge: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  orbWrap: { alignItems: "center", justifyContent: "center", alignSelf: "center" },
  orbRing: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
  },

  featureRow: { flexDirection: "row", gap: 9 },
  featureTile: {
    flex: 1,
    backgroundColor: ob.tileBackground,
    borderColor: ob.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 9,
    gap: 7,
  },
  // 26px on the 941px reference ≈ 10.4pt at 375 — the tiles need it to keep
  // "Автообновление" / "распознавание" on one line.
  featureTitle: { color: ob.textPrimary, fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
  featureSubtitle: { color: ob.textMuted, fontSize: 10, lineHeight: 13 },

  ctaShadow: {
    borderRadius: ob.buttonRadius,
    shadowColor: ob.glowPink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  cta: {
    height: ob.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  ctaLabel: { color: "#FFFFFF", fontSize: 19, fontWeight: "700" },
  ctaArrow: { position: "absolute", right: 26 },

  ghost: {
    height: 56,
    borderRadius: ob.buttonRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostLabel: { color: ob.textSecondary, fontSize: 15.5, fontWeight: "600" },

  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 999 },

  progressTrack: { backgroundColor: "rgba(255,255,255,0.14)", overflow: "hidden" },

  heading: { alignItems: "center", gap: 6 },
  title: {
    color: ob.textPrimary,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: ob.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
});
