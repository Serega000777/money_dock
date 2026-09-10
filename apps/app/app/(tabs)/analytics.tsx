import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, Transaction } from "@money-dock/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTheme } from "../../src/theme/useTheme";
import { BarChart, type Bar } from "../../src/ui/BarChart";
import { Donut, type DonutSlice } from "../../src/ui/Donut";
import { GlowBlob } from "../../src/ui/Gradient";
import { Icon, type IconName } from "../../src/ui/Icon";
import { CustomRangeSheet, MonthPickerSheet, YearPickerSheet } from "../../src/ui/PeriodPicker";
import { Text } from "../../src/ui/Text";
import { categoryColor, categoryIcon } from "../../src/ui/categoryVisual";
import {
  BottomSheet,
  Card,
  FadeIn,
  Pill,
  ProgressBar,
  Screen,
  ScreenTitle,
  Segmented,
} from "../../src/ui/primitives";
import { formatMinor } from "../../src/utils/format";

type Period = "week" | "month" | "year" | "custom";
type CalendarPeriod = "week" | "month" | "year";

interface CategoryTotal extends DonutSlice {
  icon: ReturnType<typeof categoryIcon>;
  share: number;
}

interface Window {
  from: Date;
  to: Date;
  label: string;
}

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];
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
const DAY_MS = 86_400_000;

/**
 * The window being analysed. `offset` counts periods back from the current one, so the
 * arrows walk through history without any extra request — it is all local date math.
 */
function windowFor(period: CalendarPeriod, offset: number): Window {
  const now = new Date();

  if (period === "week") {
    // Monday-based week, like the mockups.
    const weekday = (now.getDay() + 6) % 7;
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday - offset * 7);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    const last = new Date(to.getTime() - DAY_MS);
    const label =
      offset === 0
        ? "Эта неделя"
        : `${from.getDate()} ${MONTHS_SHORT[from.getMonth()]} — ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`;
    return { from, to, label };
  }

  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const name = MONTHS[from.getMonth()] ?? "";
    return {
      from,
      to,
      label: `${name.charAt(0).toUpperCase()}${name.slice(1)} ${from.getFullYear()}`,
    };
  }

  const from = new Date(now.getFullYear() - offset, 0, 1);
  const to = new Date(from.getFullYear() + 1, 0, 1);
  return { from, to, label: String(from.getFullYear()) };
}

function formatRangeLabel(from: Date, toExclusive: Date): string {
  const lastDay = new Date(toExclusive.getTime() - DAY_MS);
  const sameYear = from.getFullYear() === lastDay.getFullYear();
  const fromStr = `${from.getDate()} ${MONTHS_SHORT[from.getMonth()]}${sameYear ? "" : ` ${from.getFullYear()}`}`;
  const toStr = `${lastDay.getDate()} ${MONTHS_SHORT[lastDay.getMonth()]} ${lastDay.getFullYear()}`;
  return `${fromStr} — ${toStr}`;
}

/** Bars: one per day for a week/month or a short custom range, one per month for a year
 * or a long custom range, one per week for a mid-length custom range. */
