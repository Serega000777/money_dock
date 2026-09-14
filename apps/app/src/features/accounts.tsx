import { spacing, typography } from "@money-dock/design-tokens";
import type { AccountType } from "@money-dock/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../api/client";
import { useTheme } from "../theme/useTheme";
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

  const create = useMutation({
    mutationFn: () =>
      apiClient.accounts.create({
        type,
        name: name.trim(),
        currency: "RUB",
        initialBalanceMinor: Math.round(Number(balance.replace(",", ".") || 0) * 100),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      setName("");
      setBalance("");
      setType("card");
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

const styles = StyleSheet.create({
  gap: { height: spacing.md },
  hint: { ...typography.caption, marginBottom: spacing.md, lineHeight: 17 },
});
