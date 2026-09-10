import { elevation, motion, radii, spacing, typography } from "@money-dock/design-tokens";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme/useTheme";

import { GradientBackground, GradientBox } from "./Gradient";
import { Text } from "./Text";

/** Page shell: gradient ground in both themes, safe area, and a scrolling body. */
export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <View style={styles.flex}>
      <GradientBackground colors={theme.backgroundGradient} glow={theme.backgroundGlow} />
      <SafeAreaView style={styles.flex} edges={["top", "left", "right"]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.screenContent, contentStyle]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

/** A soft raised surface — the app's single card look, so nothing drifts apart.
 * `gradient` swaps the flat surface fill for `theme.tileGradient` — a barely-there tint
 * for cards that carry a number (stat tiles), not for ordinary list rows. */
export function Card({
  children,
  style,
  sunken,
  gradient,
}: {
  children: ReactNode;
  style?: ViewStyle;
  sunken?: boolean;
  gradient?: boolean;
}) {
  const theme = useTheme();

  if (gradient) {
    return (
      <GradientBox
        colors={theme.tileGradient}
        diagonal
        radius={radii.lg}
        style={StyleSheet.flatten([
          styles.card,
          { shadowColor: theme.shadowColor, borderColor: theme.border },
          elevation.card,
          style,
        ])}
      >
        {children}
      </GradientBox>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: sunken ? theme.surfaceSunken : theme.surface,
          shadowColor: theme.shadowColor,
          borderColor: theme.border,
        },
        !sunken && elevation.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Screen title with the same rhythm everywhere. */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <FadeIn>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
    </FadeIn>
  );
}

/**
 * Fades and lifts content in on mount, staggered by `index`. Deliberately small movement
 * and no spring — the spec asks for calm animation, not bounce. Runs on the native
 * driver, so the list keeps scrolling at 60fps while it plays.
 */
export function FadeIn({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: ViewStyle;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.normal,
      delay: index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, index]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Press feedback that scales instead of flashing — reads as physical, not as a flicker. */
export function PressableScale({
  children,
  style,
  ...props
}: PressableProps & { children: ReactNode; style?: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (toValue: number) =>
    Animated.timing(scale, {
      toValue,
      duration: motion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        animate(0.97);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(1);
        props.onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Small tinted label — deltas, statuses, counts. */
export function Pill({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

/** A bar that grows to its share on mount instead of appearing already full. */
export function ProgressBar({ share, color }: { share: number; color: string }) {
  const theme = useTheme();
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(grow, {
      toValue: 1,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      // Width can't run on the native driver; it's one short tween per row, not a loop.
      useNativeDriver: false,
    }).start();
  }, [grow, share]);

  return (
    <View style={[styles.barTrack, { backgroundColor: theme.surfaceSunken }]}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color,
            width: grow.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", `${Math.max(2, Math.min(100, share * 100))}%`],
            }),
          },
        ]}
      />
    </View>
  );
}

/** Two-to-three option switch used for theme and interface size. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surfaceSunken }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              active && { backgroundColor: theme.surface, shadowColor: theme.shadowColor },
              active && elevation.card,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? theme.textPrimary : theme.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Modal sheet sliding up from the bottom — pickers, custom-period entry, anything that
 * needs more room than an inline expand but shouldn't leave the current screen. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable
          style={[styles.sheetBody, { backgroundColor: theme.sheet }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          {title ? (
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>{title}</Text>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenContent: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120,
    gap: spacing.md,
    // On a desktop browser the phone layout would stretch into unreadable lines; the app
    // is designed for a phone, so it stays phone-width and centred on anything wider.
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleBlock: { gap: 2, marginBottom: spacing.xs },
  title: typography.display,
  subtitle: typography.caption,
  pill: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { ...typography.caption, fontWeight: "600" },
  barTrack: { height: 8, borderRadius: radii.pill, overflow: "hidden" },
  barFill: { height: 8, borderRadius: radii.pill },
  segmented: { flexDirection: "row", borderRadius: radii.md, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  segmentText: { ...typography.callout, fontWeight: "600" },

  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,12,20,0.45)" },
  sheetBody: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: "82%",
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  sheetTitle: { ...typography.headline, marginBottom: spacing.md, textAlign: "center" },
});
