import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, Transaction } from "@money-dock/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTheme } from "../../src/theme/useTheme";
import { BarChart, type Bar } from "../../src/ui/BarChart";
import { Donut, type DonutSlice } from "../../src/ui/Donut";
import { Icon } from "../../src/ui/Icon";
import { Text } from "../../src/ui/Text";
import { categoryColor, categoryIcon } from "../../src/ui/categoryVisual";
import {
  Card,
  FadeIn,
  Pill,
  ProgressBar,
  Screen,
  ScreenTitle,
  Segmented,
} from "../../src/ui/primitives";
import { formatMinor } from "../../src/utils/format";

type Period = "week" | "month" | "year";

interface CategoryTotal extends DonutSlice {
  icon: ReturnType<typeof categoryIcon>;
  share: number;
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

/**
 * The window being analysed. `offset` counts periods back from the current one, so the
 * arrows walk through history without any extra request — it is all local date math.
 */
function windowFor(period: Period, offset: number): { from: Date; to: Date; label: string } {
  const now = new Date();

  if (period === "week") {
    // Monday-based week, like the mockups.
    const weekday = (now.getDay() + 6) % 7;
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday - offset * 7);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    const last = new Date(to.getTime() - 86_400_000);
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

/** Bars: one per day for a week or month, one per month for a year. */
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

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const totals: number[] = new Array(days).fill(0);
  for (const tx of expenses) {
    const day = Math.floor((new Date(tx.occurredAt).getTime() - from.getTime()) / 86_400_000);
    if (day >= 0 && day < days) totals[day] = (totals[day] ?? 0) + tx.amountMinor;
  }

  return totals.map((value, index) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + index);
    // A month has 30 bars — labelling every one turns the axis into noise, so only
    // every seventh day gets a tick.
    const label =
      period === "week" ? (WEEKDAYS[index] ?? "") : index % 7 === 0 ? String(date.getDate()) : "";
    return { key: `d${index}`, label, value };
  });
}

export default function Analytics() {
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);
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

  const current = useMemo(() => windowFor(period, offset), [period, offset]);
  const previous = useMemo(() => windowFor(period, offset + 1), [period, offset]);

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
          color: categoryColor(category?.systemCode ?? category?.id ?? null),
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
    };
  }, [transactions, categories, period, current, previous]);

  const daysElapsed = Math.max(
    1,
    Math.ceil((Math.min(Date.now(), current.to.getTime()) - current.from.getTime()) / 86_400_000),
  );
  const perDay = Math.round(view.spent / daysElapsed);

  return (
    <Screen>
      <ScreenTitle title="Аналитика" subtitle="Куда уходят деньги" />

      <FadeIn index={1}>
        <Segmented<Period>
          value={period}
          onChange={(next) => {
            setPeriod(next);
            setOffset(0);
          }}
          options={[
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" },
            { value: "year", label: "Год" },
          ]}
        />
      </FadeIn>

      {/* Period stepper — the same "‹ Сентябрь 2026 ›" control the mockups use. */}
      <FadeIn index={2}>
        <View style={styles.stepper}>
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
          <Text style={[styles.stepLabel, { color: theme.textPrimary }]}>{current.label}</Text>
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
        </View>
      </FadeIn>

      <FadeIn index={3}>
        <View style={styles.row}>
          <Card style={styles.tile}>
            <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Расходы</Text>
            <Text style={[styles.tileValue, { color: theme.textPrimary }]}>
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
            <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Доходы</Text>
            <Text style={[styles.tileValue, { color: theme.textPrimary }]}>
              {formatMinor(view.income)} ₽
            </Text>
            <Text style={[styles.tileHint, { color: theme.textTertiary }]}>
              {perDay > 0 ? `≈ ${formatMinor(perDay)} ₽ в день тратится` : " "}
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
            <FadeIn key={item.id} index={Math.min(i, 6)} style={styles.breakdownRow}>
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
              </View>
              <ProgressBar share={item.share} color={item.color} />
            </FadeIn>
          ))}
        </Card>
      )}
    </Screen>
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
  stepLabel: typography.headline,
  row: { flexDirection: "row", gap: spacing.md },
  tile: { flex: 1, gap: spacing.xs, paddingVertical: spacing.lg },
  tileLabel: typography.caption,
  tileValue: typography.title,
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
});
