import { useQuery } from "@tanstack/react-query";
import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTelegram } from "../../src/telegram/TelegramProvider";
import { useTheme } from "../../src/theme/useTheme";
import { formatMinor } from "../../src/utils/format";

/** Everything that used to be split across "План" and "Ещё" lives here. */
export default function Account() {
  const theme = useTheme();
  const { isInsideTelegram } = useTelegram();
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiClient.users.me(),
    enabled,
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.accounts.list(),
    enabled,
  });
  const { data: reviewItems } = useQuery({
    queryKey: ["review-inbox"],
    queryFn: () => apiClient.reviewInbox.list(),
    enabled,
  });

  const pendingCount = reviewItems?.length ?? 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: theme.textPrimary }]}>
            {me?.displayName ?? "Личный кабинет"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isInsideTelegram ? "Вход через Telegram" : "Демо-режим"} · {me?.baseCurrency ?? "RUB"}
          </Text>
        </View>

        <Section title="Проверка и импорт" theme={theme}>
          <NavRow
            href="/review-inbox"
            label="Нужно проверить"
            badge={pendingCount > 0 ? String(pendingCount) : undefined}
            theme={theme}
          />
          <NavRow href="/import" label="Импорт выписки" theme={theme} />
        </Section>

        <Section title="Счета" theme={theme}>
          {(accounts ?? []).map((account) => (
            <View key={account.id} style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{account.name}</Text>
              <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
                {formatMinor(account.currentBalanceMinor)} ₽
              </Text>
            </View>
          ))}
          {accounts?.length === 0 ? (
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>Счетов пока нет</Text>
          ) : null}
        </Section>

        <Section title="Скоро" theme={theme}>
          <Text style={[styles.soon, { color: theme.textSecondary }]}>
            Голосовой ввод, регулярные платежи, подписка, экспорт данных и подключение банков
            появятся на следующих этапах.
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

type Theme = ReturnType<typeof useTheme>;

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

function NavRow({
  href,
  label,
  badge,
  theme,
}: {
  href: Href;
  label: string;
  badge?: string;
  theme: Theme;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, styles.navRow])}>
        <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : (
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 20 },
  header: { gap: 4 },
  name: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 12,
  },
  navRow: {},
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 14 },
  chevron: { fontSize: 20 },
  badge: { minWidth: 22, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  soon: { fontSize: 13, paddingVertical: 12, lineHeight: 19 },
});
