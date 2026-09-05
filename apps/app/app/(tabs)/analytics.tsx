import type { Category, Transaction } from "@money-dock/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTheme } from "../../src/theme/useTheme";
import { formatMinor } from "../../src/utils/format";

interface CategoryTotal {
  id: string;
  name: string;
  amountMinor: number;
  share: number;
}

export default function Analytics() {
  const theme = useTheme();
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);

  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => apiClient.analytics.summary(),
    enabled,
  });
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

  // Category breakdown is derived on the client from data already fetched — no extra
  // endpoint and no extra query for a view this small.
  const breakdown = useMemo<CategoryTotal[]>(() => {
    if (!transactions || !categories) return [];
    const names = new Map(categories.map((c: Category) => [c.id, c.name]));
    const totals = new Map<string, number>();

    for (const tx of transactions as Transaction[]) {
      if (tx.type !== "expense") continue; // transfers and income never count as spending
      const key = tx.categoryId ?? "none";
      totals.set(key, (totals.get(key) ?? 0) + tx.amountMinor);
    }

    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .map(([id, amountMinor]) => ({
        id,
        name: id === "none" ? "Без категории" : (names.get(id) ?? "Без категории"),
        amountMinor,
        share: sum > 0 ? amountMinor / sum : 0,
      }))
      .sort((a, b) => b.amountMinor - a.amountMinor);
  }, [transactions, categories]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Аналитика</Text>

        <View style={styles.row}>
          <View
            style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Расходы за месяц</Text>
            <Text style={[styles.tileValue, { color: theme.textPrimary }]}>
              {summary ? `${formatMinor(summary.currentMonthExpenseMinor)} ₽` : "—"}
            </Text>
            {summary?.expenseChangePercent != null ? (
              <Text
                style={[
                  styles.tileHint,
                  {
                    color: summary.expenseChangePercent > 0 ? theme.negative : theme.positive,
                  },
                ]}
              >
                {summary.expenseChangePercent > 0 ? "+" : ""}
                {Math.round(summary.expenseChangePercent)}% к прошлому месяцу
              </Text>
            ) : null}
          </View>

          <View
            style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Доходы за месяц</Text>
            <Text style={[styles.tileValue, { color: theme.textPrimary }]}>
              {summary ? `${formatMinor(summary.currentMonthIncomeMinor)} ₽` : "—"}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Куда уходят деньги</Text>

        {breakdown.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>
            Пока нет расходов для анализа
          </Text>
        ) : (
          breakdown.map((item) => (
            <View key={item.id} style={styles.breakdownRow}>
              <View style={styles.breakdownHeader}>
                <Text
                  style={[styles.breakdownName, { color: theme.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={[styles.breakdownAmount, { color: theme.textPrimary }]}>
                  {formatMinor(item.amountMinor)} ₽
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.barFill,
                    { backgroundColor: theme.accent, width: `${Math.max(2, item.share * 100)}%` },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  row: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  tileLabel: { fontSize: 12 },
  tileValue: { fontSize: 20, fontWeight: "700" },
  tileHint: { fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  breakdownRow: { gap: 6 },
  breakdownHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  breakdownName: { fontSize: 14, flex: 1 },
  breakdownAmount: { fontSize: 14, fontWeight: "600" },
  barTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 999 },
  empty: { fontSize: 14 },
});
