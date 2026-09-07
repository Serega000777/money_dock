import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, Transaction } from "@money-dock/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTheme } from "../../src/theme/useTheme";
import { Card, FadeIn } from "../../src/ui/primitives";
import { formatMinor } from "../../src/utils/format";

/** "сегодня" / "вчера" read faster than a date for the two days people actually check. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return "Сегодня";
  if (days === 1) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export default function Transactions() {
  const theme = useTheme();
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiClient.transactions.list({ limit: 200 }),
    enabled,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.list(),
    enabled,
  });

  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c: Category) => [c.id, c.name])),
    [categories],
  );

  // Grouping by day turns a flat wall of rows into something scannable.
  const sections = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const tx of (transactions ?? []) as Transaction[]) {
      const key = tx.occurredAt.slice(0, 10);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(tx);
      else byDay.set(key, [tx]);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, data]) => ({
        title: dayLabel(day),
        total: data.reduce(
          (sum, t) =>
            sum + (t.type === "expense" ? -t.amountMinor : t.type === "income" ? t.amountMinor : 0),
          0,
        ),
        data,
      }));
  }, [transactions]);

  function meta(item: Transaction): string {
    if (item.type === "transfer") return "Перевод между счетами";
    const name = item.categoryId ? categoryNames.get(item.categoryId) : undefined;
    return name ?? "Без категории";
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Операции</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={theme.accent} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Операций пока нет. Добавьте первую — голосом или вручную.
            </Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionTotal, { color: theme.textTertiary }]}>
                {section.total > 0 ? "+" : ""}
                {formatMinor(section.total)} ₽
              </Text>
            </View>
          )}
          renderSectionFooter={() => <View style={styles.sectionGap} />}
          renderItem={({ item, index, section }) => (
            <FadeIn index={Math.min(index, 6)}>
              <Card
                style={StyleSheet.flatten([
                  styles.row,
                  index === 0 && styles.rowFirst,
                  index === section.data.length - 1 && styles.rowLast,
                  index !== section.data.length - 1 && styles.rowMiddle,
                ])}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        item.type === "income"
                          ? theme.positiveSoft
                          : item.type === "transfer"
                            ? theme.surfaceSunken
                            : theme.accentSoft,
                    },
                  ]}
                />
                <View style={styles.rowMain}>
                  <Text style={[styles.merchant, { color: theme.textPrimary }]} numberOfLines={1}>
                    {item.merchant ?? "Без описания"}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {meta(item)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.amount,
                    {
                      color:
                        item.type === "income"
                          ? theme.positive
                          : item.type === "transfer"
                            ? theme.textSecondary
                            : theme.textPrimary,
                    },
                  ]}
                >
                  {item.type === "income" ? "+" : item.type === "expense" ? "−" : ""}
                  {formatMinor(item.amountMinor)} ₽
                </Text>
              </Card>
            </FadeIn>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  title: typography.display,
  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  sectionTitle: { ...typography.overline, textTransform: "uppercase" },
  sectionTotal: typography.caption,
  sectionGap: { height: spacing.lg },

  // Rows in a day share one continuous card, squared off where they meet.
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowFirst: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  rowMiddle: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  rowLast: { borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
  rowMain: { flex: 1, gap: 2 },
  merchant: typography.body,
  meta: typography.caption,
  amount: { ...typography.body, fontWeight: "600" },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.xxl },
});
