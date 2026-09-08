import { motion, radii, spacing, typography } from "@money-dock/design-tokens";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { useTheme } from "../theme/useTheme";
import { formatMinor } from "../utils/format";

import { Text } from "./Text";

export interface DonutSlice {
  id: string;
  label: string;
  color: string;
  value: number;
}

const SIZE = 188;
const STROKE = 22;
const R = (SIZE - STROKE - 8) / 2;
const C = 2 * Math.PI * R;

/**
 * Category donut. Segments are plain SVG arcs and the reveal is one native-driver tween
 * on the wrapper — the SVG itself never re-renders while it animates, which is what keeps
 * this cheap on a low-end phone inside Telegram.
 */
export function Donut({ slices, caption }: { slices: DonutSlice[]; caption: string }) {
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const reveal = useRef(new Animated.Value(0)).current;

  const total = useMemo(() => slices.reduce((sum, s) => sum + s.value, 0), [slices]);

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reveal, total]);

  // Arcs are laid out clockwise from 12 o'clock, with a hairline gap between them.
  const arcs = useMemo(() => {
    let offset = 0;
    return slices.map((slice) => {
      const share = total > 0 ? slice.value / total : 0;
      const length = Math.max(0, share * C - 3);
      const arc = { ...slice, share, length, dashOffset: -offset };
      offset += share * C;
      return arc;
    });
  }, [slices, total]);

  const active = arcs.find((arc) => arc.id === selected) ?? null;
  const centerValue = active ? active.value : total;
  const centerLabel = active ? active.label : caption;

  if (total <= 0) return null;

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.chart,
          {
            opacity: reveal,
            transform: [
              { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
            ],
          },
        ]}
      >
        <Svg width={SIZE} height={SIZE}>
          <G transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={theme.surfaceSunken}
              strokeWidth={STROKE}
              fill="none"
            />
            {arcs.map((arc) => (
              <Circle
                key={arc.id}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={arc.color}
                strokeWidth={selected === arc.id ? STROKE + 6 : STROKE}
                strokeLinecap="round"
                strokeDasharray={[arc.length, C - arc.length]}
                strokeDashoffset={arc.dashOffset}
                opacity={selected && selected !== arc.id ? 0.35 : 1}
                fill="none"
              />
            ))}
          </G>
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.centerValue, { color: theme.textPrimary }]} numberOfLines={1}>
            {formatMinor(centerValue)} ₽
          </Text>
          <Text style={[styles.centerLabel, { color: theme.textSecondary }]} numberOfLines={1}>
            {centerLabel}
          </Text>
          {active ? (
            <Text style={[styles.centerShare, { color: active.color }]}>
              {Math.round(active.share * 100)}%
            </Text>
          ) : null}
        </View>
      </Animated.View>

      <View style={styles.legend}>
        {arcs.map((arc) => (
          <Pressable
            key={arc.id}
            onPress={() => setSelected((current) => (current === arc.id ? null : arc.id))}
            style={[
              styles.legendItem,
              {
                backgroundColor: selected === arc.id ? theme.surfaceSunken : "transparent",
              },
            ]}
          >
            <View style={[styles.legendDot, { backgroundColor: arc.color }]} />
            <Text style={[styles.legendLabel, { color: theme.textSecondary }]} numberOfLines={1}>
              {arc.label}
            </Text>
            <Text style={[styles.legendShare, { color: theme.textPrimary }]}>
              {Math.round(arc.share * 100)}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.lg },
  chart: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerValue: { ...typography.title, fontWeight: "700" },
  centerLabel: { ...typography.caption, maxWidth: SIZE - 70, textAlign: "center" },
  centerShare: { ...typography.callout, fontWeight: "700", marginTop: 2 },
  legend: { alignSelf: "stretch", gap: 2 },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  legendDot: { width: 10, height: 10, borderRadius: radii.pill },
  legendLabel: { ...typography.callout, flex: 1 },
  legendShare: { ...typography.callout, fontWeight: "700" },
});
