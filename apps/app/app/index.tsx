import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../src/api/client";
import { useAuthStore } from "../src/auth/authStore";
import { useTelegram } from "../src/telegram/TelegramProvider";
import { useTheme } from "../src/theme/useTheme";

function formatMinor(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("ru-RU", { minimumFractionDigits: 0 });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

export default function Home() {
  const theme = useTheme();
  const { user, isInsideTelegram } = useTelegram();
  const accessToken = useAuthStore((state) => state.accessToken);

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.health(),
    retry: false,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.accounts.list(),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => apiClient.analytics.summary(),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const hasAccounts = Boolean(accounts && accounts.length > 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Text style={[styles.greeting, { color: theme.textSecondary }]}>
        {greeting()}
        {user?.first_name ? `, ${user.first_name}` : ""}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
          Можно безопасно потратить
        </Text>
        <Text style={[styles.amount, { color: theme.textPrimary }]}>
          {summary ? `${formatMinor(summary.safeToSpendPerDayMinor)} ₽` : "—"}
        </Text>
        <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
          {summary ? "в день до конца месяца" : "Появится после подключения счетов"}
        </Text>
      </View>

      {summary ? (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>На счетах</Text>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>
              {formatMinor(summary.totalBalanceMinor)} ₽
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Прогноз на конец месяца
            </Text>
            <Text
              style={[
                styles.statValue,
                { color: summary.monthEndForecastMinor < 0 ? theme.negative : theme.textPrimary },
              ]}
            >
              {formatMinor(summary.monthEndForecastMinor)} ₽
            </Text>
          </View>
        </View>
      ) : null}

      {summary && summary.todayExpenseMinor > 0 ? (
        <Text style={[styles.today, { color: theme.textSecondary }]}>
          Сегодня потрачено: {formatMinor(summary.todayExpenseMinor)} ₽
          {summary.expenseChangePercent !== null
            ? summary.expenseChangePercent >= 0
              ? ` · на ${Math.round(summary.expenseChangePercent)}% больше обычного`
              : ` · на ${Math.round(-summary.expenseChangePercent)}% меньше обычного`
            : ""}
        </Text>
      ) : null}

      {hasAccounts ? (
        <Link href="/add-transaction" asChild>
          <Pressable style={[styles.addButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.addButtonText}>Добавить операцию</Text>
          </Pressable>
        </Link>
      ) : null}

      <Text style={[styles.status, { color: theme.textSecondary }]}>
        {isInsideTelegram ? "Открыто в Telegram" : "Демо-режим (вне Telegram)"}
        {accessToken ? " · вход выполнен" : ""} · API: {health?.status ?? "…"}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16 },
  greeting: { fontSize: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 6 },
  cardLabel: { fontSize: 14 },
  amount: { fontSize: 34, fontWeight: "700" },
  cardHint: { fontSize: 13 },
  statsRow: { flexDirection: "row", gap: 12 },
  statItem: { flex: 1, gap: 4 },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 18, fontWeight: "600" },
  today: { fontSize: 13 },
  addButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  addButtonText: { color: "#fff", fontWeight: "600" },
  status: { fontSize: 12, marginTop: "auto" },
});
