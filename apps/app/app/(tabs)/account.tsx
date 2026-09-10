import type { TextScaleName } from "@money-dock/design-tokens";
import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, RecurringPayment } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

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
import { categoryColor, categoryIcon } from "../../src/ui/categoryVisual";
import {
  BottomSheet,
  Card,
  FadeIn,
  Pill,
  PressableScale,
  Screen,
  Segmented,
} from "../../src/ui/primitives";
import { formatMinor } from "../../src/utils/format";

/** Web-only: turns the export payload into a downloaded .json file. The Mini App is a
 * web target, so this covers the real use case; native would need Share/FS APIs instead. */
function downloadReport(data: unknown): void {
  if (Platform.OS !== "web") return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `money-dock-report-${new Date().toISOString().slice(0, 10)}.json`;
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

      <CreateRecurringPaymentSheet
        visible={addingPayment}
        onClose={() => setAddingPayment(false)}
        categories={(categories ?? []).filter((c) => c.type === "expense")}
        accountId={accounts?.[0]?.id}
        currency={accounts?.[0]?.currency ?? "RUB"}
        onCreated={() => setAddingPayment(false)}
      />
    </Screen>
  );
}

type RecurringStatus = { label: string; badge: string; color: string; background: string };

/** Purely a display computation — no schedule runs anywhere; this just reads
 * `dueDay`/`reminderDaysBefore`/`lastPaidAt` against today's date on each render. */
function recurringStatus(
  payment: RecurringPayment,
  theme: ReturnType<typeof useTheme>,
): RecurringStatus {
  const now = new Date();
  if (
    payment.lastPaidAt &&
    new Date(payment.lastPaidAt).getFullYear() === now.getFullYear() &&
    new Date(payment.lastPaidAt).getMonth() === now.getMonth()
  ) {
    return {
      label: "оплачено в этом месяце",
      badge: "Оплачено",
      color: theme.positive,
      background: theme.positiveSoft,
    };
  }
  if (payment.dueDay === null) {
    return {
      label: "без даты",
      badge: "В этом месяце",
      color: theme.textSecondary,
      background: theme.surfaceSunken,
    };
  }
  const daysUntil = payment.dueDay - now.getDate();
  if (daysUntil < 0) {
    return {
      label: `просрочено, было ${payment.dueDay} числа`,
      badge: "Просрочено",
      color: theme.negative,
      background: theme.negativeSoft,
    };
  }
  if (payment.reminderDaysBefore !== null && daysUntil <= payment.reminderDaysBefore) {
    return {
      label: `${payment.dueDay} числа`,
      badge: daysUntil === 0 ? "Сегодня" : `Через ${daysUntil} дн.`,
      color: theme.warning,
      background: theme.warningSoft,
    };
  }
  return {
    label: `${payment.dueDay} числа`,
    badge: `${payment.dueDay} числа`,
    color: theme.textSecondary,
    background: theme.surfaceSunken,
  };
}

const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Не напоминать" },
  { value: "1", label: "За 1 день" },
  { value: "3", label: "За 3 дня" },
  { value: "7", label: "За 7 дней" },
];

/** Name, amount, category, and either a fixed day of the month or "sometime this
 * month" — exactly the shape asked for, nothing auto-scheduled server-side. */
