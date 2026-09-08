import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, Transaction } from "@money-dock/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, SectionList, StyleSheet, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTheme } from "../../src/theme/useTheme";
import { Icon } from "../../src/ui/Icon";
import { Text } from "../../src/ui/Text";
import { categoryColor, categoryIcon } from "../../src/ui/categoryVisual";
import { Card, FadeIn, Screen, ScreenTitle } from "../../src/ui/primitives";
import { formatMinor } from "../../src/utils/format";

/** "Сегодня" / "Вчера" read faster than a date for the two days people actually check. */
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

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c: Category) => [c.id, c])),
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

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <ScreenTitle title="Операции" subtitle="История по дням" />
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
            <Text style={[styles.empty, { color: theme.onGradientSecondary }]}>
              Операций пока нет. Добавьте первую — голосом или вручную.
            </Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.onGradientSecondary }]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionTotal, { color: theme.onGradientSecondary }]}>
                {section.total > 0 ? "+" : ""}
                {formatMinor(section.total)} ₽
              </Text>
            </View>
          )}
          renderSectionFooter={() => <View style={styles.sectionGap} />}
          renderItem={({ item, index, section }) => {
            const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
            const transfer = item.type === "transfer";
            const income = item.type === "income";
            const tint = transfer
              ? theme.textSecondary
              : income
                ? theme.positive
                : categoryColor(category?.systemCode ?? category?.id ?? null);

            return (
              <FadeIn index={Math.min(index, 6)}>
                <Card
                  style={StyleSheet.flatten([
                    styles.row,
                    index === 0 && styles.rowFirst,
                    index === section.data.length - 1 && styles.rowLast,
                    index !== section.data.length - 1 && styles.rowMiddle,
                  ])}
                >
                  <View style={[styles.avatar, { backgroundColor: `${tint}1F` }]}>
                    <Icon
                      name={transfer ? "card" : income ? "wallet" : categoryIcon(category)}
                      color={tint}
                      size={19}
                    />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={[styles.merchant, { color: theme.textPrimary }]} numberOfLines={1}>
                      {item.merchant ?? "Без описания"}
                    </Text>
                    <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {transfer ? "Перевод между счетами" : (category?.name ?? "Без категории")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.amount,
                      {
                        color: income
                          ? theme.positive
                          : transfer
                            ? theme.textSecondary
                            : theme.textPrimary,
                      },
                    ]}
                  >
                    {income ? "+" : item.type === "expense" ? "−" : ""}
                    {formatMinor(item.amountMinor)} ₽
                  </Text>
                </Card>
              </FadeIn>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

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
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: { flex: 1, gap: 2 },
  merchant: typography.body,
  meta: typography.caption,
  amount: { ...typography.body, fontWeight: "600" },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.xxl },
});
