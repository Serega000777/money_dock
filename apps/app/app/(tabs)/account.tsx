import type { TextScaleName } from "@money-dock/design-tokens";
import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { CreateAccountSheet } from "../../src/features/accounts";
import { CreateRecurringPaymentSheet, recurringStatus } from "../../src/features/recurring";
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
import { categoryColor, categoryIcon } from "../../src/ui/categoryVisual";
import {
  Card,
  FadeIn,
  Pill,
  PressableScale,
  Screen,
  Segmented,
} from "../../src/ui/primitives";
import { fileToAvatarDataUrl } from "../../src/utils/avatar";
import { formatMinor } from "../../src/utils/format";

/** Web-only: turns the export payload into a downloaded .json file. The Mini App is a
 * web target, so this covers the real use case; native would need Share/FS APIs instead. */
function downloadReport(data: unknown): void {
  if (Platform.OS !== "web") return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `amola-report-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

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
  const queryClient = useQueryClient();
  const [addingPayment, setAddingPayment] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.list(),
    enabled,
  });
  const { data: recurringPayments } = useQuery({
    queryKey: ["recurring-payments"],
    queryFn: () => apiClient.recurringPayments.list(),
    enabled,
  });
  const generateReport = useMutation({
    mutationFn: () => apiClient.exports.generate(),
    onSuccess: (data) => downloadReport(data),
  });
  const updateAvatar = useMutation({
    mutationFn: (avatarUrl: string | null) => apiClient.users.updateMe({ avatarUrl }),
    onSuccess: (updated) => {
      setAvatarError(null);
      queryClient.setQueryData(["me"], updated);
    },
    onError: (e: Error) => setAvatarError(e.message),
  });
  const invalidatePayments = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["recurring-payments"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
    ]);
  const payRecurring = useMutation({
    mutationFn: (id: string) => apiClient.recurringPayments.pay(id),
    onSuccess: invalidatePayments,
  });
  const removeRecurring = useMutation({
    mutationFn: (id: string) => apiClient.recurringPayments.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-payments"] }),
  });

  const pendingCount = reviewItems?.length ?? 0;
  const name = me?.displayName ?? user?.first_name ?? "Личный кабинет";
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <Screen>
      <FadeIn index={0}>
        <Card style={styles.profile}>
          <PressableScale
            accessibilityLabel="Изменить фото профиля"
            onPress={() => Platform.OS === "web" && avatarInputRef.current?.click()}
          >
            {me?.avatarUrl ? (
              <Image source={{ uri: me.avatarUrl }} style={styles.avatar} />
            ) : (
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
            )}
            <View style={[styles.avatarBadge, { backgroundColor: theme.surface, borderColor: theme.background }]}>
              <Icon name="camera" color={theme.textSecondary} size={13} strokeWidth={1.8} />
            </View>
          </PressableScale>
          {Platform.OS === "web" ? (
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const dataUrl = await fileToAvatarDataUrl(file);
                  updateAvatar.mutate(dataUrl);
                } catch {
                  setAvatarError("Не удалось обработать изображение");
                }
              }}
            />
          ) : null}
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
        {avatarError ? (
          <Text style={[styles.avatarError, { color: theme.negative }]}>{avatarError}</Text>
        ) : null}
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
        <Section title="Автоматизация">
          <NavRow href="/quick-entry" icon="bolt" label="Быстрый ввод" hint="Apple Shortcuts" />
        </Section>
      </FadeIn>

      <FadeIn index={3}>
        <Section title="Заметки">
          <NavRow
            href="/notes"
            icon="note"
            label="Мои заметки"
            hint={notes?.length ? `${notes.length}` : "пусто"}
          />
        </Section>
      </FadeIn>

      <FadeIn index={4}>
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
              {account.role === "owner" ? <Link href={{ pathname: "/account-sharing", params: { id: account.id } }} asChild><PressableScale><Icon name="person" color={theme.accent} size={18} /></PressableScale></Link> : null}
            </View>
          ))}
          {accounts?.length === 0 ? (
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>Счетов пока нет</Text>
          ) : null}
          <PressableScale style={styles.row} onPress={() => setAddingAccount(true)}>
            <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="plus" color={theme.accent} size={18} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.accent }]}>Добавить счёт</Text>
          </PressableScale>
        </Section>
      </FadeIn>

      <FadeIn index={4}>
        <Section title="Регулярные платежи">
          {(recurringPayments ?? []).map((payment) => {
            const category = payment.categoryId
              ? (categories ?? []).find((c) => c.id === payment.categoryId)
              : undefined;
            const color = categoryColor(category);
            const status = recurringStatus(payment, theme);
            return (
              <View key={payment.id} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: `${color}1F` }]}>
                  <Icon name={categoryIcon(category)} color={color} size={18} />
                </View>
                <View style={styles.rowMain}>
                  <Text style={[styles.rowLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                    {payment.name}
                  </Text>
                  <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                    {formatMinor(payment.amountMinor)} ₽ · {status.label}
                  </Text>
                </View>
                <Pill label={status.badge} color={status.color} background={status.background} />
                <Pressable
                  onPress={() => !payRecurring.isPending && payRecurring.mutate(payment.id)}
                  accessibilityLabel="Отметить оплаченным"
                  hitSlop={8}
                  style={styles.iconButton}
                >
                  <Icon name="check" color={theme.positive} size={18} />
                </Pressable>
                <Pressable
                  onPress={() => removeRecurring.mutate(payment.id)}
                  accessibilityLabel="Удалить платёж"
                  hitSlop={8}
                  style={styles.iconButton}
                >
                  <Icon name="trash" color={theme.textTertiary} size={18} />
                </Pressable>
              </View>
            );
          })}
          {(recurringPayments ?? []).length === 0 ? (
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>Платежей пока нет</Text>
          ) : null}

          <PressableScale style={styles.row} onPress={() => setAddingPayment(true)}>
            <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="plus" color={theme.accent} size={18} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.accent }]}>Добавить платёж</Text>
          </PressableScale>
        </Section>
      </FadeIn>

      <FadeIn index={5}>
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
            {/* A plain light/dark toggle — "Система" used to sit alongside them, but it
                only ever resolved to one of these two anyway, and until Telegram reports
                its colour scheme (an async round trip) it defaulted to light even inside
                a dark chat, which read as "the first two options are the same" the moment
                that happened. Existing `system` users land on whichever this device
                currently resolves to (`theme.name`); picking either button here now sets
                an explicit choice, same as before. */}
            <Segmented<ThemeMode>
              value={themeMode === "system" ? theme.name : themeMode}
              onChange={setThemeMode}
              options={[
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
        <Section title="Данные">
          <PressableScale
            style={styles.row}
            onPress={() => !generateReport.isPending && generateReport.mutate()}
          >
            <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="note" color={theme.accent} size={18} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              {generateReport.isPending ? "Формирую…" : "Сформировать отчёт"}
            </Text>
            <Icon name="chevron" color={theme.textTertiary} size={18} />
          </PressableScale>
        </Section>
      </FadeIn>

      <FadeIn index={9}>
        <Section title="Правовая информация">
          <NavRow href="/legal/privacy" icon="note" label="Политика конфиденциальности" />
          <NavRow href="/legal/terms" icon="note" label="Условия использования" />
          <NavRow href="/legal/personal-data" icon="note" label="О персональных данных" />
        </Section>
      </FadeIn>

      <FadeIn index={10}>
        <Section title="Скоро">
          <Text style={[styles.soon, { color: theme.textSecondary }]}>
            Telegram-уведомления и подключение банков появятся на следующих этапах.
          </Text>
        </Section>
      </FadeIn>

      {me?.role === "admin" ? (
        <FadeIn index={11}>
          <Section title="Админ">
            <NavRow href="/admin" icon="shield" label="Админ-панель" />
          </Section>
        </FadeIn>
      ) : null}

      <CreateAccountSheet visible={addingAccount} onClose={() => setAddingAccount(false)} />
      <CreateRecurringPaymentSheet
        visible={addingPayment}
        onClose={() => setAddingPayment(false)}
        categories={(categories ?? []).filter((c) => c.type === "expense" || c.type === "both")}
        accountId={accounts?.[0]?.id}
        currency={accounts?.[0]?.currency ?? "RUB"}
        onCreated={() => setAddingPayment(false)}
      />
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
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.title, color: "#FFFFFF", fontWeight: "700" },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarError: { ...typography.caption, marginTop: -spacing.xs },
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
  rowMain: { flex: 1, gap: 2 },
  rowSub: typography.caption,
  rowValue: typography.callout,
  iconButton: { paddingHorizontal: 2 },
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
