import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTelegram } from "../../src/telegram/TelegramProvider";
import { useTheme } from "../../src/theme/useTheme";
import { Card, FadeIn, PressableScale } from "../../src/ui/primitives";
import { TabIcon } from "../../src/ui/TabIcon";
import { formatMinor } from "../../src/utils/format";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

export default function Home() {
  const theme = useTheme();
  const { user } = useTelegram();
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.accounts.list(),
    enabled,
  });
  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => apiClient.analytics.summary(),
    enabled,
  });
  const { data: reviewItems } = useQuery({
    queryKey: ["review-inbox"],
    queryFn: () => apiClient.reviewInbox.list(),
    enabled,
  });

  const hasAccounts = Boolean(accounts && accounts.length > 0);
  const pending = reviewItems?.length ?? 0;
  const forecastNegative = (summary?.monthEndForecastMinor ?? 0) < 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeIn index={0}>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>
            {greeting()}
            {user?.first_name ? `, ${user.first_name}` : ""}
          </Text>
        </FadeIn>

        {/* The one number the whole screen exists for. */}
        <FadeIn index={1}>
          <Card style={styles.hero}>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
              Можно безопасно потратить
            </Text>
            <View style={styles.heroAmountRow}>
              <Text style={[styles.heroAmount, { color: theme.textPrimary }]}>
                {summary ? formatMinor(summary.safeToSpendPerDayMinor) : "—"}
              </Text>
              <Text style={[styles.heroCurrency, { color: theme.textTertiary }]}>₽</Text>
            </View>
            <Text style={[styles.heroHint, { color: theme.textSecondary }]}>
              {summary
                ? `в день · осталось ${summary.daysRemainingInMonth} дн. до конца месяца`
                : "Появится после подключения счетов"}
            </Text>
          </Card>
        </FadeIn>

        {summary ? (
          <FadeIn index={2}>
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>На счетах</Text>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                  {formatMinor(summary.totalBalanceMinor)} ₽
                </Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Прогноз остатка
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    { color: forecastNegative ? theme.negative : theme.textPrimary },
                  ]}
                >
                  {formatMinor(summary.monthEndForecastMinor)} ₽
                </Text>
              </Card>
            </View>
          </FadeIn>
        ) : null}

        {summary && summary.todayExpenseMinor > 0 ? (
          <FadeIn index={3}>
            <Card style={styles.todayCard}>
              <View style={styles.todayRow}>
                <Text style={[styles.todayLabel, { color: theme.textSecondary }]}>
                  Сегодня потрачено
                </Text>
                <Text style={[styles.todayAmount, { color: theme.textPrimary }]}>
                  {formatMinor(summary.todayExpenseMinor)} ₽
                </Text>
              </View>
              {summary.expenseChangePercent !== null ? (
                <View
                  style={[
                    styles.deltaPill,
                    {
                      backgroundColor:
                        summary.expenseChangePercent > 0 ? theme.warningSoft : theme.positiveSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deltaText,
                      {
                        color: summary.expenseChangePercent > 0 ? theme.warning : theme.positive,
                      },
                    ]}
                  >
                    {summary.expenseChangePercent > 0 ? "+" : ""}
                    {Math.round(summary.expenseChangePercent)}% к прошлому месяцу
                  </Text>
                </View>
              ) : null}
            </Card>
          </FadeIn>
        ) : null}

        {pending > 0 ? (
          <FadeIn index={4}>
            <Link href="/review-inbox" asChild>
              <PressableScale>
                <Card
                  style={StyleSheet.flatten([styles.reviewCard, { borderColor: theme.accent }])}
                >
                  <View style={styles.reviewLeft}>
                    <Text style={[styles.reviewTitle, { color: theme.textPrimary }]}>
                      Нужно проверить
                    </Text>
                    <Text style={[styles.reviewHint, { color: theme.textSecondary }]}>
                      {pending}{" "}
                      {pending === 1
                        ? "операция ждёт"
                        : pending < 5
                          ? "операции ждут"
                          : "операций ждут"}{" "}
                      решения
                    </Text>
                  </View>
                  <View style={[styles.reviewBadge, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.reviewBadgeText, { color: theme.onAccent }]}>
                      {pending}
                    </Text>
                  </View>
                </Card>
              </PressableScale>
            </Link>
          </FadeIn>
        ) : null}

        {hasAccounts ? (
          <FadeIn index={5}>
            <View style={styles.actions}>
              <Link href="/voice" asChild>
                <PressableScale style={styles.primaryAction}>
                  <View style={[styles.primaryInner, { backgroundColor: theme.accent }]}>
                    <TabIcon name="mic" color={theme.onAccent} size={20} />
                    <Text numberOfLines={1} style={[styles.primaryText, { color: theme.onAccent }]}>
                      Добавить голосом
                    </Text>
                  </View>
                </PressableScale>
              </Link>

              <Link href="/add-transaction" asChild>
                <PressableScale style={styles.secondaryAction}>
                  <View
                    style={[
                      styles.secondaryInner,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <TabIcon name="plus" color={theme.textPrimary} size={20} />
                  </View>
                </PressableScale>
              </Link>
            </View>
          </FadeIn>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },

  greeting: { ...typography.callout, marginBottom: spacing.xs },

  hero: { paddingVertical: spacing.xl, gap: spacing.xs },
  heroLabel: typography.callout,
  heroAmountRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  heroAmount: typography.hero,
  heroCurrency: { ...typography.display, fontWeight: "500" },
  heroHint: typography.caption,

  statsRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, gap: spacing.xs, paddingVertical: spacing.lg },
  statLabel: typography.caption,
  statValue: typography.title,

  todayCard: { gap: spacing.md },
  todayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayLabel: typography.callout,
  todayAmount: typography.headline,
  deltaPill: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deltaText: typography.caption,

  reviewCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1 },
  reviewLeft: { flex: 1, gap: 2 },
  reviewTitle: typography.headline,
  reviewHint: typography.caption,
  reviewBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  reviewBadgeText: { ...typography.callout, fontWeight: "700" },

  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  primaryAction: { flex: 1 },
  primaryInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  primaryText: { ...typography.callout, fontWeight: "600", fontSize: 15, flexShrink: 1 },
  secondaryAction: { width: 54 },
  secondaryInner: {
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
