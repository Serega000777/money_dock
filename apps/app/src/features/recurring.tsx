import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, RecurringPayment } from "@money-dock/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../api/client";
import { useTheme } from "../theme/useTheme";
import { GradientBox } from "../ui/Gradient";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { categoryColor, categoryIcon } from "../ui/categoryVisual";
import { BottomSheet, Segmented } from "../ui/primitives";

export type RecurringStatus = { label: string; badge: string; color: string; background: string };

/** Purely a display computation — no schedule runs anywhere; this just reads
 * `dueDay`/`reminderDaysBefore`/`lastPaidAt` against today's date on each render. */
export function recurringStatus(
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
export function CreateRecurringPaymentSheet({
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
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Сумма в месяц, ₽"
        placeholderTextColor={theme.textTertiary}
        keyboardType="decimal-pad"
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />

      {categories.length > 0 ? (
        <>
          <Text style={[sheetStyles.label, { color: theme.textSecondary }]}>Категория</Text>
          <View style={sheetStyles.categoryRow}>
            {categories.map((c) => {
              const active = categoryId === c.id;
              const color = categoryColor(c);
              return (
                <Pressable key={c.id} onPress={() => setCategoryId(active ? null : c.id)}>
                  <View
                    style={[
                      sheetStyles.categoryCircle,
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

      <Text style={[sheetStyles.label, { color: theme.textSecondary }]}>Дата платежа</Text>
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
          <View style={sheetStyles.dueDayRow}>
            <Text
              style={[sheetStyles.label, sheetStyles.dueDayLabel, { color: theme.textSecondary }]}
            >
              Число месяца
            </Text>
            <TextInput
              value={dueDay}
              onChangeText={(text) => setDueDay(text.replace(/[^0-9]/g, "").slice(0, 2))}
              keyboardType="number-pad"
              style={[
                sheetStyles.dueDayInput,
                { color: theme.textPrimary, backgroundColor: theme.surfaceSunken },
              ]}
            />
          </View>

          <Text style={[sheetStyles.label, { color: theme.textSecondary }]}>Напоминание</Text>
          <Segmented value={reminder} onChange={setReminder} options={REMINDER_OPTIONS} />
        </>
      ) : null}

      <SheetSubmit
        label={create.isPending ? "Добавляю…" : "Добавить"}
        enabled={canCreate}
        onPress={() => create.mutate()}
      />
    </BottomSheet>
  );
}

/** The sheets' one primary action — gradient when enabled, sunken when not. */
export function SheetSubmit({
  label,
  enabled,
  onPress,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable disabled={!enabled} onPress={onPress} style={sheetStyles.submitWrap}>
      {enabled ? (
        <GradientBox colors={theme.accentGradient} diagonal radius={radii.md}>
          <View style={sheetStyles.submit}>
            <Text style={[sheetStyles.submitText, { color: theme.onAccent }]}>{label}</Text>
          </View>
        </GradientBox>
      ) : (
        <View style={[sheetStyles.submit, { backgroundColor: theme.surfaceSunken }]}>
          <Text style={[sheetStyles.submitText, { color: theme.textTertiary }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Shared by every "create something" bottom sheet so their fields line up. */
export const sheetStyles = StyleSheet.create({
  input: {
    ...typography.body,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  label: { ...typography.overline, textTransform: "uppercase", marginBottom: spacing.sm },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dueDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  dueDayLabel: { marginBottom: 0 },
  dueDayInput: {
    ...typography.body,
    width: 64,
    textAlign: "center",
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
  },
  submitWrap: { marginTop: spacing.lg },
  submit: { borderRadius: radii.md, paddingVertical: spacing.lg, alignItems: "center" },
  submitText: { ...typography.headline, fontWeight: "700" },
});