function buildBars(period: Period, from: Date, to: Date, expenses: Transaction[]): Bar[] {
  if (period === "year") {
    const totals: number[] = new Array(12).fill(0);
    for (const tx of expenses) {
      const month = new Date(tx.occurredAt).getMonth();
      totals[month] = (totals[month] ?? 0) + tx.amountMinor;
    }
    return totals.map((value, month) => ({
      key: `m${month}`,
      label: MONTHS_SHORT[month] ?? "",
      value,
    }));
  }

  const totalDays = Math.round((to.getTime() - from.getTime()) / DAY_MS);

  if (period === "custom" && totalDays > 180) {
    const totals = new Map<string, number>();
    for (const tx of expenses) {
      const d = new Date(tx.occurredAt);
      totals.set(
        `${d.getFullYear()}-${d.getMonth()}`,
        (totals.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0) + tx.amountMinor,
      );
    }
    const bars: Bar[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor.getTime() < to.getTime()) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      bars.push({
        key,
        label: `${MONTHS_SHORT[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
        value: totals.get(key) ?? 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return bars;
  }

  if (period === "custom" && totalDays > 31) {
    const weeks = Math.ceil(totalDays / 7);
    const totals: number[] = new Array(weeks).fill(0);
    for (const tx of expenses) {
      const day = Math.floor((new Date(tx.occurredAt).getTime() - from.getTime()) / DAY_MS);
      const week = Math.floor(day / 7);
      if (week >= 0 && week < weeks) totals[week] = (totals[week] ?? 0) + tx.amountMinor;
    }
    return totals.map((value, index) => {
      const date = new Date(from.getTime() + index * 7 * DAY_MS);
      return {
        key: `w${index}`,
        label: `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`,
        value,
      };
    });
  }

  const totals: number[] = new Array(totalDays).fill(0);
  for (const tx of expenses) {
    const day = Math.floor((new Date(tx.occurredAt).getTime() - from.getTime()) / DAY_MS);
    if (day >= 0 && day < totalDays) totals[day] = (totals[day] ?? 0) + tx.amountMinor;
  }

  return totals.map((value, index) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + index);
    // Daily bars now scroll horizontally at a fixed width, so every one gets its own label.
    const label = period === "week" ? (WEEKDAYS[index] ?? "") : String(date.getDate());
    return { key: `d${index}`, label, value };
  });
}

export default function Analytics() {
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);
  const [picker, setPicker] = useState<"month" | "year" | "custom" | null>(null);
  const [openCategory, setOpenCategory] = useState<CategoryTotal | null>(null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);

  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiClient.transactions.list({ limit: 200 }),
    enabled,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.list(),
    enabled,
  });

  const { current, previous } = useMemo((): { current: Window; previous: Window } => {
    if (period === "custom" && customRange) {
      const span = customRange.to.getTime() - customRange.from.getTime();
      return {
        current: { ...customRange, label: formatRangeLabel(customRange.from, customRange.to) },
        previous: {
          from: new Date(customRange.from.getTime() - span),
          to: customRange.from,
          label: "",
        },
      };
    }
    const calendarPeriod: CalendarPeriod = period === "custom" ? "month" : period;
    return {
      current: windowFor(calendarPeriod, offset),
      previous: windowFor(calendarPeriod, offset + 1),
    };
  }, [period, offset, customRange]);

  // Everything below is derived on the client from data the app already has — switching
  // period or stepping back a month costs no request at all.
  const view = useMemo(() => {
    const all = (transactions ?? []) as Transaction[];
    const byId = new Map((categories ?? []).map((c: Category) => [c.id, c]));

    const inRange = (tx: Transaction, start: Date, end: Date) => {
      const time = new Date(tx.occurredAt).getTime();
      return time >= start.getTime() && time < end.getTime();
    };

    const expenses = all.filter(
      (tx) => tx.type === "expense" && inRange(tx, current.from, current.to),
    );
    const income = all
      .filter((tx) => tx.type === "income" && inRange(tx, current.from, current.to))
      .reduce((sum, tx) => sum + tx.amountMinor, 0);
    const spent = expenses.reduce((sum, tx) => sum + tx.amountMinor, 0);
    const spentBefore = all
      .filter((tx) => tx.type === "expense" && inRange(tx, previous.from, previous.to))
      .reduce((sum, tx) => sum + tx.amountMinor, 0);

    const totals = new Map<string, number>();
    for (const tx of expenses) {
      const key = tx.categoryId ?? "none";
      totals.set(key, (totals.get(key) ?? 0) + tx.amountMinor);
    }

    const breakdown: CategoryTotal[] = [...totals.entries()]
      .map(([id, value]) => {
        const category = byId.get(id);
        return {
          id,
          label: category?.name ?? "Без категории",
          value,
          share: spent > 0 ? value / spent : 0,
          color: categoryColor(category),
          icon: categoryIcon(category),
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      spent,
      income,
      changePercent: spentBefore > 0 ? ((spent - spentBefore) / spentBefore) * 100 : null,
      breakdown,
      bars: buildBars(period, current.from, current.to, expenses),
      expenses,
    };
  }, [transactions, categories, period, current, previous]);

  const daysElapsed = Math.max(
    1,
    Math.ceil((Math.min(Date.now(), current.to.getTime()) - current.from.getTime()) / DAY_MS),
  );
  const perDay = Math.round(view.spent / daysElapsed);
  const now = new Date();

  return (
    <Screen>
      <ScreenTitle title="Аналитика" subtitle="Куда уходят деньги" />

      <FadeIn index={1}>
        <Segmented<Period>
          value={period}
          onChange={(next) => {
            if (next === "custom") {
              setPicker("custom");
              return;
            }
            setPeriod(next);
            setOffset(0);
          }}
          options={[
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" },
            { value: "year", label: "Год" },
            { value: "custom", label: "Свой период" },
          ]}
        />
      </FadeIn>

      {/* Period stepper — the same "‹ Сентябрь 2026 ›" control the mockups use. Tapping
          the label itself opens a direct month/year picker instead of only stepping. */}
      <FadeIn index={2}>
        <View style={styles.stepper}>
          {period !== "custom" ? (
            <Pressable
              onPress={() => setOffset(offset + 1)}
              accessibilityLabel="Предыдущий период"
              style={[
                styles.stepButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Icon name="chevronLeft" color={theme.textPrimary} size={18} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              if (period === "month") setPicker("month");
              else if (period === "year") setPicker("year");
              else if (period === "custom") setPicker("custom");
            }}
            style={styles.stepLabelWrap}
          >
            <Text style={[styles.stepLabel, { color: theme.textPrimary }]}>{current.label}</Text>
            {period === "month" || period === "year" || period === "custom" ? (
              <View style={styles.dropdownHint}>
                <Icon name="chevron" color={theme.textTertiary} size={12} strokeWidth={2.4} />
              </View>
            ) : null}
          </Pressable>

          {period !== "custom" ? (
            <Pressable
              onPress={() => offset > 0 && setOffset(offset - 1)}
              accessibilityLabel="Следующий период"
              style={[
                styles.stepButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: offset > 0 ? 1 : 0.4,
                },
              ]}
            >
              <Icon name="chevron" color={theme.textPrimary} size={18} />
            </Pressable>
          ) : null}
        </View>
      </FadeIn>

      {/* Same shape as the home screen's account cards, per the reference: label on top,
          a big bold figure at the bottom, and a soft corner glow instead of a flat fill. */}
      <FadeIn index={3}>
        <View style={styles.row}>
          <Card style={styles.tile}>
            <GlowBlob top="-30%" left="50%" size={140} color="#913AFF" opacity={0.35} />
            <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Расходы</Text>
            <Text style={[styles.tileValue, { color: theme.textPrimary }]} numberOfLines={1}>
              {formatMinor(view.spent)} ₽
            </Text>
            {view.changePercent !== null ? (
              <Pill
                label={`${view.changePercent > 0 ? "+" : ""}${Math.round(view.changePercent)}% к прошлому`}
                color={view.changePercent > 0 ? theme.negative : theme.positive}
                background={view.changePercent > 0 ? theme.negativeSoft : theme.positiveSoft}
              />
            ) : null}
          </Card>

          <Card style={styles.tile}>
            <GlowBlob top="-30%" left="50%" size={140} color="#FF2BC7" opacity={0.3} />
            <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Доходы</Text>
            <Text style={[styles.tileValue, { color: theme.textPrimary }]} numberOfLines={1}>
              {formatMinor(view.income)} ₽
            </Text>
            <Text style={[styles.tileHint, { color: theme.textTertiary }]}>
              {perDay > 0 ? `≈ ${formatMinor(perDay)} ₽ в день` : " "}
            </Text>
          </Card>
        </View>
      </FadeIn>

      {view.spent > 0 ? (
        <FadeIn index={4}>
          <Card>
            <BarChart bars={view.bars} accent={theme.accent} />
          </Card>
        </FadeIn>
      ) : null}

      {view.breakdown.length > 0 ? (
        <FadeIn index={5}>
          <Card style={styles.donutCard}>
            <Donut slices={view.breakdown} caption={current.label.toLowerCase()} />
          </Card>
        </FadeIn>
      ) : null}

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>По категориям</Text>

      {view.breakdown.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Пока нет расходов за этот период
        </Text>
      ) : (
        <Card style={styles.listCard}>
          {view.breakdown.map((item, i) => (
            <FadeIn key={item.id} index={Math.min(i, 6)}>
              <Pressable style={styles.breakdownRow} onPress={() => setOpenCategory(item)}>
                <View style={styles.breakdownHeader}>
                  <View style={[styles.dot, { backgroundColor: `${item.color}1F` }]}>
                    <Icon name={item.icon} color={item.color} size={16} />
                  </View>
                  <Text
                    style={[styles.breakdownName, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <Text style={[styles.breakdownShare, { color: theme.textSecondary }]}>
                    {Math.round(item.share * 100)}%
                  </Text>
                  <Text style={[styles.breakdownAmount, { color: theme.textPrimary }]}>
                    {formatMinor(item.value)} ₽
                  </Text>
                  <Icon name="chevron" color={theme.textTertiary} size={14} />
                </View>
                <ProgressBar share={item.share} color={item.color} />
              </Pressable>
            </FadeIn>
          ))}
        </Card>
      )}

      <BottomSheet
        visible={openCategory !== null}
        onClose={() => setOpenCategory(null)}
        title={openCategory?.label}
      >
        {openCategory ? (
          <CategoryTransactions
            transactions={view.expenses.filter(
              (tx) => (tx.categoryId ?? "none") === openCategory.id,
            )}
            color={openCategory.color}
            icon={openCategory.icon}
          />
        ) : null}
      </BottomSheet>

      {picker === "month" ? (
        <MonthPickerSheet
          visible
          onClose={() => setPicker(null)}
          initialYear={current.from.getFullYear()}
          initialMonth={current.from.getMonth()}
          maxDate={now}
          onSelect={(year, month) => {
            setOffset(now.getFullYear() * 12 + now.getMonth() - (year * 12 + month));
            setPeriod("month");
            setPicker(null);
          }}
        />
      ) : null}

      {picker === "year" ? (
        <YearPickerSheet
          visible
          onClose={() => setPicker(null)}
          initialYear={current.from.getFullYear()}
          maxYear={now.getFullYear()}
          onSelect={(year) => {
            setOffset(now.getFullYear() - year);
            setPeriod("year");
            setPicker(null);
          }}
        />
      ) : null}

      {picker === "custom" ? (
        <CustomRangeSheet
          visible
          onClose={() => setPicker(null)}
          maxDate={now}
          initialFrom={period === "custom" ? current.from : undefined}
          initialTo={period === "custom" ? current.to : undefined}
          onApply={(from, to) => {
            setCustomRange({ from, to });
            setPeriod("custom");
            setPicker(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

/** The BottomSheet's body for a tapped category — every expense in it for the current
 * period, newest first, plain rows sharing one scroll (no per-row card). */
function CategoryTransactions({
  transactions,
  color,
  icon,
}: {
  transactions: Transaction[];
  color: string;
  icon: IconName;
}) {
  const theme = useTheme();
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <Text style={[styles.categoryEmpty, { color: theme.textSecondary }]}>
        В этой категории пока нет трат за период
      </Text>
    );
  }

  return (
    <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
      {sorted.map((tx, index) => (
        <View key={tx.id}>
          {index > 0 ? (
            <View style={[styles.categoryDivider, { backgroundColor: theme.border }]} />
          ) : null}
          <View style={styles.categoryRow}>
            <View style={[styles.dot, { backgroundColor: `${color}1F` }]}>
              <Icon name={icon} color={color} size={16} />
            </View>
            <View style={styles.categoryRowMain}>
              <Text
                style={[styles.categoryMerchant, { color: theme.textPrimary }]}
                numberOfLines={1}
              >
                {tx.merchant ?? "Без описания"}
              </Text>
              <Text style={[styles.categoryDate, { color: theme.textSecondary }]}>
                {new Date(tx.occurredAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                })}
              </Text>
            </View>
            <Text style={[styles.categoryAmount, { color: theme.textPrimary }]}>
              −{formatMinor(tx.amountMinor)} ₽
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "center",
  },
  stepLabel: typography.headline,
  dropdownHint: { transform: [{ rotate: "90deg" }] },
  row: { flexDirection: "row", gap: spacing.md },
  tile: { flex: 1, gap: spacing.xs, paddingVertical: spacing.lg, overflow: "hidden" },
  tileLabel: { ...typography.caption, fontSize: 13 },
  tileValue: { ...typography.display, fontSize: 23, letterSpacing: -0.8, fontWeight: "800" },
  tileHint: typography.caption,
  donutCard: { paddingVertical: spacing.xl },
  sectionTitle: { ...typography.headline, marginTop: spacing.md },
  listCard: { gap: spacing.lg },
  breakdownRow: { gap: spacing.sm },
  breakdownHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownName: { ...typography.body, flex: 1 },
  breakdownShare: { ...typography.caption, fontWeight: "600" },
  breakdownAmount: { ...typography.body, fontWeight: "600" },
  empty: typography.body,

  categoryList: { maxHeight: 420 },
  categoryEmpty: { ...typography.body, textAlign: "center", paddingVertical: spacing.xl },
  categoryDivider: { height: StyleSheet.hairlineWidth, marginLeft: 28 + spacing.md },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  categoryRowMain: { flex: 1, gap: 2 },
  categoryMerchant: typography.body,
  categoryDate: typography.caption,
  categoryAmount: { ...typography.body, fontWeight: "600" },
});
