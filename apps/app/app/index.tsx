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

  const greetingName = user?.first_name ?? "гость";
  const totalBalanceMinor = accounts?.reduce((sum, a) => sum + a.currentBalanceMinor, 0) ?? null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Text style={[styles.greeting, { color: theme.textSecondary }]}>Привет, {greetingName}</Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>На счетах</Text>
        <Text style={[styles.amount, { color: theme.textPrimary }]}>
          {totalBalanceMinor !== null ? `${formatMinor(totalBalanceMinor)} ₽` : "—"}
        </Text>
        <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
          {accessToken ? `Счетов: ${accounts?.length ?? 0}` : "Появится после подключения счетов"}
        </Text>
      </View>

      {accessToken && accounts && accounts.length > 0 ? (
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
  addButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  addButtonText: { color: "#fff", fontWeight: "600" },
  status: { fontSize: 12, marginTop: "auto" },
});
