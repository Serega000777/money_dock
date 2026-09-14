import { radii } from "@money-dock/design-tokens";
import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/** A ring that breathes while the mic is open — the only looping animation in the app,
 * and the one visual cue (besides the hint text) that a hold is actually recording.
 * Shared by the home screen's press-and-hold mic and the dedicated /voice screen; `size`
 * must match the mic button it surrounds so the ring grows from the same footprint. */
export function PulseRing({
  active,
  color,
  size,
}: {
  active: boolean;
  color: string;
  size: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: radii.pill,
        borderWidth: 3,
        borderColor: color,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
      }}
    />
  );
}
