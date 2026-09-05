import type { Category, Transaction } from "@money-dock/shared-types";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../src/api/client";
import { useAuthStore } from "../src/auth/authStore";
import { useTheme } from "../src/theme/useTheme";
import { formatMinor } from "../src/utils/format";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export default function Transactions() {
  const theme = useTheme();
  const accessToken = useAuthStore((state) => state.accessToken);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiClient.transactions.list({ limit: 100 }),
    enabled: Boolean(accessToken),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.list(),
    enabled: Boolean(accessToken),
  });

  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c: Category) => [c.id, c.name])),
    [categories],
  );

  function subtitle(item: Transaction): string {
    const parts = [formatDay(item.occurredAt)];
    const categoryName = item.categoryId ? categoryNames.get(item.categoryId) : undefined;
    if (categoryName) parts.push(categoryName);
    else if (item.type !== "transfer") parts.push("Без категории");
    if (item.type === "transfer") parts.push("Перевод");
    return parts.join(" · ");
  }

  function amountColor(item: Transaction): string {
    if (item.type === "income") return theme.positive;
    if (item.type === "transfer") return theme.textSecondary;
    return theme.textPrimary;
  }

  function amountText(item: Transaction): string {
    const sign = item.type === "income" ? "+" : item.type === "expense" ? "−" : "";
    return `${sign}${formatMinor(item.amountMinor)} ₽`;
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: true, title: "Операции" }} />

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={theme.accent} />
      ) : (
        <FlatList
          data={transactions ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Операций пока нет</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={[styles.merchant, { color: theme.textPrimary }]} numberOfLines={1}>
                  {item.merchant ?? "Без описания"}
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {subtitle(item)}
                </Text>
              </View>
              <Text style={[styles.amount, { color: amountColor(item) }]}>{amountText(item)}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { marginTop: 32 },
  list: { paddingHorizontal: 20, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowMain: { flex: 1, gap: 2 },
  merchant: { fontSize: 15, fontWeight: "500" },
  meta: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: "600" },
  separator: { height: StyleSheet.hairlineWidth },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
