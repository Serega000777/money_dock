import { motion, radii, spacing, typography } from "@money-dock/design-tokens";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useTheme } from "../theme/useTheme";
import { formatMinor } from "../utils/format";

import { Text } from "./Text";

export interface Bar {
  key: string;
  label: string;
  value: number;
}

const HEIGHT = 132;
// Past this many bars, equal-width flex columns get too thin to read (a month view
// squeezes to ~8px bars with mostly-empty gaps). Switch to fixed-width scrollable
// columns instead so every bar keeps a comfortable, consistent width.
const SCROLL_THRESHOLD = 14;
const COLUMN_WIDTH = 26;

/**
 * Spending over the period. Bars grow once on mount and on every period change; the
 * tapped bar reveals its own amount, so the chart carries numbers without a legend.
 */
export function BarChart({ bars, accent }: { bars: Bar[]; accent: string }) {
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const grow = useRef(new Animated.Value(0)).current;
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const scrollRef = useRef<ScrollView>(null);
  const scrollable = bars.length > SCROLL_THRESHOLD;

  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // Land on "today" (the tail of the period) instead of the far-left start of the month.
    if (scrollable) scrollRef.current?.scrollToEnd({ animated: false });
  }, [grow, bars, scrollable]);

  const active = bars.find((bar) => bar.key === selected);

  const columns = bars.map((bar) => {
    const share = bar.value / max;
    const isActive = selected === bar.key;
    return (
      <Pressable
        key={bar.key}
        onPress={() => setSelected(isActive ? null : bar.key)}
        style={[styles.column, scrollable && { width: COLUMN_WIDTH }]}
      >
        <View style={styles.barSlot}>
          <View style={[styles.baseline, { backgroundColor: theme.border }]} />
          <Animated.View
            style={[
              styles.bar,
              {
                backgroundColor: isActive ? accent : `${accent}80`,
                height: grow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, Math.max(4, share * HEIGHT)],
                }),
              },
            ]}
          />
        </View>
        <Text
          style={[styles.tick, { color: isActive ? theme.textPrimary : theme.textTertiary }]}
          numberOfLines={1}
        >
          {bar.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.caption, { color: theme.textSecondary }]}>
          {active ? active.label : "Динамика расходов"}
        </Text>
        <Text style={[styles.value, { color: theme.textPrimary }]}>
          {active ? `${formatMinor(active.value)} ₽` : ""}
        </Text>
      </View>

      {scrollable ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollChart}
        >
          {columns}
        </ScrollView>
      ) : (
        <View style={styles.chart}>{columns}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  caption: typography.caption,
  value: { ...typography.callout, fontWeight: "700" },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: HEIGHT + 22 },
  scrollChart: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: HEIGHT + 22 },
  column: { flex: 1, alignItems: "center", gap: 6 },
  barSlot: { height: HEIGHT, justifyContent: "flex-end", alignSelf: "stretch" },
  baseline: { position: "absolute", bottom: 0, left: 0, right: 0, height: 1 },
  bar: { borderRadius: radii.sm, alignSelf: "stretch", minWidth: 10 },
  tick: { ...typography.caption, fontSize: 10 },
});
