import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { AdminUserSummary, Plan } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { BarChart } from "../src/ui/BarChart";
import { Donut } from "../src/ui/Donut";
import { GradientBox } from "../src/ui/Gradient";
import { Icon, type IconName } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { BottomSheet, Card, FadeIn, Pill, PressableScale, Screen, Segmented } from "../src/ui/primitives";

const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", pro_bank: "Pro + Банк" };
const PLAN_COLOR: Record<Plan, string> = { free: "#9AA0B3", pro: "#7C4DFF", pro_bank: "#F5B841" };
const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
  { value: "365", label: "Год" },
];

function formatLastActive(value: string | null): string {
  if (!value) return "ещё не заходил";
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function shortDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** Owner-only view: registration/activity counts, and gifting a subscription by hand
 * ahead of real billing — the same `EntitlementsService.setPlan` a paid checkout will
 * eventually call, just triggered from here instead of a payment webhook. */
export default function Admin() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [giftingUserId, setGiftingUserId] = useState<string | null>(null);
  const [giftPlan, setGiftPlan] = useState<Plan>("pro");
  const [giftDays, setGiftDays] = useState("30");

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.admin.stats(),
  });

  const {
    data: users,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["admin", "users", query],
    queryFn: () => apiClient.admin.searchUsers(query.trim() || undefined),
  });

  const grant = useMutation({
    mutationFn: () =>
      apiClient.admin.grantSubscription(giftingUserId as string, giftPlan, Number(giftDays)),
    onSuccess: async () => {
      setGiftingUserId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const giftingUser = users?.find((u) => u.id === giftingUserId);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Админ-панель" }} />

      <FadeIn index={0}>
        <GradientBox colors={theme.accentGradient} diagonal highlight radius={radii.lg} style={styles.revenueCard}>
          <View style={styles.revenueHead}>
            <View style={styles.revenueBadge}>
              <Icon name="star" color="#FFFFFF" size={22} />
            </View>
            <View style={styles.revenueText}>
              <Text style={styles.revenueLabel}>Выручка Telegram Stars</Text>
              <Text style={styles.revenueValue}>
                {stats?.starsRevenue.total ?? "—"} <Text style={styles.revenueUnit}>⭐</Text>
              </Text>
            </View>
          </View>
          <Text style={styles.revenueSub}>
            За 30 дней: {stats?.starsRevenue.last30Days ?? "—"} ⭐
          </Text>
        </GradientBox>
      </FadeIn>

      <FadeIn index={1}>
        <View style={styles.statsGrid}>
          <StatCard icon="person" label="Всего пользователей" value={stats?.totalUsers} />
          <StatCard icon="chart" label="Активны за сутки" value={stats?.activeToday} />
          <StatCard icon="chart" label="Активны за 30 дней" value={stats?.activeLast30Days} />
          <StatCard icon="card" label="Всего счетов" value={stats?.totalAccounts} />
        </View>
      </FadeIn>

      {stats ? (
        <FadeIn index={2}>
          <Card style={styles.dashboardCard}>
            <Text style={[styles.dashboardTitle, { color: theme.textSecondary }]}>Тарифы</Text>
            <Donut
              caption="Пользователей"
              formatValue={(value) => String(value)}
              slices={(Object.keys(PLAN_LABEL) as Plan[]).map((plan) => ({
                id: plan,
                label: PLAN_LABEL[plan],
                color: PLAN_COLOR[plan],
                value: stats.planBreakdown[plan],
              }))}
            />
          </Card>
        </FadeIn>
      ) : null}

      {stats ? (
        <FadeIn index={3}>
          <Card style={styles.dashboardCard}>
            <BarChart
              accent={theme.accent}
              caption="Регистрации по дням"
              formatValue={(value) => String(value)}
              bars={stats.signupsByDay.map((day) => ({
                key: day.date,
                label: shortDayLabel(day.date),
                value: day.count,
              }))}
            />
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn index={4}>
        <Card style={styles.searchCard}>
          <View style={[styles.searchRow, { backgroundColor: theme.surfaceSunken }]}>
            <Icon name="person" color={theme.textTertiary} size={16} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Имя или Telegram ID"
              placeholderTextColor={theme.textTertiary}
              style={[styles.searchInput, { color: theme.textPrimary }]}
            />
            {isFetching ? <ActivityIndicator size="small" color={theme.accent} /> : null}
          </View>
        </Card>
      </FadeIn>

      {isLoading ? <ActivityIndicator color={theme.accent} style={styles.loader} /> : null}

      {!isLoading && (users ?? []).length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>Никого не нашлось.</Text>
      ) : null}

      {(users ?? []).map((user: AdminUserSummary, index: number) => (
        <FadeIn key={user.id} index={Math.min(index + 5, 10)}>
          <Card style={styles.userCard}>
            <View style={styles.userHeader}>
              <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                {user.displayName}
              </Text>
              <Pill
                label={PLAN_LABEL[user.plan]}
                color={user.plan === "free" ? theme.textSecondary : theme.onAccent}
                background={user.plan === "free" ? theme.surfaceSunken : theme.accent}
              />
            </View>
            <Text style={[styles.userMeta, { color: theme.textTertiary }]}>
              Последний визит: {formatLastActive(user.lastActiveAt)}
            </Text>
            <PressableScale
              onPress={() => {
                setGiftingUserId(user.id);
                setGiftPlan(user.plan === "free" ? "pro" : user.plan);
                setGiftDays("30");
              }}
              style={StyleSheet.flatten([styles.giftButton, { backgroundColor: theme.surfaceSunken }])}
            >
              <Icon name="gift" color={theme.accent} size={16} />
              <Text style={[styles.giftButtonText, { color: theme.accent }]}>
                Подарить подписку
              </Text>
            </PressableScale>
          </Card>
        </FadeIn>
      ))}

      <BottomSheet
        visible={giftingUserId !== null}
        onClose={() => setGiftingUserId(null)}
        title={giftingUser ? `Подарить подписку — ${giftingUser.displayName}` : undefined}
      >
        <View style={styles.sheetContent}>
          <Segmented
            options={[
              { value: "pro" as Plan, label: "Pro" },
              { value: "pro_bank" as Plan, label: "Pro + Банк" },
            ]}
            value={giftPlan === "free" ? "pro" : giftPlan}
            onChange={setGiftPlan}
          />
          <Segmented options={DAY_OPTIONS} value={giftDays} onChange={setGiftDays} />
          <PressableScale
            onPress={() => !grant.isPending && grant.mutate()}
            style={StyleSheet.flatten([styles.confirmButton, { backgroundColor: theme.accent }])}
          >
            <Text style={[styles.confirmButtonText, { color: theme.onAccent }]}>
              {grant.isPending ? "Дарим…" : "Подарить"}
            </Text>
          </PressableScale>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: number | undefined;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} color={theme.accent} size={16} />
      </View>
      <Text style={[styles.statValue, { color: theme.textPrimary }]}>{value ?? "—"}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  revenueCard: { gap: spacing.sm, padding: spacing.lg },
  revenueHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  revenueBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  revenueText: { gap: 2 },
  revenueLabel: { ...typography.caption, color: "rgba(255,255,255,0.85)" },
  revenueValue: { ...typography.display, fontSize: 26, color: "#FFFFFF" },
  revenueUnit: { ...typography.headline, color: "rgba(255,255,255,0.85)" },
  revenueSub: { ...typography.callout, color: "rgba(255,255,255,0.85)" },

  dashboardCard: { gap: spacing.md },
  dashboardTitle: { ...typography.overline, textTransform: "uppercase" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statCard: { width: "47%", gap: 4 },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statValue: { ...typography.display, fontSize: 26 },
  statLabel: typography.caption,

  searchCard: { padding: spacing.sm },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: { ...typography.body, flex: 1, paddingVertical: 4 },

  loader: { marginTop: spacing.lg },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.lg },

  userCard: { gap: spacing.xs },
  userHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  userName: { ...typography.headline, flex: 1 },
  userMeta: typography.caption,
  giftButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  giftButtonText: { ...typography.callout, fontWeight: "600" },

  sheetContent: { gap: spacing.md },
  confirmButton: { borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center" },
  confirmButtonText: { ...typography.callout, fontWeight: "700" },
});
