import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { ob } from "./palette";

/**
 * The reference's ground: a deep purple gradient with neon ribbons and blurred orbs.
 * react-native-svg has no dependable blur across platforms, so the "blur" is built from
 * fade-to-transparent radial gradients and low-opacity ribbon strokes instead of a filter.
 */
export function OnboardingBackground() {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `ob${raw}${name}`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={id("base")} x1="0.1" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={ob.background[0]} />
            <Stop offset="0.55" stopColor={ob.background[1]} />
            <Stop offset="1" stopColor={ob.background[2]} />
          </LinearGradient>

          <RadialGradient id={id("pink")} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={ob.glowPink} stopOpacity="0.45" />
            <Stop offset="1" stopColor={ob.glowPink} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={id("violet")} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={ob.glowViolet} stopOpacity="0.5" />
            <Stop offset="1" stopColor={ob.glowViolet} stopOpacity="0" />
          </RadialGradient>

          <LinearGradient id={id("ribbon")} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF27C9" stopOpacity="0.55" />
            <Stop offset="0.5" stopColor="#B72CFF" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#6537FF" stopOpacity="0.15" />
          </LinearGradient>
          <LinearGradient id={id("ribbonSoft")} x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#D94FFF" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#FF41D2" stopOpacity="0.06" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="390" height="844" fill={`url(#${id("base")})`} />

        <Ellipse cx="40" cy="120" rx="230" ry="220" fill={`url(#${id("violet")})`} />
        <Ellipse cx="370" cy="330" rx="210" ry="240" fill={`url(#${id("pink")})`} />
        <Ellipse cx="60" cy="640" rx="220" ry="220" fill={`url(#${id("violet")})`} />
        <Ellipse cx="330" cy="800" rx="200" ry="180" fill={`url(#${id("pink")})`} />

        {/* Neon ribbons: thick soft strokes read as the reference's flowing silk shapes. */}
        <Path
          d="M-40 250 C 80 160, 150 330, 280 250 S 420 120, 470 200"
          stroke={`url(#${id("ribbon")})`}
          strokeWidth="46"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <Path
          d="M-40 300 C 90 220, 160 390, 300 310 S 430 190, 470 260"
          stroke={`url(#${id("ribbonSoft")})`}
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <Path
          d="M-40 600 C 110 520, 180 700, 320 620 S 440 500, 470 560"
          stroke={`url(#${id("ribbon")})`}
          strokeWidth="52"
          strokeLinecap="round"
          fill="none"
          opacity="0.4"
        />
        <Path
          d="M-40 660 C 120 590, 190 760, 330 680 S 440 570, 470 630"
          stroke={`url(#${id("ribbonSoft")})`}
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
        <Path
          d="M-20 60 C 60 10, 150 90, 250 30 S 400 -20, 430 40"
          stroke={`url(#${id("ribbonSoft")})`}
          strokeWidth="26"
          strokeLinecap="round"
          fill="none"
          opacity="0.35"
        />
      </Svg>
    </View>
  );
}
