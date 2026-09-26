import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Debt, DebtDirection } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { SheetSubmit, sheetStyles } from "../src/features/recurring";
import { useTheme } from "../src/theme/useTheme";
import { GradientBox } from "../src/ui/Gradient";
import { Icon } from "../src/ui/Icon";
import { DatePickerSheet } from "../src/ui/PeriodPicker";
import { Text } from "../src/ui/Text";
import {
  BottomSheet,
  Card,
  FadeIn,
  PressableScale,
  Screen,
  ScreenTitle,
  Segmented,
} from "../src/ui/primitives";
import { formatMinor } from "../src/utils/format";

const FIVE_YEARS_MS = 5 * 365 * 86_400_000;

/**
 * A personal ledger, not a payment feature — two lists (who owes the user, who the user
 * owes), each debt marked settled by hand. Nothing here moves money or notifies anyone.
 */
export default function Debts() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<DebtDirection>("owed_to_me");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  const { data: debts } = useQuery({ queryKey: ["debts"], queryFn: () => apiClient.debts.list() });

  const filtered = useMemo(
    () => (debts ?? []).filter((d) => d.direction === direction),
    [debts, direction],
  );
  const open = filtered.filter((d) => !d.settledAt);
  const settled = filtered.filter((d) => d.settledAt);
  const totalOpen = open.reduce((sum, d) => sum + d.amountMinor, 0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["debts"] });
  const settle = useMutation({
    mutationFn: (id: string) => apiClient.debts.settle(id),
    onSuccess: invalidate,
  });
  const unsettle = useMutation({
    mutationFn: (id: string) => apiClient.debts.unsettle(id),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.debts.remove(id),
    onSuccess: invalidate,
  });

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Долги" }} />
      <ScreenTitle title="Долги" subtitle="Кто должен вам, и кому должны вы" />

      <FadeIn index={0}>
        <Segmented<DebtDirection>
          value={direction}
          onChange={setDirection}
          options={[
            { value: "owed_to_me", label: "Мне должны" },
            { value: "i_owe", label: "Я должен" },
          ]}
        />
      </FadeIn>

      <FadeIn index={1}>
        <GradientBox colors={theme.accentGradient} diagonal radius={radii.lg} style={styles.summary}>
          <Text style={styles.summaryLabel}>
            {direction === "owed_to_me" ? "Вам должны" : "Вы должны"}
          </Text>
          <Text style={styles.summaryValue}>{formatMinor(totalOpen)} ₽</Text>
        </GradientBox>
      </FadeIn>

      {open.length === 0 && settled.length === 0 ? (
        <FadeIn index={2}>
          <Text style={[styles.empty, { color: theme.textSecondary }]}>
            {direction === "owed_to_me" ? "Пока никто вам не должен" : "Пока вы никому не должны"}
          </Text>
        </FadeIn>
      ) : null}

      {open.length > 0 ? (
        <FadeIn index={2}>
          <Card style={styles.listCard}>
            {open.map((debt, i) => (
              <View key={debt.id}>
                {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                <DebtRow
                  debt={debt}
                  onPress={() => setEditing(debt)}
                  onSettle={() => settle.mutate(debt.id)}
                />
              </View>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      {settled.length > 0 ? (
        <FadeIn index={3}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Закрытые</Text>
          <Card style={styles.listCard}>
            {settled.map((debt, i) => (
              <View key={debt.id}>
                {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                <DebtRow
                  debt={debt}
                  settled
                  onPress={() => setEditing(debt)}
                  onSettle={() => unsettle.mutate(debt.id)}
                />
              </View>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn index={4}>
        <PressableScale onPress={() => setCreating(true)} style={styles.addRow}>
          <View style={[styles.addIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="plus" color={theme.accent} size={18} />
          </View>
          <Text style={[styles.addLabel, { color: theme.accent }]}>Добавить долг</Text>
        </PressableScale>
      </FadeIn>

      <DebtSheet
        visible={creating}
        defaultDirection={direction}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          invalidate();
        }}
      />

      {editing ? (
        <DebtSheet
          visible
          debt={editing}
          defaultDirection={editing.direction}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
          onDeleted={() => {
            const id = editing.id;
            setEditing(null);
            remove.mutate(id);
          }}
        />
      ) : null}
    </Screen>
  );
}

function DebtRow({
  debt,
  settled,
  onPress,
  onSettle,
}: {
  debt: Debt;
  settled?: boolean;
  onPress: () => void;
  onSettle: () => void;
}) {
  const theme = useTheme();
  const overdue = !settled && Boolean(debt.dueDate) && new Date(debt.dueDate!).getTime() < Date.now();

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: overdue ? theme.negativeSoft : theme.accentSoft },
        ]}
      >
        <Icon name="wallet" color={overdue ? theme.negative : theme.accent} size={18} />
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowName, { color: theme.textPrimary }]} numberOfLines={1}>
          {debt.counterpartyName}
        </Text>
        <Text
          style={[styles.rowMeta, { color: overdue ? theme.negative : theme.textSecondary }]}
          numberOfLines={1}
        >
          {debt.dueDate
            ? `${overdue ? "Просрочено, было " : "До "}${new Date(debt.dueDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
            : (debt.note ?? "Без срока")}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: theme.textPrimary }]}>
        {formatMinor(debt.amountMinor)} ₽
      </Text>
      <Pressable
        onPress={onSettle}
        hitSlop={8}
        accessibilityLabel={settled ? "Вернуть в открытые" : "Отметить погашенным"}
        style={styles.settleButton}
      >
        <Icon
          name={settled ? "refresh" : "check"}
          color={settled ? theme.textTertiary : theme.positive}
          size={18}
        />
      </Pressable>
    </Pressable>
  );
}

/** Create when `debt` is omitted, edit (+ delete) when it's given — one form either way,
 * re-seeded from the tapped row without unmounting the sheet. */
function DebtSheet({
  visible,
  debt,
  defaultDirection,
  onClose,
  onSaved,
  onDeleted,
}: {
  visible: boolean;
  debt?: Debt;
  defaultDirection: DebtDirection;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const theme = useTheme();
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? defaultDirection);
  const [name, setName] = useState(debt?.counterpartyName ?? "");
  const [amount, setAmount] = useState(debt ? String(debt.amountMinor / 100) : "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [dueDate, setDueDate] = useState<Date | null>(debt?.dueDate ? new Date(debt.dueDate) : null);
  const [pickingDate, setPickingDate] = useState(false);

  useEffect(() => {
    setDirection(debt?.direction ?? defaultDirection);
    setName(debt?.counterpartyName ?? "");
    setAmount(debt ? String(debt.amountMinor / 100) : "");
    setNote(debt?.note ?? "");
    setDueDate(debt?.dueDate ? new Date(debt.dueDate) : null);
  }, [debt, defaultDirection]);

  const create = useMutation({
    mutationFn: () =>
      apiClient.debts.create({
        direction,
        counterpartyName: name.trim(),
        amountMinor: Math.round(Number(amount) * 100),
        currency: "RUB",
        note: note.trim() || undefined,
        dueDate: dueDate?.toISOString(),
      }),
    onSuccess: onSaved,
  });
  const update = useMutation({
    mutationFn: () =>
      apiClient.debts.update(debt!.id, {
        direction,
        counterpartyName: name.trim(),
        amountMinor: Math.round(Number(amount) * 100),
        note: note.trim() || undefined,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
      }),
    onSuccess: onSaved,
  });

  const canSave = name.trim().length > 0 && Number(amount) > 0 && !create.isPending && !update.isPending;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={debt ? "Изменить долг" : "Новый долг"}>
      <Segmented<DebtDirection>
        value={direction}
        onChange={setDirection}
        options={[
          { value: "owed_to_me", label: "Мне должны" },
          { value: "i_owe", label: "Я должен" },
        ]}
      />
      <View style={styles.gap} />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Имя"
        placeholderTextColor={theme.textTertiary}
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Сумма, ₽"
        placeholderTextColor={theme.textTertiary}
        keyboardType="decimal-pad"
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Комментарий (необязательно)"
        placeholderTextColor={theme.textTertiary}
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />

      <Pressable
        style={[styles.dateRow, { backgroundColor: theme.surfaceSunken }]}
        onPress={() => setPickingDate(true)}
      >
        <Icon name="calendar" color={theme.textSecondary} size={16} />
        <Text style={[styles.dateText, { color: dueDate ? theme.textPrimary : theme.textTertiary }]}>
          {dueDate
            ? dueDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
            : "Срок (необязательно)"}
        </Text>
        {dueDate ? (
          <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
            <Icon name="close" color={theme.textTertiary} size={14} />
          </Pressable>
        ) : (
          <Icon name="chevron" color={theme.textTertiary} size={14} />
        )}
      </Pressable>

      <View style={styles.gap} />
      <SheetSubmit
        label={debt ? "Сохранить" : "Добавить"}
        enabled={canSave}
        onPress={() => (debt ? update.mutate() : create.mutate())}
      />

      {debt && onDeleted ? (
        <Pressable onPress={onDeleted} style={styles.deleteButton}>
          <Icon name="trash" color={theme.negative} size={16} />
          <Text style={[styles.deleteText, { color: theme.negative }]}>Удалить</Text>
        </Pressable>
      ) : null}

      <DatePickerSheet
        visible={pickingDate}
        onClose={() => setPickingDate(false)}
        initialDate={dueDate ?? new Date()}
        maxDate={new Date(Date.now() + FIVE_YEARS_MS)}
        onSelect={(day) => {
          setDueDate(day);
          setPickingDate(false);
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: { padding: spacing.lg, gap: 4 },
  summaryLabel: { ...typography.caption, color: "rgba(255,255,255,0.85)" },
  summaryValue: { ...typography.display, fontSize: 30, color: "#FFFFFF" },

  empty: { ...typography.body, textAlign: "center", marginTop: spacing.xl },

  sectionTitle: {
    ...typography.overline,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  listCard: { paddingVertical: spacing.xs, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 34 + spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  rowMain: { flex: 1, gap: 2 },
  rowName: typography.body,
  rowMeta: typography.caption,
  rowAmount: { ...typography.body, fontWeight: "600" },
  settleButton: { paddingHorizontal: 2 },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  addIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  addLabel: { ...typography.body, fontWeight: "600" },

  gap: { height: spacing.md },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  dateText: { ...typography.body, flex: 1 },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  deleteText: { ...typography.callout, fontWeight: "600" },
});
