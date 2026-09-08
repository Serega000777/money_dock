import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useTheme } from "../theme/useTheme";

import { Icon } from "./Icon";
import { Text } from "./Text";
import { BottomSheet, PressableScale } from "./primitives";

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function sameYearMonth(year: number, month: number, max: Date): boolean {
  return year === max.getFullYear() && month === max.getMonth();
}
function afterMax(year: number, month: number, max: Date): boolean {
  return year > max.getFullYear() || (year === max.getFullYear() && month > max.getMonth());
}

/** Year header + 12-month grid — picks a month directly instead of stepping one at a time. */
export function MonthPickerSheet({
  visible,
  onClose,
  initialYear,
  initialMonth,
  maxDate,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  initialYear: number;
  initialMonth: number;
  maxDate: Date;
  onSelect: (year: number, month: number) => void;
}) {
  const theme = useTheme();
  const [year, setYear] = useState(initialYear);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Выбор месяца">
      <View style={styles.yearHeader}>
        <Pressable
          onPress={() => setYear(year - 1)}
          accessibilityLabel="Предыдущий год"
          style={[styles.yearButton, { borderColor: theme.border }]}
        >
          <Icon name="chevronLeft" color={theme.textPrimary} size={16} />
        </Pressable>
        <Text style={[styles.yearLabel, { color: theme.textPrimary }]}>{year}</Text>
        <Pressable
          onPress={() => year < maxDate.getFullYear() && setYear(year + 1)}
          accessibilityLabel="Следующий год"
          style={[
            styles.yearButton,
            { borderColor: theme.border, opacity: year < maxDate.getFullYear() ? 1 : 0.35 },
          ]}
        >
          <Icon name="chevron" color={theme.textPrimary} size={16} />
        </Pressable>
      </View>

      <View style={styles.monthGrid}>
        {MONTHS_SHORT.map((label, month) => {
          const disabled = afterMax(year, month, maxDate);
          const current = sameYearMonth(year, month, maxDate);
          const active = year === initialYear && month === initialMonth;
          return (
            <Pressable
              key={label}
              disabled={disabled}
              onPress={() => onSelect(year, month)}
              style={[
                styles.monthCell,
                {
                  backgroundColor: active ? theme.accent : theme.surfaceSunken,
                  opacity: disabled ? 0.3 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.monthText,
                  { color: active ? theme.onAccent : theme.textPrimary },
                  current && !active ? { color: theme.accent } : null,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

/** Straight list of years — faster than stepping a year at a time through history. */
export function YearPickerSheet({
  visible,
  onClose,
  initialYear,
  maxYear,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  initialYear: number;
  maxYear: number;
  onSelect: (year: number) => void;
}) {
  const theme = useTheme();
  const years = Array.from({ length: 10 }, (_, i) => maxYear - i);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Выбор года">
      <ScrollView style={styles.yearList}>
        {years.map((year) => {
          const active = year === initialYear;
          return (
            <Pressable
              key={year}
              onPress={() => onSelect(year)}
              style={[styles.yearRow, active && { backgroundColor: theme.surfaceSunken }]}
            >
              <Text
                style={[
                  styles.yearRowText,
                  { color: active ? theme.accent : theme.textPrimary },
                  active && { fontWeight: "700" },
                ]}
              >
                {year}
              </Text>
              {active ? <Icon name="check" color={theme.accent} size={18} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
/** Monday-first weekday index for the 1st of the month (0 = Monday). */
function startWeekday(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Tap a start day, then an end day — the range between fills in as you go. "Применить"
 * turns the picked days into an exclusive `[from, to)` window for the analytics query.
 */
export function CustomRangeSheet({
  visible,
  onClose,
  maxDate,
  initialFrom,
  initialTo,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  maxDate: Date;
  initialFrom?: Date;
  initialTo?: Date;
  onApply: (from: Date, toExclusive: Date) => void;
}) {
  const theme = useTheme();
  const max = startOfDay(maxDate);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = initialTo ?? initialFrom ?? max;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [rangeStart, setRangeStart] = useState<Date | null>(initialFrom ? startOfDay(initialFrom) : null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(
    initialTo ? startOfDay(new Date(initialTo.getTime() - 1)) : null,
  );

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const canGoNext = year < max.getFullYear() || (year === max.getFullYear() && month < max.getMonth());
  const offset = startWeekday(year, month);
  const total = daysInMonth(year, month);
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => new Date(year, month, i + 1)),
  ];

  function pickDay(day: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
      return;
    }
    if (day.getTime() < rangeStart.getTime()) {
      setRangeStart(day);
    } else {
      setRangeEnd(day);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Свой период">
      <View style={styles.yearHeader}>
        <Pressable
          onPress={() => setViewMonth(new Date(year, month - 1, 1))}
          accessibilityLabel="Предыдущий месяц"
          style={[styles.yearButton, { borderColor: theme.border }]}
        >
          <Icon name="chevronLeft" color={theme.textPrimary} size={16} />
        </Pressable>
        <Text style={[styles.yearLabel, { color: theme.textPrimary }]}>
          {MONTHS_SHORT[month]} {year}
        </Text>
        <Pressable
          onPress={() => canGoNext && setViewMonth(new Date(year, month + 1, 1))}
          accessibilityLabel="Следующий месяц"
          style={[styles.yearButton, { borderColor: theme.border, opacity: canGoNext ? 1 : 0.35 }]}
        >
          <Icon name="chevron" color={theme.textPrimary} size={16} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.weekdayLabel, { color: theme.textTertiary }]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.dayGrid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`empty${i}`} style={styles.dayCell} />;
          const disabled = day.getTime() > max.getTime();
          const isStart = rangeStart ? sameDay(day, rangeStart) : false;
          const isEnd = rangeEnd ? sameDay(day, rangeEnd) : false;
          const inRange =
            rangeStart && rangeEnd && day.getTime() > rangeStart.getTime() && day.getTime() < rangeEnd.getTime();
          const edge = isStart || isEnd;
          return (
            <Pressable
              key={day.toISOString()}
              disabled={disabled}
              onPress={() => pickDay(day)}
              style={styles.dayCell}
            >
              <View
                style={[
                  styles.daySpan,
                  inRange ? { backgroundColor: theme.accentSoft } : null,
                  isStart ? { backgroundColor: theme.accentSoft, borderTopLeftRadius: radii.pill, borderBottomLeftRadius: radii.pill } : null,
                  isEnd ? { backgroundColor: theme.accentSoft, borderTopRightRadius: radii.pill, borderBottomRightRadius: radii.pill } : null,
                ]}
              >
                <View
                  style={[
                    styles.dayInner,
                    edge && { backgroundColor: theme.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: edge ? theme.onAccent : disabled ? theme.textTertiary : theme.textPrimary },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <PressableScale
        disabled={!rangeStart || !rangeEnd}
        onPress={() => {
          if (!rangeStart || !rangeEnd) return;
          onApply(rangeStart, new Date(rangeEnd.getTime() + 86_400_000));
        }}
        style={StyleSheet.flatten([
          styles.applyButton,
          { backgroundColor: rangeStart && rangeEnd ? theme.accent : theme.surfaceSunken },
        ])}
      >
        <Text
          style={[
            styles.applyText,
            { color: rangeStart && rangeEnd ? theme.onAccent : theme.textTertiary },
          ]}
        >
          {rangeStart && !rangeEnd ? "Выберите конец периода" : "Применить"}
        </Text>
      </PressableScale>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  yearHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  yearButton: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  yearLabel: { ...typography.headline, textTransform: "capitalize" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  monthCell: {
    width: "30%",
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
  },
  monthText: { ...typography.callout, fontWeight: "600", textTransform: "capitalize" },

  yearList: { maxHeight: 340 },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  yearRowText: typography.body,

  weekdayRow: { flexDirection: "row" },
  weekdayLabel: { ...typography.caption, width: `${100 / 7}%`, textAlign: "center" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.lg },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  daySpan: { width: "100%", height: "78%", alignItems: "center", justifyContent: "center" },
  dayInner: {
    width: "78%",
    height: "100%",
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: typography.callout,

  applyButton: { borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center" },
  applyText: { ...typography.callout, fontWeight: "700" },
});
