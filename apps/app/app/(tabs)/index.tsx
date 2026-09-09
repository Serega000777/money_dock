import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Account, CategoryGrowthFacts, Insight } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTelegram } from "../../src/telegram/TelegramProvider";
import { useSettingsStore } from "../../src/theme/settingsStore";
import { useTheme } from "../../src/theme/useTheme";
import { GradientBox } from "../../src/ui/Gradient";
import { Icon, type IconName } from "../../src/ui/Icon";
import { Text } from "../../src/ui/Text";
import {
  BottomSheet,
  Card,
  FadeIn,
  Pill,
  PressableScale,
  ProgressBar,
  Screen,
} from "../../src/ui/primitives";
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

/** The server sends facts + a template key, never a finished sentence (spec §20) — this
 * is the one place that turns `category_growth` into the RU text from the product doc's
 * own mockup ("доставка еды выросла на 4 800 ₽ за 30 дней"). */
function insightMessage(insight: Insight): string {
  if (insight.code === "category_growth") {
    const facts = insight.facts as CategoryGrowthFacts;
    const growthMinor = facts.currentMinor - facts.previousMinor;
    return `${facts.categoryName} выросли на ${formatMinor(growthMinor)} ₽ за ${facts.windowDays} дней`;
  }
  return "";
}

