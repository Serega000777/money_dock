import { useId, type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * Gradients are drawn with react-native-svg, which is already a dependency — one flat
 * <Rect> per gradient, no extra native module and nothing to animate on every frame.
 */
function GradientRect({
  colors,
  radius = 0,
  diagonal,
}: {
  colors: readonly string[];
  radius?: number;
  diagonal?: boolean;
}) {
  // useId keeps gradient defs unique when several render at once — SVG ids are global.
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={diagonal ? "1" : "0.35"} y2="1">
          {colors.map((color, i) => (
            <Stop key={color + i} offset={i / Math.max(1, colors.length - 1)} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

/** A gradient-filled box that lays its children on top. */
export function GradientBox({
  colors,
  radius,
  diagonal,
  style,
  children,
}: {
  colors: readonly string[];
  radius?: number;
  diagonal?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  return (
    <View style={[{ overflow: "hidden", borderRadius: radius }, style]}>
      <GradientRect colors={colors} diagonal={diagonal} />
      {children}
    </View>
  );
}

/** Full-bleed page background; sits behind everything and never intercepts touches. */
export function GradientBackground({ colors }: { colors: readonly string[] }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <GradientRect colors={colors} />
    </View>
  );
}