function CreateRecurringPaymentSheet({
  visible,
  onClose,
  categories,
  accountId,
  currency,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  accountId: string | undefined;
  currency: string;
  onCreated: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [hasDueDay, setHasDueDay] = useState<"date" | "none">("date");
  const [dueDay, setDueDay] = useState("1");
  const [reminder, setReminder] = useState("3");

  const create = useMutation({
    mutationFn: () => {
      if (!accountId) throw new Error("No account");
      return apiClient.recurringPayments.create({
        accountId,
        categoryId: categoryId ?? undefined,
        name: name.trim(),
        amountMinor: Math.round(Number(amount) * 100),
        currency,
        dueDay: hasDueDay === "date" ? Number(dueDay) : undefined,
        reminderDaysBefore:
          hasDueDay === "date" && reminder !== "none" ? Number(reminder) : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recurring-payments"] });
      setName("");
      setAmount("");
      setCategoryId(null);
      setHasDueDay("date");
      setDueDay("1");
      setReminder("3");
      onCreated();
    },
  });

  const canCreate =
    Boolean(accountId) &&
    name.trim().length > 0 &&
    Number(amount) > 0 &&
    (hasDueDay === "none" || (Number(dueDay) >= 1 && Number(dueDay) <= 31)) &&
    !create.isPending;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Новый регулярный платёж">
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Например, Окко"
        placeholderTextColor={theme.textTertiary}
        style={[
          styles.sheetInput,
          { color: theme.textPrimary, backgroundColor: theme.surfaceSunken },
        ]}
      />
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Сумма в месяц, ₽"
        placeholderTextColor={theme.textTertiary}
        keyboardType="decimal-pad"
        style={[
          styles.sheetInput,
          { color: theme.textPrimary, backgroundColor: theme.surfaceSunken },
        ]}
      />

      {categories.length > 0 ? (
        <>
          <Text style={[styles.sheetLabel, { color: theme.textSecondary }]}>Категория</Text>
          <View style={styles.sheetCategoryRow}>
            {categories.map((c) => {
              const active = categoryId === c.id;
              const color = categoryColor(c);
              return (
                <Pressable key={c.id} onPress={() => setCategoryId(active ? null : c.id)}>
                  <View
                    style={[
                      styles.sheetCategoryCircle,
                      {
                        backgroundColor: active ? color : `${color}1F`,
                        borderColor: active ? color : "transparent",
                      },
                    ]}
                  >
                    <Icon name={categoryIcon(c)} color={active ? "#FFFFFF" : color} size={18} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={[styles.sheetLabel, { color: theme.textSecondary }]}>Дата платежа</Text>
      <Segmented
        value={hasDueDay}
        onChange={setHasDueDay}
        options={[
          { value: "date", label: "Определённого числа" },
          { value: "none", label: "В течение месяца" },
        ]}
      />

      {hasDueDay === "date" ? (
        <>
          <View style={styles.sheetDueDayRow}>
            <Text
              style={[styles.sheetLabel, styles.sheetDueDayLabel, { color: theme.textSecondary }]}
            >
              Число месяца
            </Text>
            <TextInput
              value={dueDay}
              onChangeText={(text) => setDueDay(text.replace(/[^0-9]/g, "").slice(0, 2))}
              keyboardType="number-pad"
              style={[
                styles.sheetDueDayInput,
                { color: theme.textPrimary, backgroundColor: theme.surfaceSunken },
              ]}
            />
          </View>

          <Text style={[styles.sheetLabel, { color: theme.textSecondary }]}>Напоминание</Text>
          <Segmented value={reminder} onChange={setReminder} options={REMINDER_OPTIONS} />
        </>
      ) : null}

      <Pressable
        disabled={!canCreate}
        onPress={() => create.mutate()}
        style={styles.sheetCreateButton}
      >
        {canCreate ? (
          <GradientBox colors={theme.accentGradient} diagonal radius={radii.md}>
            <View style={styles.saveButton}>
              <Text style={[styles.saveText, { color: theme.onAccent }]}>
                {create.isPending ? "Добавляю…" : "Добавить"}
              </Text>
            </View>
          </GradientBox>
        ) : (
          <View style={[styles.saveButton, { backgroundColor: theme.surfaceSunken }]}>
            <Text style={[styles.saveText, { color: theme.textTertiary }]}>Добавить</Text>
          </View>
        )}
      </Pressable>
    </BottomSheet>
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

  sheetInput: {
    ...typography.body,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  sheetLabel: { ...typography.overline, textTransform: "uppercase", marginBottom: spacing.sm },
  sheetCategoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetCategoryCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetDueDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  sheetDueDayLabel: { marginBottom: 0 },
  sheetDueDayInput: {
    ...typography.body,
    width: 64,
    textAlign: "center",
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
  },
  sheetCreateButton: { marginTop: spacing.lg },
  saveButton: { borderRadius: radii.md, paddingVertical: spacing.lg, alignItems: "center" },
  saveText: { ...typography.headline, fontWeight: "700" },
});
