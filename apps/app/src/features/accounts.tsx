import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { AccountType, Bank } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../api/client";
import { useTheme } from "../theme/useTheme";
import { BANK_ORDER, BankCardArt } from "../ui/BankCardArt";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { BottomSheet, Segmented } from "../ui/primitives";

import { SheetSubmit, sheetStyles } from "./recurring";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "card", label: "Карта" },
  { value: "cash", label: "Наличные" },
  { value: "bank", label: "Счёт" },
];

const NAME_HINT: Record<AccountType, string> = {
  card: "Например, Основная карта",
  cash: "Например, Наличные",
  bank: "Например, Накопительный",
};

/** The first thing a new user has to do — nothing can be recorded without an account.
 * Type, name, and what's on it right now; the balance from here on is derived from
 * transactions, so the starting figure is the only one ever typed by hand. */
export function CreateAccountSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [type, setType] = useState<AccountType>("card");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [bank, setBank] = useState<Bank | null>(null);
  const [last4, setLast4] = useState("");

  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => apiClient.entitlements.get(),
    enabled: visible,
  });
  const canPickBank = entitlements ? entitlements.plan !== "free" : false;

  const create = useMutation({
    mutationFn: () =>
      apiClient.accounts.create({
        type,
        name: name.trim(),
        currency: "RUB",
        initialBalanceMinor: Math.round(Number(balance.replace(",", ".") || 0) * 100),
        bank: type === "card" && canPickBank ? bank : null,
        cardLast4: type === "card" && canPickBank && last4.length === 4 ? last4 : null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      setName("");
      setBalance("");
      setType("card");
      setBank(null);
      setLast4("");
      onCreated?.();
      onClose();
    },
  });

  const canCreate = name.trim().length > 0 && !create.isPending;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Новый счёт">
      <Text style={[sheetStyles.label, { color: theme.textSecondary }]}>Тип</Text>
      <Segmented value={type} onChange={setType} options={TYPE_OPTIONS} />
      <View style={styles.gap} />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={NAME_HINT[type]}
        placeholderTextColor={theme.textTertiary}
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />
      <TextInput
        value={balance}
        onChangeText={setBalance}
        placeholder="Сколько на нём сейчас, ₽ (можно 0)"
        placeholderTextColor={theme.textTertiary}
        keyboardType="decimal-pad"
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />

      {type === "card" ? (
        <BankPicker
          value={bank}
          onChange={setBank}
          locked={!canPickBank}
          last4={last4}
          onLast4Change={setLast4}
        />
      ) : null}

      <Text style={[styles.hint, { color: theme.textTertiary }]}>
        Дальше баланс считается сам — из операций, которые вы добавляете.
      </Text>
      <SheetSubmit
        label={create.isPending ? "Добавляю…" : "Добавить счёт"}
        enabled={canCreate}
        onPress={() => create.mutate()}
      />
    </BottomSheet>
  );
}

const CARD_PREVIEW_W = 118;
const CARD_PREVIEW_H = 74;

/** Picking which bank's card art an account shows — cosmetic, so nothing here blocks
 * creating the account (see AccountsService.create). Free plan sees the same row, dimmed
 * under a lock, so the feature is discoverable rather than simply absent. */
function BankPicker({
  value,
  onChange,
  locked,
  last4,
  onLast4Change,
}: {
  value: Bank | null;
  onChange: (bank: Bank | null) => void;
  locked: boolean;
  last4: string;
  onLast4Change: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.bankSection}>
      <View style={styles.bankHeadRow}>
        <Text style={[sheetStyles.label, { color: theme.textSecondary, marginBottom: 0 }]}>
          Дизайн карты
        </Text>
        {locked ? (
          <View style={[styles.proBadge, { backgroundColor: theme.accentSoft }]}>
            <Icon name="lock" color={theme.accent} size={11} strokeWidth={2.2} />
            <Text style={[styles.proBadgeText, { color: theme.accent }]}>Pro</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bankRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!locked}
          contentContainerStyle={styles.bankRow}
        >
          {BANK_ORDER.map((bank) => {
            const active = value === bank;
            return (
              <Pressable
                key={bank}
                disabled={locked}
                onPress={() => onChange(active ? null : bank)}
                accessibilityLabel={`Дизайн карты: ${bank}`}
                style={[
                  styles.bankPreview,
                  active && { borderColor: theme.accent, borderWidth: 2 },
                ]}
              >
                <BankCardArt bank={bank} compact fillStyle={styles.bankPreviewArt} />
              </Pressable>
            );
          })}
        </ScrollView>
        {locked ? (
          <View style={[styles.bankLockOverlay, { backgroundColor: `${theme.background}B3` }]}>
            <Icon name="lock" color={theme.textSecondary} size={16} strokeWidth={2} />
            <Text style={[styles.bankLockText, { color: theme.textSecondary }]}>
              Реалистичный дизайн карты — в подписке Pro
            </Text>
          </View>
        ) : null}
      </View>

      {!locked && value ? (
        <TextInput
          value={last4}
          onChangeText={(v) => onLast4Change(v.replace(/\D/g, "").slice(0, 4))}
          placeholder="Последние 4 цифры карты (необязательно)"
          placeholderTextColor={theme.textTertiary}
          keyboardType="number-pad"
          maxLength={4}
          style={[
            sheetStyles.input,
            styles.last4Input,
            { color: theme.textPrimary, backgroundColor: theme.surfaceSunken },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { height: spacing.md },
  hint: { ...typography.caption, marginBottom: spacing.md, lineHeight: 17 },

  bankSection: { marginBottom: spacing.md },
  bankHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: { ...typography.caption, fontSize: 10, fontWeight: "700" },

  bankRowWrap: { position: "relative" },
  bankRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: 2 },
  bankPreview: {
    width: CARD_PREVIEW_W,
    height: CARD_PREVIEW_H,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 0,
  },
  bankPreviewArt: { top: 0, right: 0, bottom: 0, left: 0 },
  bankLockOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  bankLockText: { ...typography.caption, fontSize: 11, flexShrink: 1 },

  last4Input: { marginTop: spacing.sm, marginBottom: 0 },
});
