import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { Link, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTelegram } from "../../src/telegram/TelegramProvider";
import { useTheme } from "../../src/theme/useTheme";
import { Card, FadeIn, PressableScale } from "../../src/ui/primitives";
import { TabIcon } from "../../src/ui/TabIcon";
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
  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => apiClient.entitlements.get(),
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

        <FadeIn index={1}>
          <Section title="Проверка и импорт" theme={theme}>
            <NavRow
              href="/review-inbox"
              label="Нужно проверить"
              badge={pendingCount > 0 ? String(pendingCount) : undefined}
              theme={theme}
            />
            <NavRow href="/import" label="Импорт выписки" theme={theme} />
          </Section>
        </FadeIn>

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

        <Section title="Тариф" theme={theme}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              {entitlements?.plan === "free" ? "Бесплатный" : "Pro"}
            </Text>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              {entitlements && entitlements.limits.voice >= 0
                ? `голос ${entitlements.used.voice}/${entitlements.limits.voice} в месяц`
                : "без ограничений"}
            </Text>
          </View>
        </Section>

        <Section title="Скоро" theme={theme}>
          <Text style={[styles.soon, { color: theme.textSecondary }]}>
            Регулярные платежи, экспорт данных, Telegram-уведомления и подключение банков появятся
            на следующих этапах.
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
      <Card style={styles.card}>{children}</Card>
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
      <PressableScale style={styles.row}>
        <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.badgeText, { color: theme.onAccent }]}>{badge}</Text>
          </View>
        ) : (
          <TabIcon name="chevron" color={theme.textTertiary} size={18} />
        )}
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: { gap: spacing.xs },
  name: typography.display,
  subtitle: typography.caption,
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.overline, textTransform: "uppercase" },
  card: { paddingVertical: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowLabel: typography.body,
  rowValue: typography.callout,
  badge: {
    minWidth: 26,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { ...typography.caption, fontWeight: "700", textAlign: "center" },
  soon: { ...typography.caption, paddingVertical: spacing.md, lineHeight: 19 },
});
