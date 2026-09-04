import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../src/api/client";
import { useTelegram } from "../src/telegram/TelegramProvider";
import { useTheme } from "../src/theme/useTheme";

export default function Home() {
  const theme = useTheme();
  const { user, isInsideTelegram } = useTelegram();
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.health(),
    retry: false,
  });

  const greetingName = user?.first_name ?? "гость";

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Text style={[styles.greeting, { color: theme.textSecondary }]}>Привет, {greetingName}</Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
          Можно безопасно потратить
        </Text>
        <Text style={[styles.amount, { color: theme.textPrimary }]}>—</Text>
        <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
          Появится после подключения счетов
        </Text>
      </View>

      <Text style={[styles.status, { color: theme.textSecondary }]}>
        {isInsideTelegram ? "Открыто в Telegram" : "Демо-режим (вне Telegram)"} · API:{" "}
        {health?.status ?? "…"}
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
  status: { fontSize: 12, marginTop: "auto" },
});
