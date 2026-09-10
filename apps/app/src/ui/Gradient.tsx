import { useId, type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

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

/** A soft, oversized radial smudge — no blur filter needed (uneven react-native-svg
 * support across platforms), the fade-to-transparent gradient reads as a glow on its
 * own. Purely decorative, so it's fine if it bleeds off the edge of the screen.
 * Exported so call sites that want their own glow (the mic button, a highlight inside
 * a gradient card) don't have to reimplement it. */
export function GlowBlob({
  top,
  left,
  size,
  color,
}: {
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  color: string;
}) {
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View style={{ position: "absolute", top, left, width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** A gradient-filled box that lays its children on top. `highlight` adds a soft white
 * glow bleeding in from a corner — the glossy, not-flat look the hero card and mic
 * button reference has, instead of a plain linear-gradient fill. */
export function GradientBox({
  colors,
  radius,
  diagonal,
  highlight,
  highlightSize = 260,
  style,
  children,
}: {
  colors: readonly string[];
  radius?: number;
  diagonal?: boolean;
  highlight?: boolean;
  /** Diameter of the `highlight` glow — scale it down for small surfaces (a stat tile)
   * so it reads as a corner sheen, not a wash covering the whole card. */
  highlightSize?: number;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  return (
    <View style={[{ overflow: "hidden", borderRadius: radius }, style]}>
      <GradientRect colors={colors} diagonal={diagonal} />
      {highlight ? (
        <GlowBlob top="-30%" left="45%" size={highlightSize} color="#FFFFFF" />
      ) : null}
      {children}
    </View>
  );
}

/** Full-bleed page background; sits behind everything and never intercepts touches.
 * `glow` (dark theme only) layers a couple of soft oversized blobs over the base
 * gradient for the reference's "alive", not-flat look. */
export function GradientBackground({
  colors,
  glow,
}: {
  colors: readonly string[];
  glow?: readonly { top: `${number}%`; left: `${number}%`; size: number; color: string }[];
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <GradientRect colors={colors} />
      {glow?.map((blob, i) => <GlowBlob key={i} {...blob} />)}
    </View>
  );
}
