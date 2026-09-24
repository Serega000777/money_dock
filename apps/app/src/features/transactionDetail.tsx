import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, Transaction } from "@money-dock/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../api/client";
import { useTheme } from "../theme/useTheme";
import { GradientBox } from "../ui/Gradient";
import { Icon } from "../ui/Icon";
import { NumericKeypad } from "../ui/NumericKeypad";
import { DatePickerSheet } from "../ui/PeriodPicker";
import { Text } from "../ui/Text";
import { categoryColor, categoryIcon } from "../ui/categoryVisual";
import { BottomSheet, PressableScale, Segmented } from "../ui/primitives";

/** Appends/backspaces/adds-a-decimal-point — same little parser as add-transaction.tsx's
 * keypad, so editing an amount behaves identically to entering one. */
function applyKey(amount: string, key: string): string {
  if (key === "back") return amount.slice(0, -1);
  if (key === ".") return amount.includes(".") ? amount : `${amount || "0"}.`;
  if (amount === "0") return key;
  return amount + key;
}

/**
 * Tap any transaction row to open this — amount, category, date, expense/income all
 * editable in place, plus delete. Shared by the "Операции" list and Analytics' per-
 * category breakdown sheet, so editing behaves identically wherever a transaction is
 * tapped from. A transfer leg stays read-only here (see the service's own rejection of
 * re-typing one): both legs have to agree on what they are, so editing one side alone
 * would desync the pair.
 */
