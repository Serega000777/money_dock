import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Account, CategoryGrowthFacts, Insight } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTelegram } from "../../src/telegram/TelegramProvider";
import { useSettingsStore } from "../../src/theme/settingsStore";
import { useTheme } from "../../src/theme/useTheme";
import { GlowBlob, GlowRing, GradientBox } from "../../src/ui/Gradient";
import { Icon, type IconName } from "../../src/ui/Icon";
import { Text } from "../../src/ui/Text";
import {
  BottomSheet,
  Card,
  FadeIn,
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
          <GradientBox colors={theme.accentGradient} diagonal radius={radii.xl} highlight>
            <GlowRing
              top="-60%"
              left="25%"
              size={300}
              ringWidth={22}
              color="rgba(255,255,255,0.05)"
            />
            <View style={styles.heroBody}>
              <Text style={styles.heroLabel}>Общий баланс</Text>
              {/* One string, not an amount plus a smaller currency glyph: in the
                  reference the ₽ is the same size and weight as the digits. */}
              <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                {summary ? `${formatMinor(summary.totalBalanceMinor)} ₽` : "—"}
              </Text>
              <Text style={styles.heroHint}>
                {summary
                  ? `${formatMinor(summary.safeToSpendPerDayMinor)} ₽ в день • осталось ${
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
            {/* A wide, soft bleed behind the whole row — the mic's own shadow reads as a
                halo on the button itself, this is what makes it feel like a spotlight
                against the page background too, per the reference. */}
            {theme.decorGlow ? (
              <View pointerEvents="none" style={styles.micGlow}>
                <GlowBlob top="-10%" left="10%" size={260} color="#E935C1" />
                <GlowBlob top="5%" left="35%" size={260} color="#5D33FF" />
              </View>
            ) : null}
            <View style={styles.micRow}>
              <WaveBars color={theme.accent} />
              <View style={styles.micRingWrap}>
                <View
                  pointerEvents="none"
                  style={[styles.micRing1, { borderColor: "rgba(255,43,199,0.2)" }]}
                />
                <View
                  pointerEvents="none"
                  style={[styles.micRing2, { borderColor: "rgba(128,67,255,0.18)" }]}
                />
                <Link href="/voice" asChild>
                  <PressableScale accessibilityLabel="Добавить операцию голосом">
                    <GradientBox
                      colors={theme.accentGradient}
                      diagonal
                      radius={radii.pill}
                      highlight
                      highlightSize={150}
                      style={StyleSheet.flatten([styles.mic, { shadowColor: theme.accent }])}
                    >
                      <View style={styles.micInner}>
                        <Icon name="mic" color="#FFFFFF" size={44} strokeWidth={1.8} />
                      </View>
                    </GradientBox>
                  </PressableScale>
                </Link>
              </View>
              <WaveBars color={theme.accent} />
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
                {/* Soft white, not the accent — the reference's "Все ›" is muted. */}
                <Text style={[styles.accountsAll, { color: theme.textSecondary }]}>Все</Text>
                <Icon name="chevron" color={theme.textSecondary} size={14} />
              </Pressable>
            </View>
            <View style={styles.accountsRow}>
              {accounts.map((account: Account, index: number) => (
                <AccountTile key={account.id} account={account} vivid={index === 0} />
              ))}
            </View>
          </FadeIn>
        ) : null}

        {summary ? (
          <FadeIn index={4}>
            <Card style={styles.paceCard}>
              {theme.decorGlow ? (
                <GlowBlob top="-30%" left="-10%" size={160} color={theme.accent} />
              ) : null}
              {/* Order and weights straight from the reference: title + bare percentage,
                  then the bar, then the figures under it. */}
              <View style={styles.paceHeader}>
                <Text style={[styles.paceTitle, { color: theme.textPrimary }]}>
                  Прогресс месяца
                </Text>
                <Text style={[styles.pacePercent, { color: theme.textPrimary }]}>
                  {Math.round(spentShare * 100)}%
                </Text>
              </View>

              <ProgressBar
                share={spentShare}
                // The alarm states stay a flat colour so "over budget" still reads as a
                // signal; the healthy state gets the reference's pink→violet ramp.
                color={spentShare > 0.9 ? theme.negative : theme.warning}
                colors={
                  spentShare > 0.9 || forecastNegative
                    ? undefined
                    : ["#FF1FBF", "#FF4BD8", "#9A43FF"]
                }
              />

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
            {/* The flex sizing has to live on a plain wrapper: PressableScale forwards
                `style` to an inner Animated.View, so `flex: 1` there never reaches the
                actual flex item and both pills collapse to their content width. */}
            <View style={styles.quickButtonWrap}>
              <Link href="/import" asChild>
                <PressableScale>
                  <GradientBox
                    colors={theme.chipGradient}
                    radius={radii.pill}
                    style={StyleSheet.flatten([styles.quickButton, { borderColor: theme.border }])}
                  >
                    <View style={[styles.quickIconGlow, { shadowColor: theme.accent }]}>
                      <Icon name="upload" color={theme.accent} size={22} strokeWidth={2} />
                    </View>
                    <Text
                      style={[styles.quickLabel, { color: theme.textPrimary }]}
                      numberOfLines={1}
                    >
                      Импорт из банка
                    </Text>
                  </GradientBox>
                </PressableScale>
              </Link>
            </View>
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
            <View style={styles.quickButtonWrap}>
              <PressableScale onPress={() => receiptInputRef.current?.click()}>
                <GradientBox
                  colors={theme.chipGradient}
                  radius={radii.pill}
                  style={StyleSheet.flatten([styles.quickButton, { borderColor: theme.border }])}
                >
                  <View style={[styles.quickIconGlow, { shadowColor: theme.accent }]}>
                    <Icon name="note" color={theme.accent} size={22} strokeWidth={2} />
                  </View>
                  <Text style={[styles.quickLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                    Скан чека
                  </Text>
                </GradientBox>
              </PressableScale>
            </View>
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

/** One account, laid out like the reference's bank card: badge on the left, a two-line
 * name block beside it, and the balance pinned to the bottom. The reference's second
 * line is the last four card digits and its right-hand card carries a Mastercard mark —
 * we store neither, and inventing them would put false information on a finance screen,
 * so the currency stands in and the network mark is left out. Only the first tile
 * (`vivid`) gets the gradient; the rest stay flat, as in the reference. */
function AccountTile({ account, vivid }: { account: Account; vivid: boolean }) {
  const theme = useTheme();
  const nameColor = vivid ? "#FFFFFF" : theme.textPrimary;
  const metaColor = vivid ? "rgba(255,255,255,0.72)" : theme.textTertiary;
  const balanceColor = vivid ? "#FFFFFF" : theme.textPrimary;
  const iconBg = vivid ? "rgba(255,255,255,0.16)" : theme.accentSoft;
  const iconColor = vivid ? "#FFFFFF" : theme.accent;
  return (
    <Card gradient={vivid} style={styles.accountTile}>
      {!vivid && theme.decorGlow ? (
        <GlowBlob top="-25%" left="55%" size={140} color={theme.decorGlow} opacity={0.35} />
      ) : null}
      <View style={styles.accountTop}>
        <View style={[styles.accountIcon, { backgroundColor: iconBg }]}>
          <Icon name={ACCOUNT_TYPE_ICON[account.type]} color={iconColor} size={18} />
        </View>
        <View style={styles.accountTopText}>
          <Text style={[styles.accountName, { color: nameColor }]} numberOfLines={1}>
            {account.name}
          </Text>
          <Text style={[styles.accountMeta, { color: metaColor }]} numberOfLines={1}>
            {account.currency}
          </Text>
        </View>
      </View>
      <Text style={[styles.accountBalance, { color: balanceColor }]} numberOfLines={1}>
        {formatMinor(account.currentBalanceMinor)} ₽
      </Text>
    </Card>
  );
}

/** Static waveform decoration either side of the mic — `reverse` mirrors the bar
 * heights so the two sides don't look like copy-paste of each other. */
function WaveBars({ color }: { color: string }) {
  // A symmetric little mountain, like the reference's equalizer.
  const heights = [14, 22, 32, 22, 14];
  return (
    <View style={styles.waveBars}>
      {heights.map((height, index) => (
        <View
          key={index}
          style={[
            styles.waveBar,
            {
              height,
              backgroundColor: color,
              opacity: 0.6,
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 6,
            },
          ]}
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

  // The reference is drawn at 430px wide; the numbers below are its values scaled to a
  // 390px phone, which is what stops the figure reading as oversized.
  heroBody: { padding: spacing.xl, gap: 8 },
  heroLabel: { ...typography.body, fontSize: 16, color: "rgba(255,255,255,0.82)" },
  heroAmount: {
    ...typography.hero,
    fontSize: 37,
    lineHeight: 42,
    letterSpacing: -1.1,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroHint: { ...typography.callout, color: "rgba(255,255,255,0.82)" },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  heroFooter: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  heroFooterRight: {
    alignItems: "flex-end",
    paddingLeft: spacing.md,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.16)",
  },
  heroFooterLabel: { ...typography.caption, fontSize: 13, color: "rgba(255,255,255,0.72)" },
  heroFooterValue: { ...typography.title, fontSize: 19, fontWeight: "700", color: "#FFFFFF" },

  micBlock: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    position: "relative",
  },
  micGlow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  micRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  micRingWrap: { position: "relative" },
  micRing1: {
    position: "absolute",
    top: -14,
    left: -14,
    right: -14,
    bottom: -14,
    borderRadius: 999,
    borderWidth: 1,
  },
  micRing2: {
    position: "absolute",
    top: -28,
    left: -28,
    right: -28,
    bottom: -28,
    borderRadius: 999,
    borderWidth: 1,
  },
  mic: {
    width: 132,
    height: 132,
    // A centred halo, not a drop shadow — per the reference's glowing mic button.
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 48,
    elevation: 10,
  },
  micInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  micTitle: { ...typography.headline, marginTop: spacing.sm },
  micHint: { ...typography.caption, textAlign: "center", maxWidth: 300 },
  waveBars: { flexDirection: "row", alignItems: "center", gap: 6, width: 44, height: 48 },
  waveBar: { width: 4, borderRadius: 2 },

  accountsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  accountsTitle: typography.headline,
  accountsAllButton: { flexDirection: "row", alignItems: "center", gap: 2 },
  accountsAll: { ...typography.callout, fontWeight: "600" },
  accountsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  accountTile: {
    width: "48.5%",
    // The reference's card is ~115px at its 430px width; taller than this and
    // space-between opens a gap between the name block and the balance that the
    // reference doesn't have.
    minHeight: 104,
    justifyContent: "space-between",
    // The reference's 16px padding scaled to a 390px phone — also what buys the name
    // enough room to fit "Основная карта" without an ellipsis.
    padding: 14,
    overflow: "hidden",
  },
  accountTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  accountTopText: { flex: 1, gap: 2 },
  accountName: { ...typography.caption, fontSize: 12.5, lineHeight: 15, fontWeight: "600" },
  accountMeta: { ...typography.caption, fontSize: 11, lineHeight: 13 },
  accountBalance: { ...typography.display, fontSize: 21, letterSpacing: -0.6, fontWeight: "800" },
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

  paceCard: { gap: spacing.sm, overflow: "hidden" },
  paceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  paceTitle: { ...typography.headline, fontWeight: "700" },
  pacePercent: { ...typography.callout, fontSize: 15, fontWeight: "700" },
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
    justifyContent: "center",
    gap: 6,
    height: 56,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // No filled chip behind the icon — the reference glows the glyph itself.
  quickIconGlow: {
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  quickLabel: { ...typography.callout, fontSize: 13, fontWeight: "600", flexShrink: 1 },

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