export default function Home() {
  const theme = useTheme();
  const { user } = useTelegram();
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const homeLeftMetric = useSettingsStore((state) => state.homeLeftMetric);
  const homeRightMetric = useSettingsStore((state) => state.homeRightMetric);
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);
  const queryClient = useQueryClient();
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const [accountsSheetOpen, setAccountsSheetOpen] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => apiClient.analytics.summary(),
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
  const { data: insights } = useQuery({
    queryKey: ["insights"],
    queryFn: () => apiClient.insights.list(),
    enabled,
  });
  const dismissInsight = useMutation({
    mutationFn: (id: string) => apiClient.insights.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["insights"] }),
  });

  const pending = reviewItems?.length ?? 0;
  // Highest-priority insight the user hasn't already dismissed — the home screen shows
  // one "Совет" at a time, not a feed (spec §5: "Диаграммы вторичны").
  const topInsight = insights?.find((insight) => !insight.readAt);

  // "Свободная сумма" is what is left to spend until the end of the month — the daily
  // safe-to-spend multiplied out, which is the number people actually plan against.
  const freeMinor = summary
    ? summary.safeToSpendPerDayMinor * Math.max(0, summary.daysRemainingInMonth)
    : 0;
  const spentShare =
    summary && summary.currentMonthIncomeMinor > 0
      ? Math.min(1, summary.currentMonthExpenseMinor / summary.currentMonthIncomeMinor)
      : 0;
  const forecastNegative = (summary?.monthEndForecastMinor ?? 0) < 0;

  // Configurable in Кабинет → Главный экран (settingsStore): the hero card's two footer
  // slots each show one of two related figures, picked per user rather than fixed.
  const leftMetric =
    homeLeftMetric === "income"
      ? { label: "Доход", value: summary?.currentMonthIncomeMinor }
      : { label: "Расход", value: summary?.currentMonthExpenseMinor };
  const rightMetric =
    homeRightMetric === "remaining"
      ? { label: "Остаток", value: summary?.monthEndForecastMinor }
      : { label: "Свободные деньги", value: summary ? freeMinor : undefined };

  return (
    <>
      <Screen>
        <FadeIn index={0}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.greeting, { color: theme.textPrimary }]}>
                {greeting()}
                {user?.first_name ? `, ${user.first_name}` : ""} 👋
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Давайте сделаем ваши финансы удобнее
              </Text>
            </View>
            {/* Quick switch only ever picks a concrete theme — "система" stays in Кабинет. */}
            <Pressable
              onPress={() => setThemeMode(theme.name === "dark" ? "light" : "dark")}
              accessibilityLabel={theme.name === "dark" ? "Светлая тема" : "Тёмная тема"}
              style={StyleSheet.flatten([
                styles.themeButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ])}
            >
              <Icon
                name={theme.name === "dark" ? "sun" : "moon"}
                color={themeMode === "system" ? theme.textTertiary : theme.accent}
                size={20}
              />
            </Pressable>
          </View>
        </FadeIn>

        {/* The one number the whole screen exists for, with the two configurable figures
          right beside it — which two is a Кабинет → Главный экран setting. */}
        <FadeIn index={1}>
          <GradientBox colors={theme.accentGradient} diagonal radius={radii.xl}>
            <View style={styles.heroBody}>
              <Text style={styles.heroLabel}>Общий баланс</Text>
              <View style={styles.heroAmountRow}>
                <Text style={styles.heroAmount}>
                  {summary ? formatMinor(summary.totalBalanceMinor) : "—"}
                </Text>
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
                  <Text style={styles.heroFooterLabel}>{leftMetric.label}</Text>
                  <Text style={styles.heroFooterValue}>
                    {leftMetric.value !== undefined ? `${formatMinor(leftMetric.value)} ₽` : "—"}
                  </Text>
                </View>
                <View style={styles.heroFooterRight}>
                  <Text style={styles.heroFooterLabel}>{rightMetric.label}</Text>
                  <Text style={styles.heroFooterValue}>
                    {rightMetric.value !== undefined ? `${formatMinor(rightMetric.value)} ₽` : "—"}
                  </Text>
                </View>
              </View>
            </View>
          </GradientBox>
        </FadeIn>

        {/* The big mic is the primary action — one tap from anything else on the screen. */}
        <FadeIn index={2}>
          <View style={styles.micBlock}>
            <View style={styles.micRow}>
              <WaveBars color={theme.accent} />
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
              <WaveBars color={theme.accent} reverse />
            </View>
            <Text style={[styles.micTitle, { color: theme.textPrimary }]}>
              Скажите, что потратили
            </Text>
            <Text style={[styles.micHint, { color: theme.textTertiary }]}>
              «Потратил 840 рублей в кафе» — разберём и покажем на подтверждение
            </Text>
          </View>
        </FadeIn>

        {/* "Карты и счета" — real accounts, not a mockup number: balance comes straight
          from the same summary the hero card and analytics use. */}
        {accounts && accounts.length > 0 ? (
          <FadeIn index={3}>
            <View style={styles.accountsHeader}>
              <Text style={[styles.accountsTitle, { color: theme.textPrimary }]}>
                Карты и счета
              </Text>
              <Pressable
                accessibilityLabel="Все счета"
                style={styles.accountsAllButton}
                onPress={() => setAccountsSheetOpen(true)}
              >
                <Text style={[styles.accountsAll, { color: theme.accent }]}>Все</Text>
                <Icon name="chevron" color={theme.accent} size={14} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountsRow}
            >
              {accounts.map((account: Account) => (
                <AccountTile key={account.id} account={account} />
              ))}
            </ScrollView>
          </FadeIn>
        ) : null}

        {summary ? (
          <FadeIn index={4}>
            <Card style={styles.paceCard}>
              <View style={styles.paceHeader}>
                <Text style={[styles.paceTitle, { color: theme.textPrimary }]}>
                  Прогресс месяца
                </Text>
                <Pill
                  label={`${Math.round(spentShare * 100)}%`}
                  color={theme.accent}
                  background={theme.accentSoft}
                />
              </View>

              <View style={styles.paceRow}>
                <Text style={[styles.paceLabel, { color: theme.textSecondary }]}>
                  Потрачено от дохода
                </Text>
                <Text style={[styles.paceValue, { color: theme.textPrimary }]}>
                  {formatMinor(summary.currentMonthExpenseMinor)} ₽
                  {summary.currentMonthIncomeMinor > 0 ? (
                    <Text style={{ color: theme.textTertiary, fontWeight: "400" }}>
                      {" "}
                      из {formatMinor(summary.currentMonthIncomeMinor)} ₽
                    </Text>
                  ) : null}
                </Text>
              </View>
              <ProgressBar
                share={spentShare}
                color={
                  spentShare > 0.9
                    ? theme.negative
                    : forecastNegative
                      ? theme.warning
                      : theme.positive
                }
              />

              {/* Same total, split by how it left the wallet — a card/bank swipe vs. cash
                out of pocket read very differently, so "спент this month" alone isn't enough. */}
              <View style={styles.paymentSplit}>
                <View style={styles.paymentSplitItem}>
                  <View style={[styles.paymentIcon, { backgroundColor: theme.accentSoft }]}>
                    <Icon name="card" color={theme.accent} size={16} />
                  </View>
                  <View style={styles.paymentText}>
                    <Text style={[styles.paymentLabel, { color: theme.textSecondary }]}>
                      С банка
                    </Text>
                    <Text style={[styles.paymentValue, { color: theme.textPrimary }]}>
                      {formatMinor(summary.currentMonthExpenseBankMinor)} ₽
                    </Text>
                  </View>
                </View>
                <View style={styles.paymentSplitItem}>
                  <View style={[styles.paymentIcon, { backgroundColor: theme.positiveSoft }]}>
                    <Icon name="wallet" color={theme.positive} size={16} />
                  </View>
                  <View style={styles.paymentText}>
                    <Text style={[styles.paymentLabel, { color: theme.textSecondary }]}>
                      Наличными
                    </Text>
                    <Text style={[styles.paymentValue, { color: theme.textPrimary }]}>
                      {formatMinor(summary.currentMonthExpenseCashMinor)} ₽
                    </Text>
                  </View>
                </View>
              </View>

              {summary.todayExpenseMinor > 0 ? (
                <Text style={[styles.paceToday, { color: theme.textSecondary }]}>
                  Сегодня потрачено {formatMinor(summary.todayExpenseMinor)} ₽
                </Text>
              ) : null}
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn index={5}>
          <View style={styles.quickRow}>
            <Link href="/import" asChild>
              <PressableScale style={styles.quickButtonWrap}>
                <Card gradient style={styles.quickButton}>
                  <View style={[styles.quickIcon, { backgroundColor: theme.accentSoft }]}>
                    <Icon name="upload" color={theme.accent} size={17} />
                  </View>
                  <Text style={[styles.quickLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                    Импорт из банка
                  </Text>
                </Card>
              </PressableScale>
            </Link>
            {Platform.OS === "web" ? (
              // RN has no file input; on web (where the Mini App lives) we drive the
              // native one directly, same trick as import.tsx's CSV picker.
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(event) => {
                  // No OCR yet — a photo doesn't fill anything in automatically, so we
                  // just hand off to manual entry rather than pretend to have read it.
                  if (event.target.files?.[0]) router.push("/add-transaction");
                }}
              />
            ) : null}
            <PressableScale
              style={styles.quickButtonWrap}
              onPress={() => receiptInputRef.current?.click()}
            >
              <Card gradient style={styles.quickButton}>
                <View style={[styles.quickIcon, { backgroundColor: theme.positiveSoft }]}>
                  <Icon name="note" color={theme.positive} size={17} />
                </View>
                <Text style={[styles.quickLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                  Скан чека
                </Text>
              </Card>
            </PressableScale>
          </View>
        </FadeIn>

        {pending > 0 ? (
          <FadeIn index={6}>
            <Link href="/review-inbox" asChild>
              <PressableScale>
                <Card
                  style={StyleSheet.flatten([styles.reviewCard, { borderColor: theme.accent }])}
                >
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
                    <Text style={[styles.reviewBadgeText, { color: theme.onAccent }]}>
                      {pending}
                    </Text>
                  </View>
                </Card>
              </PressableScale>
            </Link>
          </FadeIn>
        ) : null}

        {topInsight ? (
          <FadeIn index={7}>
            <Card style={styles.tipCard}>
              <View style={[styles.tipIcon, { backgroundColor: theme.warningSoft }]}>
                <Icon name="chart" color={theme.warning} size={20} />
              </View>
              <View style={styles.tipLeft}>
                <Text style={[styles.tipTitle, { color: theme.textPrimary }]}>Совет</Text>
                <Text style={[styles.tipHint, { color: theme.textSecondary }]}>
                  {insightMessage(topInsight)}
                </Text>
              </View>
              <Pressable
                onPress={() => dismissInsight.mutate(topInsight.id)}
                accessibilityLabel="Скрыть совет"
                style={styles.tipDismiss}
              >
                <Icon name="close" color={theme.textTertiary} size={18} />
              </Pressable>
            </Card>
          </FadeIn>
        ) : null}
      </Screen>

      <BottomSheet
        visible={accountsSheetOpen}
        onClose={() => setAccountsSheetOpen(false)}
        title="Все счета"
      >
        {(accounts ?? []).map((account) => (
          <View key={account.id} style={styles.sheetRow}>
            <View style={[styles.sheetRowIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name={ACCOUNT_TYPE_ICON[account.type]} color={theme.accent} size={18} />
            </View>
            <Text style={[styles.sheetRowLabel, { color: theme.textPrimary }]}>{account.name}</Text>
            <Text style={[styles.sheetRowValue, { color: theme.textSecondary }]}>
              {formatMinor(account.currentBalanceMinor)} ₽
            </Text>
          </View>
        ))}
      </BottomSheet>
    </>
  );
}

const ACCOUNT_TYPE_ICON: Record<Account["type"], IconName> = {
  cash: "wallet",
  card: "card",
  bank: "card",
};

/** One account, styled like a bank card — real balance, no invented card numbers or
 * bank logos, since we don't store either. */
function AccountTile({ account }: { account: Account }) {
  const theme = useTheme();
  return (
    <Card gradient style={styles.accountTile}>
      <View style={[styles.accountIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={ACCOUNT_TYPE_ICON[account.type]} color={theme.accent} size={16} />
      </View>
      <Text style={[styles.accountName, { color: theme.textSecondary }]} numberOfLines={1}>
        {account.name}
      </Text>
      <Text style={[styles.accountBalance, { color: theme.textPrimary }]} numberOfLines={1}>
        {formatMinor(account.currentBalanceMinor)} ₽
      </Text>
    </Card>
  );
}

/** Static waveform decoration either side of the mic — `reverse` mirrors the bar
 * heights so the two sides don't look like copy-paste of each other. */
function WaveBars({ color, reverse }: { color: string; reverse?: boolean }) {
  const heights = [8, 16, 11, 20, 9];
  const ordered = reverse ? [...heights].reverse() : heights;
  return (
    <View style={styles.waveBars}>
      {ordered.map((height, index) => (
        <View
          key={index}
          style={[styles.waveBar, { height, backgroundColor: color, opacity: 0.35 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  headerText: { flex: 1, gap: 2 },
  greeting: { ...typography.title, letterSpacing: 0.2 },
  subtitle: typography.callout,
  themeButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
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
  micRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
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
  waveBars: { flexDirection: "row", alignItems: "center", gap: 4, width: 40 },
  waveBar: { width: 3, borderRadius: 2 },

  accountsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  accountsTitle: typography.headline,
  accountsAllButton: { flexDirection: "row", alignItems: "center", gap: 2 },
  accountsAll: { ...typography.callout, fontWeight: "600" },
  accountsRow: { gap: spacing.sm, paddingRight: spacing.lg },
  accountTile: { width: 168, gap: spacing.xs },
  accountIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  accountName: typography.caption,
  accountBalance: { ...typography.headline, fontWeight: "700" },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  sheetRowIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRowLabel: { ...typography.body, flex: 1 },
  sheetRowValue: { ...typography.callout, fontWeight: "600" },

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

  paymentSplit: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  paymentSplitItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentText: { gap: 1 },
  paymentLabel: typography.caption,
  paymentValue: { ...typography.callout, fontWeight: "700" },

  quickRow: { flexDirection: "row", gap: spacing.sm },
  quickButtonWrap: { flex: 1 },
  quickButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { ...typography.callout, fontWeight: "600", flexShrink: 1 },

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

  tipCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  tipLeft: { flex: 1, gap: 2 },
  tipTitle: typography.headline,
  tipHint: typography.caption,
  tipDismiss: { padding: spacing.xs },
});
