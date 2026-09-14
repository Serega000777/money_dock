import { darkTheme, radii, spacing, typography } from "@money-dock/design-tokens";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { AmolaLogo } from "./AmolaLogo";
import { GlowBlob, GradientBackground, GradientBox } from "./Gradient";
import { Icon } from "./Icon";
import { Text } from "./Text";

const ORB = 112;
const RING_COUNT = 2;
const RING_PERIOD = 1800;

/**
 * What the app shows from the very first paint until it knows who you are — the static
 * export pre-renders this, so it's on screen before a byte of JS has run, and it stays up
 * through the silent Telegram sign-in. Always the dark brand look regardless of the
 * user's theme: there's no user yet to have a theme, and the launch should read as Amola
 * before anything else does.
 */
export function BootScreen({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const rings = useRef(Array.from({ length: RING_COUNT }, () => new Animated.Value(0))).current;
  const logo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
      ...rings.map((ring, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay((RING_PERIOD / RING_COUNT) * i),
            Animated.timing(ring, {
              toValue: 1,
              duration: RING_PERIOD,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ),
      ),
    ];
    loops.forEach((loop) => loop.start());
    Animated.timing(logo, {
      toValue: 1,
      duration: 600,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    return () => loops.forEach((loop) => loop.stop());
  }, [breathe, rings, logo]);

  // Fade out rather than vanish: the home screen underneath is already painted by then.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && setMounted(false));
  }, [visible, opacity]);

  if (!mounted) return null;

  return (
    <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.root, { opacity }]}>
      <GradientBackground colors={darkTheme.backgroundGradient} glow={darkTheme.backgroundGlow} />

      <View style={styles.center}>
        <View style={styles.orbWrap}>
          <GlowBlob top="-45%" left="-45%" size={ORB * 1.9} color={darkTheme.accent} opacity={0.45} />
          {rings.map((ring, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  borderColor: darkTheme.accent,
                  opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
                  transform: [
                    { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) },
                  ],
                },
              ]}
            />
          ))}
          <Animated.View
            style={{
              transform: [
                { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
              ],
            }}
          >
            <GradientBox
              colors={darkTheme.accentGradient}
              diagonal
              radius={radii.pill}
              highlight
              highlightSize={160}
              style={styles.orb}
            >
              <View style={styles.orbInner}>
                <Icon name="mic" color="#FFFFFF" size={40} strokeWidth={1.9} />
              </View>
            </GradientBox>
          </Animated.View>
        </View>

        <Animated.View
          style={{
            opacity: logo,
            transform: [{ translateY: logo.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <AmolaLogo width={168} subColor="#E8D6F5" />
        </Animated.View>
      </View>

      <Text style={[styles.caption, { color: darkTheme.textTertiary }]}>Загружаем ваши финансы…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: darkTheme.background,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", gap: spacing.xxl },
  orbWrap: { width: ORB, height: ORB, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: ORB,
    height: ORB,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  orb: { width: ORB, height: ORB },
  orbInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  caption: {
    ...typography.caption,
    position: "absolute",
    bottom: spacing.xxl * 1.5,
  },
});
