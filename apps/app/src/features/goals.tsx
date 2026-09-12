import { spacing } from "@money-dock/design-tokens";
import type { SavingsGoal } from "@money-dock/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../api/client";
import { useTheme } from "../theme/useTheme";
import { Icon, type IconName } from "../ui/Icon";
import { Text } from "../ui/Text";
import { BottomSheet, Segmented } from "../ui/primitives";
import { formatMinor } from "../utils/format";

import { SheetSubmit, sheetStyles } from "./recurring";

/** What people actually save for — the picker offers these, the server stores the name. */
export const GOAL_ICONS: IconName[] = [
  "palm",
  "plane",
  "house",
  "car",
  "phone",
  "gift",
  "book",
  "health",
  "shirt",
  "briefcase",
  "wallet",
  "target",
];

export function goalIcon(goal: Pick<SavingsGoal, "icon">): IconName {
  return GOAL_ICONS.includes(goal.icon as IconName) ? (goal.icon as IconName) : "target";
}

export function CreateGoalSheet({
  visible,
  onClose,
  currency,
}: {
  visible: boolean;
  onClose: () => void;
  currency: string;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [icon, setIcon] = useState<IconName>("palm");

  const create = useMutation({
    mutationFn: () =>
      apiClient.goals.create({
        name: name.trim(),
        icon,
        targetMinor: Math.round(Number(target) * 100),
        currency,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goals"] });
      setName("");
      setTarget("");
      setIcon("palm");
      onClose();
    },
  });

  const canCreate = name.trim().length > 0 && Number(target) > 0 && !create.isPending;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Новая цель">
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Например, Отпуск"
        placeholderTextColor={theme.textTertiary}
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />
      <TextInput
        value={target}
        onChangeText={setTarget}
        placeholder="Сколько нужно накопить, ₽"
        placeholderTextColor={theme.textTertiary}
        keyboardType="decimal-pad"
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />

      <Text style={[sheetStyles.label, { color: theme.textSecondary }]}>Иконка</Text>
      <View style={sheetStyles.categoryRow}>
        {GOAL_ICONS.map((name) => {
          const active = icon === name;
          return (
            <Pressable key={name} onPress={() => setIcon(name)}>
              <View
                style={[
                  sheetStyles.categoryCircle,
                  {
                    backgroundColor: active ? theme.accent : theme.accentSoft,
                    borderColor: active ? theme.accent : "transparent",
                  },
                ]}
              >
                <Icon name={name} color={active ? theme.onAccent : theme.accent} size={18} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <SheetSubmit
        label={create.isPending ? "Создаю…" : "Создать цель"}
        enabled={canCreate}
        onPress={() => create.mutate()}
      />
    </BottomSheet>
  );
}

/** Put money aside for a goal, or take some back out. A tracker, not a transfer — see
 * the `savings_goals` schema comment. */
export function ContributeGoalSheet({
  goal,
  onClose,
}: {
  goal: SavingsGoal | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"add" | "take">("add");

  const contribute = useMutation({
    mutationFn: () => {
      if (!goal) throw new Error("No goal");
      const minor = Math.round(Number(amount) * 100);
      return apiClient.goals.contribute(goal.id, direction === "add" ? minor : -minor);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goals"] });
      setAmount("");
      setDirection("add");
      onClose();
    },
  });

  const minor = Math.round(Number(amount) * 100);
  const canSubmit =
    Boolean(goal) &&
    minor > 0 &&
    (direction === "add" || minor <= (goal?.savedMinor ?? 0)) &&
    !contribute.isPending;
  const remaining = goal ? Math.max(0, goal.targetMinor - goal.savedMinor) : 0;

  return (
    <BottomSheet visible={goal !== null} onClose={onClose} title={goal?.name ?? ""}>
      {goal ? (
        <Text style={[styles.summary, { color: theme.textSecondary }]}>
          Отложено {formatMinor(goal.savedMinor)} ₽ из {formatMinor(goal.targetMinor)} ₽
          {remaining > 0 ? ` · осталось ${formatMinor(remaining)} ₽` : " · цель достигнута"}
        </Text>
      ) : null}

      <Segmented
        value={direction}
        onChange={setDirection}
        options={[
          { value: "add", label: "Отложить" },
          { value: "take", label: "Снять" },
        ]}
      />
      <View style={styles.gap} />
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Сумма, ₽"
        placeholderTextColor={theme.textTertiary}
        keyboardType="decimal-pad"
        style={[sheetStyles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceSunken }]}
      />

      <SheetSubmit
        label={
          contribute.isPending ? "Сохраняю…" : direction === "add" ? "Отложить" : "Снять с цели"
        }
        enabled={canSubmit}
        onPress={() => contribute.mutate()}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: spacing.md, textAlign: "center" },
  gap: { height: spacing.md },
});
