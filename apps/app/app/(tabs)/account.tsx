import type { TextScaleName } from "@money-dock/design-tokens";
import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTelegram } from "../../src/telegram/TelegramProvider";
import {
  useSettingsStore,
  type HomeLeftMetric,
  type HomeRightMetric,
  type ThemeMode,
} from "../../src/theme/settingsStore";
import { useTheme } from "../../src/theme/useTheme";
import { GradientBox } from "../../src/ui/Gradient";
import { Icon, type IconName } from "../../src/ui/Icon";
import { Text } from "../../src/ui/Text";
import { Card, FadeIn, PressableScale, Screen, Segmented } from "../../src/ui/primitives";
import { formatMinor } from "../../src/utils/format";

/** Everything that used to be split across "План" and "Ещё" lives here. */
export default function Account() {
  const theme = useTheme();
  const { isInsideTelegram, user } = useTelegram();
  const {
    themeMode,
    textScale,
    homeLeftMetric,
    homeRightMetric,
    setThemeMode,
    setTextScale,
    setHomeLeftMetric,
    setHomeRightMetric,
  } = useSettingsStore();
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => apiClient.users.me(), enabled });
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
  const { data: notes } = useQuery({
    queryKey: ["notes"],
    queryFn: () => apiClient.notes.list(),
    enabled,
  });
  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => apiClient.entitlements.get(),
    enabled,
  });

  const pendingCount = reviewItems?.length ?? 0;
  const name = me?.displayName ?? user?.first_name ?? "Личный кабинет";
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <Screen>
      <FadeIn index={0}>
        <Card style={styles.profile}>
          <GradientBox
            colors={theme.accentGradient}
            diagonal
            radius={radii.pill}
            style={styles.avatar}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </GradientBox>
          <View style={styles.profileText}>
            <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {isInsideTelegram ? "Вход через Telegram" : "Демо-режим"} ·{" "}
              {me?.baseCurrency ?? "RUB"}
            </Text>
          </View>
          <View
            style={[
              styles.planBadge,
              {
                backgroundColor: entitlements?.plan === "free" ? theme.surfaceSunken : theme.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.planBadgeText,
                { color: entitlements?.plan === "free" ? theme.textSecondary : theme.onAccent },
              ]}
            >
              {entitlements?.plan === "free" ? "Free" : "Pro"}
            </Text>
          </View>
        </Card>
      </FadeIn>

      <FadeIn index={1}>
        <Section title="Проверка и импорт">
          <NavRow
            href="/review-inbox"
            icon="inbox"
            label="Нужно проверить"
            badge={pendingCount > 0 ? String(pendingCount) : undefined}
          />
          <NavRow href="/import" icon="upload" label="Импорт выписки" />
        </Section>
      </FadeIn>

      <FadeIn index={2}>
        <Section title="Заметки">
          <NavRow
            href="/notes"
            icon="note"
            label="Мои заметки"
            hint={notes?.length ? `${notes.length}` : "пусто"}
          />
        </Section>
      </FadeIn>

      <FadeIn index={3}>
        <Section title="Счета">
          {(accounts ?? []).map((account) => (
            <View key={account.id} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
                <Icon name="card" color={theme.accent} size={18} />
              </View>
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
      </FadeIn>

      <FadeIn index={4}>
        <Section title="Главный экран">
          <View style={styles.settingBlock}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>
              Слева на карточке
            </Text>
            <Segmented<HomeLeftMetric>
              value={homeLeftMetric}
              onChange={setHomeLeftMetric}
              options={[
                { value: "expense", label: "Расход" },
                { value: "income", label: "Доход" },
              ]}
            />
          </View>
          <View style={styles.settingBlock}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>
              Справа на карточке
            </Text>
            <Segmented<HomeRightMetric>
              value={homeRightMetric}
              onChange={setHomeRightMetric}
              options={[
                { value: "remaining", label: "Остаток" },
                { value: "free", label: "Свободные деньги" },
              ]}
            />
          </View>
        </Section>
      </FadeIn>

      <FadeIn index={6}>
        <Section title="Внешний вид">
          <View style={styles.settingBlock}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Тема</Text>
            <Segmented<ThemeMode>
              value={themeMode}
              onChange={setThemeMode}
              options={[
                { value: "system", label: "Система" },
                { value: "light", label: "Светлая" },
                { value: "dark", label: "Тёмная" },
              ]}
            />
          </View>
          <View style={styles.settingBlock}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>
              Размер интерфейса
            </Text>
            <Segmented<TextScaleName>
              value={textScale}
              onChange={setTextScale}
              options={[
                { value: "small", label: "Меньше" },
                { value: "medium", label: "Обычный" },
                { value: "large", label: "Больше" },
              ]}
            />
          </View>
        </Section>
      </FadeIn>

      <FadeIn index={7}>
        <Section title="Тариф">
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
      </FadeIn>

      <FadeIn index={8}>
        <Section title="Скоро">
          <Text style={[styles.soon, { color: theme.textSecondary }]}>
            Регулярные платежи, экспорт данных, Telegram-уведомления и подключение банков появятся
            на следующих этапах.
          </Text>
        </Section>
      </FadeIn>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

function NavRow({
  href,
  icon,
  label,
  badge,
  hint,
}: {
  href: Href;
  icon: IconName;
  label: string;
  badge?: string;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <PressableScale style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name={icon} color={theme.accent} size={18} />
        </View>
        <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.badgeText, { color: theme.onAccent }]}>{badge}</Text>
          </View>
        ) : null}
        {hint ? <Text style={[styles.rowValue, { color: theme.textTertiary }]}>{hint}</Text> : null}
        <Icon name="chevron" color={theme.textTertiary} size={18} />
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48 },
  avatarInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.title, color: "#FFFFFF", fontWeight: "700" },
  profileText: { flex: 1, gap: 2 },
  name: typography.headline,
  subtitle: typography.caption,
  planBadge: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  planBadgeText: { ...typography.caption, fontWeight: "700" },

  section: { gap: spacing.sm },
  sectionTitle: { ...typography.overline, textTransform: "uppercase" },
  card: { paddingVertical: spacing.xs, gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { ...typography.body, flex: 1 },
  rowValue: typography.callout,
  badge: {
    minWidth: 26,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { ...typography.caption, fontWeight: "700", textAlign: "center" },

  settingBlock: { gap: spacing.sm, paddingVertical: spacing.md },
  settingLabel: typography.caption,

  soon: { ...typography.caption, paddingVertical: spacing.md, lineHeight: 19 },
});