export function TransactionDetailSheet({
  transaction,
  categories,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isTransfer = transaction.type === "transfer";

  const [type, setType] = useState<"expense" | "income">(
    transaction.type === "income" ? "income" : "expense",
  );
  const [amount, setAmount] = useState(String(transaction.amountMinor / 100));
  const [merchant, setMerchant] = useState(transaction.merchant ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(transaction.categoryId);
  const [occurredAt, setOccurredAt] = useState(new Date(transaction.occurredAt));
  const [pickingDate, setPickingDate] = useState(false);

  // Re-seed every field when a different row is tapped without unmounting the sheet.
  useEffect(() => {
    setType(transaction.type === "income" ? "income" : "expense");
    setAmount(String(transaction.amountMinor / 100));
    setMerchant(transaction.merchant ?? "");
    setCategoryId(transaction.categoryId);
    setOccurredAt(new Date(transaction.occurredAt));
  }, [transaction]);

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
    ]);

  const save = useMutation({
    mutationFn: () =>
      apiClient.transactions.update(transaction.id, {
        type: isTransfer ? undefined : type,
        amountMinor: Math.round(Number(amount) * 100),
        merchant: merchant.trim() || undefined,
        // Omitted (not cleared) when nothing new was picked — the API has no way to
        // null out a category, only to point it at a different one.
        categoryId: categoryId ?? undefined,
        occurredAt: occurredAt.toISOString(),
      }),
    onSuccess: async () => {
      await invalidateAll();
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => apiClient.transactions.remove(transaction.id),
    onSuccess: async () => {
      await invalidateAll();
      onClose();
    },
  });

  const visibleCategories = categories.filter((c) => c.type === type || c.type === "both");
  const canSave = Number(amount) > 0 && !save.isPending && !remove.isPending;

  return (
    <BottomSheet visible onClose={onClose} title="Операция">
      {isTransfer ? (
        <Text style={[styles.transferNote, { color: theme.textSecondary }]}>
          Это перевод между своими счетами — сумму и категорию менять нельзя, обе стороны перевода
          должны остаться согласованы. Дату исправить можно, либо удалите перевод целиком.
        </Text>
      ) : (
        <Segmented
          value={type}
          onChange={(next: "expense" | "income") => {
            setType(next);
            setCategoryId(null);
          }}
          options={[
            { value: "expense", label: "Расход" },
            { value: "income", label: "Доход" },
          ]}
        />
      )}

      <View style={styles.amountRow}>
        <Text style={[styles.amountText, { color: theme.textPrimary }]} numberOfLines={1}>
          {amount || "0"}
        </Text>
        <Text style={[styles.currency, { color: theme.textTertiary }]}>{transaction.currency}</Text>
      </View>

      {!isTransfer ? (
        <NumericKeypad onKey={(key) => setAmount((prev) => applyKey(prev, key))} />
      ) : null}

      <TextInput
        value={merchant}
        onChangeText={setMerchant}
        placeholder="Где потрачено"
        placeholderTextColor={theme.textTertiary}
        style={[
          styles.merchantInput,
          { color: theme.textPrimary, backgroundColor: theme.surfaceSunken },
        ]}
      />

      <Pressable
        style={[styles.dateRow, { backgroundColor: theme.surfaceSunken }]}
        onPress={() => setPickingDate(true)}
      >
        <Icon name="calendar" color={theme.textSecondary} size={16} />
        <Text style={[styles.dateText, { color: theme.textPrimary }]}>
          {occurredAt.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Icon name="chevron" color={theme.textTertiary} size={14} />
      </Pressable>

      {!isTransfer ? (
        <>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Категория</Text>
          <View style={styles.categoryGrid}>
            {visibleCategories.map((c) => {
              const active = categoryId === c.id;
              const color = categoryColor(c);
              return (
                <View key={c.id} style={styles.categoryItem}>
                  <PressableScale
                    onPress={() => setCategoryId(c.id)}
                    style={styles.categoryItemInner}
                  >
                    <View
                      style={[
                        styles.categoryCircle,
                        { backgroundColor: active ? color : `${color}1F` },
                      ]}
                    >
                      <Icon name={categoryIcon(c)} color={active ? "#FFFFFF" : color} size={20} />
                    </View>
                    <Text
                      style={[styles.categoryLabel, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </PressableScale>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <Pressable disabled={!canSave} onPress={() => save.mutate()} style={styles.saveWrap}>
        {canSave ? (
          <GradientBox colors={theme.accentGradient} diagonal radius={radii.md}>
            <View style={styles.saveButton}>
              <Text style={[styles.saveText, { color: theme.onAccent }]}>
                {save.isPending ? "Сохраняю…" : "Сохранить"}
              </Text>
            </View>
          </GradientBox>
        ) : (
          <View style={[styles.saveButton, { backgroundColor: theme.surfaceSunken }]}>
            <Text style={[styles.saveText, { color: theme.textTertiary }]}>
              {save.isPending ? "Сохраняю…" : "Сохранить"}
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        disabled={remove.isPending || save.isPending}
        onPress={() => remove.mutate()}
        style={styles.deleteButton}
      >
        <Icon name="trash" color={theme.negative} size={16} />
        <Text style={[styles.deleteText, { color: theme.negative }]}>
          {remove.isPending ? "Удаляю…" : "Удалить операцию"}
        </Text>
      </Pressable>

      <DatePickerSheet
        visible={pickingDate}
        onClose={() => setPickingDate(false)}
        initialDate={occurredAt}
        maxDate={new Date()}
        onSelect={(day) => {
          setOccurredAt(day);
          setPickingDate(false);
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  transferNote: { ...typography.callout, lineHeight: 20, marginBottom: spacing.md },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  amountText: { ...typography.hero, fontSize: 40, lineHeight: 46, flex: 1 },
  currency: { ...typography.display, fontWeight: "500" },
  merchantInput: {
    ...typography.body,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  dateText: { ...typography.body, flex: 1 },
  label: {
    ...typography.overline,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  categoryItem: { width: "22%" },
  categoryItemInner: { alignItems: "center", gap: spacing.xs },
  categoryCircle: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: { ...typography.caption, textAlign: "center" },

  saveWrap: { marginTop: spacing.lg },
  saveButton: { borderRadius: radii.md, paddingVertical: spacing.lg, alignItems: "center" },
  saveText: { ...typography.headline, fontWeight: "700" },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  deleteText: { ...typography.callout, fontWeight: "600" },
});
