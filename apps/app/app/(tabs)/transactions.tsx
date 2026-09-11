import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, Transaction } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/auth/authStore";
import { useTheme } from "../../src/theme/useTheme";
import { GradientBox } from "../../src/ui/Gradient";
import { Icon } from "../../src/ui/Icon";
import { NumericKeypad } from "../../src/ui/NumericKeypad";
import { DatePickerSheet } from "../../src/ui/PeriodPicker";
import { Text } from "../../src/ui/Text";
import { categoryColor, categoryIcon } from "../../src/ui/categoryVisual";
import {
  BottomSheet,
  Card,
  FadeIn,
  PressableScale,
  Screen,
  ScreenTitle,
  Segmented,
} from "../../src/ui/primitives";
import { formatMinor } from "../../src/utils/format";

/** "Сегодня" / "Вчера" read faster than a date for the two days people actually check. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return "Сегодня";
  if (days === 1) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Appends/backspaces/adds-a-decimal-point — same little parser as add-transaction.tsx's
 * keypad, so editing an amount behaves identically to entering one. */
function applyKey(amount: string, key: string): string {
  if (key === "back") return amount.slice(0, -1);
  if (key === ".") return amount.includes(".") ? amount : `${amount || "0"}.`;
  if (amount === "0") return key;
  return amount + key;
}

export default function Transactions() {
  const theme = useTheme();
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken);
  const [openTransaction, setOpenTransaction] = useState<Transaction | null>(null);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiClient.transactions.list({ limit: 200 }),
    enabled,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.list(),
    enabled,
  });

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c: Category) => [c.id, c])),
    [categories],
  );

  // Grouping by day turns a flat wall of rows into something scannable.
  const sections = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const tx of (transactions ?? []) as Transaction[]) {
      const key = tx.occurredAt.slice(0, 10);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(tx);
      else byDay.set(key, [tx]);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, data]) => ({
        title: dayLabel(day),
        total: data.reduce(
          (sum, t) =>
            sum + (t.type === "expense" ? -t.amountMinor : t.type === "income" ? t.amountMinor : 0),
          0,
        ),
        data,
      }));
  }, [transactions]);

  return (
    <Screen>
      <ScreenTitle title="Операции" subtitle="История по дням" />

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={theme.accent} />
      ) : sections.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Операций пока нет. Добавьте первую — голосом или вручную.
        </Text>
      ) : (
        sections.map((section, sectionIndex) => (
          <FadeIn key={section.title} index={Math.min(sectionIndex, 6)}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionTotal, { color: theme.textTertiary }]}>
                {section.total > 0 ? "+" : ""}
                {formatMinor(section.total)} ₽
              </Text>
            </View>
            {/* One card per day, however many transactions it holds — not one card per
                transaction, which read as a wall of separately-shadowed boxes. */}
            <Card style={styles.groupCard}>
              {section.data.map((item, index) => {
                const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
                const transfer = item.type === "transfer";
                const income = item.type === "income";
                const tint = transfer
                  ? theme.textSecondary
                  : income
                    ? theme.positive
                    : categoryColor(category);

                return (
                  <View key={item.id}>
                    {index > 0 ? (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    ) : null}
                    <Pressable
                      style={styles.row}
                      onPress={() => setOpenTransaction(item)}
                      accessibilityLabel={`Операция: ${item.merchant ?? "без описания"}`}
                    >
                      <View style={[styles.avatar, { backgroundColor: `${tint}1F` }]}>
                        <Icon
                          name={transfer ? "card" : income ? "wallet" : categoryIcon(category)}
                          color={tint}
                          size={19}
                        />
                      </View>
                      <View style={styles.rowMain}>
                        <Text
                          style={[styles.merchant, { color: theme.textPrimary }]}
                          numberOfLines={1}
                        >
                          {item.merchant ?? "Без описания"}
                        </Text>
                        <Text
                          style={[styles.meta, { color: theme.textSecondary }]}
                          numberOfLines={1}
                        >
                          {transfer ? "Перевод между счетами" : (category?.name ?? "Без категории")}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.amount,
                          {
                            color: income
                              ? theme.positive
                              : transfer
                                ? theme.textSecondary
                                : theme.textPrimary,
                          },
                        ]}
                      >
                        {income ? "+" : item.type === "expense" ? "−" : ""}
                        {formatMinor(item.amountMinor)} ₽
                      </Text>
                      <Icon name="chevron" color={theme.textTertiary} size={14} />
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </FadeIn>
        ))
      )}

      {openTransaction ? (
        <TransactionDetailSheet
          transaction={openTransaction}
          categories={categories ?? []}
          onClose={() => setOpenTransaction(null)}
        />
      ) : null}
    </Screen>
  );
}

/** Tap any row to open this — amount, category, date, expense/income all editable in
 * place, plus delete. A transfer leg stays read-only here (see the service's own
 * rejection of re-typing one): both legs have to agree on what they are, so editing one
 * side alone would desync the pair. */
function TransactionDetailSheet({
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

  const visibleCategories = categories.filter((c) => c.type === type);
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
  loader: { marginTop: spacing.xxl },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  sectionTitle: { ...typography.overline, textTransform: "uppercase" },
  sectionTotal: typography.caption,

  // One card per day; rows inside it are plain, separated by a hairline divider.
  groupCard: { paddingVertical: spacing.xs, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 38 + spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: { flex: 1, gap: 2 },
  merchant: typography.body,
  meta: typography.caption,
  amount: { ...typography.body, fontWeight: "600" },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.xxl },

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
