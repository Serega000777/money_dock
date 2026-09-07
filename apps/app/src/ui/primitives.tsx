import { elevation, motion, radii, spacing } from "@money-dock/design-tokens";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../theme/useTheme";

/** A soft raised surface — the app's single card look, so nothing drifts apart. */
export function Card({
  children,
  style,
  sunken,
}: {
  children: ReactNode;
  style?: ViewStyle;
  sunken?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: sunken ? theme.background : theme.surface,
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

/**
 * Fades and lifts content in on mount, staggered by `index`. Deliberately small movement
 * and no spring — the spec asks for calm animation, not bounce.
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

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
