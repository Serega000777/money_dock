import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { AdminUserSummary, Plan } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { Icon } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { BottomSheet, Card, FadeIn, Pill, PressableScale, Screen, Segmented } from "../src/ui/primitives";

const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", pro_bank: "Pro + Банк" };
const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
  { value: "365", label: "Год" },
];

function formatLastActive(value: string | null): string {
  if (!value) return "ещё не заходил";
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
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
        <View style={styles.statsGrid}>
          <StatCard label="Всего пользователей" value={stats?.totalUsers} />
          <StatCard label="Активны за сутки" value={stats?.activeToday} />
          <StatCard label="Активны за 30 дней" value={stats?.activeLast30Days} />
          <StatCard label="Всего счетов" value={stats?.totalAccounts} />
        </View>
      </FadeIn>

      <FadeIn index={1}>
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
        <FadeIn key={user.id} index={Math.min(index + 2, 8)}>
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

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  const theme = useTheme();
  return (
    <Card gradient style={styles.statCard}>
      <Text style={[styles.statValue, { color: theme.textPrimary }]}>{value ?? "—"}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statCard: { width: "47%", gap: 2 },
  statValue: { ...typography.display, fontSize: 28 },
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
