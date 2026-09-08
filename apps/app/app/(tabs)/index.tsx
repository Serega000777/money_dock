import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTelegram } from "../../src/telegram/TelegramProvider";
import { useSettingsStore } from "../../src/theme/settingsStore";
import { useTheme } from "../../src/theme/useTheme";
import { GradientBox } from "../../src/ui/Gradient";
import { Icon, type IconName } from "../../src/ui/Icon";
import { Text } from "../../src/ui/Text";
import { Card, FadeIn, Pill, PressableScale, ProgressBar, Screen } from "../../src/ui/primitives";
import { formatMinor } from "../../src/utils/format";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export default function Home() {
  const theme = useTheme();
  const { user } = useTelegram();
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);

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

  const pending = reviewItems?.length ?? 0;
  const isDark = theme.name === "dark";

  // "Свободная сумма" is what is left to spend until the end of the month — the daily
  // safe-to-spend multiplied out, which is the number people actually plan against.
  const freeMinor = summary
    ? summary.safeToSpendPerDayMinor * Math.max(0, summary.daysRemainingInMonth)
    : 0;
  const monthProgress = summary
    ? (summary.daysInMonth - summary.daysRemainingInMonth) / summary.daysInMonth
    : 0;
  const spentShare =
    summary && summary.currentMonthIncomeMinor > 0
      ? Math.min(1, summary.currentMonthExpenseMinor / summary.currentMonthIncomeMinor)
      : 0;
  const forecastNegative = (summary?.monthEndForecastMinor ?? 0) < 0;

  return (
    <Screen>
      <FadeIn index={0}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>
              {greeting()}
              {user?.first_name ? `, ${user.first_name}` : ""}
            </Text>
            <Text style={[styles.brand, { color: theme.textPrimary }]}>amola</Text>
          </View>
          {/* Quick switch only ever picks a concrete theme — "система" stays in the cabinet. */}
          <Pressable
            onPress={() => setThemeMode(isDark ? "light" : "dark")}
            accessibilityLabel={isDark ? "Светлая тема" : "Тёмная тема"}
            style={[
              styles.themeButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Icon
              name={isDark ? "sun" : "moon"}
              color={themeMode === "system" ? theme.textTertiary : theme.accent}
              size={20}
            />
          </Pressable>
        </View>
      </FadeIn>

      {/* The one number the whole screen exists for, with the balance right beside it. */}
      <FadeIn index={1}>
        <GradientBox colors={theme.accentGradient} diagonal radius={radii.xl}>
          <View style={styles.heroBody}>
            <Text style={styles.heroLabel}>Свободная сумма</Text>
            <View style={styles.heroAmountRow}>
              <Text style={styles.heroAmount}>{summary ? formatMinor(freeMinor) : "—"}</Text>
              <Text style={styles.heroCurrency}>₽</Text>
            </View>
            <Text style={styles.heroHint}>
              {summary
                ? `${formatMinor(summary.safeToSpendPerDayMinor)} ₽ в день · осталось ${
                    summary.daysRemainingInMonth
                  } ${plural(summary.daysRemainingInMonth, "день", "дня", "дней")}`
                : "Появится после подключения счетов"}
            </Text>

            <View style={styles.heroDivider} />

            <View style={styles.heroFooter}>
              <View>
                <Text style={styles.heroFooterLabel}>Общий баланс</Text>
                <Text style={styles.heroFooterValue}>
                  {summary ? `${formatMinor(summary.totalBalanceMinor)} ₽` : "—"}
                </Text>
              </View>
              <View style={styles.heroFooterRight}>
                <Text style={styles.heroFooterLabel}>Прогноз на конец месяца</Text>
                <Text style={styles.heroFooterValue}>
                  {summary ? `${formatMinor(summary.monthEndForecastMinor)} ₽` : "—"}
                </Text>
              </View>
            </View>
          </View>
        </GradientBox>
      </FadeIn>

      {/* The big mic is the primary action — one tap from anything else on the screen. */}
      <FadeIn index={2}>
        <View style={styles.micBlock}>
          <Link href="/voice" asChild>
            <PressableScale accessibilityLabel="Добавить операцию голосом">
              <GradientBox
                colors={theme.accentGradient}
                diagonal
                radius={radii.pill}
                style={StyleSheet.flatten([styles.mic, { shadowColor: theme.accent }])}
              >
                <View style={styles.micInner}>
                  <Icon name="mic" color="#FFFFFF" size={44} strokeWidth={1.8} />
                </View>
              </GradientBox>
            </PressableScale>
          </Link>
          <Text style={[styles.micTitle, { color: theme.textPrimary }]}>Скажите, что потратили</Text>
          <Text style={[styles.micHint, { color: theme.textTertiary }]}>
            «Потратил 840 рублей в кафе» — разберём и покажем на подтверждение
          </Text>
        </View>
      </FadeIn>

      {summary ? (
        <FadeIn index={3}>
          <Card style={styles.paceCard}>
            <View style={styles.paceHeader}>
              <Text style={[styles.paceTitle, { color: theme.textPrimary }]}>Темп месяца</Text>
              {summary.expenseChangePercent !== null ? (
                <Pill
                  label={`${summary.expenseChangePercent > 0 ? "+" : ""}${Math.round(
                    summary.expenseChangePercent,
                  )}% к прошлому месяцу`}
                  color={summary.expenseChangePercent > 0 ? theme.warning : theme.positive}
                  background={
                    summary.expenseChangePercent > 0 ? theme.warningSoft : theme.positiveSoft
                  }
                />
              ) : null}
            </View>

            <View style={styles.paceRow}>
              <Text style={[styles.paceLabel, { color: theme.textSecondary }]}>Месяц пройден</Text>
              <Text style={[styles.paceValue, { color: theme.textPrimary }]}>
                {Math.round(monthProgress * 100)}%
              </Text>
            </View>
            <ProgressBar share={monthProgress} color={theme.textTertiary} />

            <View style={styles.paceRow}>
              <Text style={[styles.paceLabel, { color: theme.textSecondary }]}>
                Потрачено от дохода
              </Text>
              <Text style={[styles.paceValue, { color: theme.textPrimary }]}>
                {formatMinor(summary.currentMonthExpenseMinor)} ₽
              </Text>
            </View>
            <ProgressBar
              share={spentShare}
              color={
                spentShare > monthProgress + 0.1
                  ? theme.negative
                  : forecastNegative
                    ? theme.warning
                    : theme.positive
              }
            />

            {summary.todayExpenseMinor > 0 ? (
              <Text style={[styles.paceToday, { color: theme.textSecondary }]}>
                Сегодня потрачено {formatMinor(summary.todayExpenseMinor)} ₽
              </Text>
            ) : null}
          </Card>
        </FadeIn>
      ) : null}

      {pending > 0 ? (
        <FadeIn index={4}>
          <Link href="/review-inbox" asChild>
            <PressableScale>
              <Card style={StyleSheet.flatten([styles.reviewCard, { borderColor: theme.accent }])}>
                <View style={[styles.reviewIcon, { backgroundColor: theme.accentSoft }]}>
                  <Icon name="inbox" color={theme.accent} size={20} />
                </View>
                <View style={styles.reviewLeft}>
                  <Text style={[styles.reviewTitle, { color: theme.textPrimary }]}>
                    Нужно проверить
                  </Text>
                  <Text style={[styles.reviewHint, { color: theme.textSecondary }]}>
                    {pending} {plural(pending, "операция ждёт", "операции ждут", "операций ждут")}{" "}
                    решения
                  </Text>
                </View>
                <View style={[styles.reviewBadge, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.reviewBadgeText, { color: theme.onAccent }]}>{pending}</Text>
                </View>
              </Card>
            </PressableScale>
          </Link>
        </FadeIn>
      ) : null}

      <FadeIn index={5}>
        <View style={styles.actions}>
          <Action href="/add-transaction" icon="plus" label="Вручную" />
          <Action href="/import" icon="upload" label="Импорт выписки" />
        </View>
      </FadeIn>
    </Screen>
  );
}

function Action({
  href,
  icon,
  label,
}: {
  href: "/add-transaction" | "/import";
  icon: IconName;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <PressableScale style={styles.action}>
        <View
          style={[
            styles.actionInner,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Icon name={icon} color={theme.textPrimary} size={20} />
          <Text numberOfLines={1} style={[styles.actionText, { color: theme.textPrimary }]}>
            {label}
          </Text>
        </View>
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  greeting: typography.callout,
  brand: { ...typography.title, letterSpacing: 0.4 },
  themeButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },

  heroBody: { padding: spacing.xl, gap: spacing.xs },
  heroLabel: { ...typography.callout, color: "rgba(255,255,255,0.82)" },
  heroAmountRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  heroAmount: { ...typography.hero, color: "#FFFFFF" },
  heroCurrency: { ...typography.display, fontWeight: "500", color: "rgba(255,255,255,0.72)" },
  heroHint: { ...typography.caption, color: "rgba(255,255,255,0.78)" },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginVertical: spacing.md,
  },
  heroFooter: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  heroFooterRight: { alignItems: "flex-end" },
  heroFooterLabel: { ...typography.caption, color: "rgba(255,255,255,0.72)" },
  heroFooterValue: { ...typography.headline, color: "#FFFFFF" },

  micBlock: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  mic: {
    width: 132,
    height: 132,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  micInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  micTitle: { ...typography.headline, marginTop: spacing.sm },
  micHint: { ...typography.caption, textAlign: "center", maxWidth: 300 },

  paceCard: { gap: spacing.sm },
  paceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  paceTitle: typography.headline,
  paceRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  paceLabel: typography.caption,
  paceValue: { ...typography.caption, fontWeight: "700" },
  paceToday: { ...typography.caption, marginTop: spacing.xs },

  reviewCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1 },
  reviewIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
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

  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
  actionInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: { ...typography.callout, fontWeight: "600" },
});
