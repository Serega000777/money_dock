import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category, ReviewInboxItem } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { Icon } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { categoryColor, categoryIcon } from "../src/ui/categoryVisual";
import { Card, FadeIn, PressableScale, Screen } from "../src/ui/primitives";
import { formatMinor } from "../src/utils/format";

const REASON_LABEL: Partial<Record<ReviewInboxItem["reason"], string>> = {
  low_category_confidence: "Не удалось определить категорию",
  probable_duplicate: "Возможно, дубль",
  possible_transfer: "Возможно, перевод между своими счетами",
  import_error: "Ошибка импорта",
  missing_account: "Не найден счёт",
  unconfirmed_capture: "Записано голосом без подтверждения",
};

export default function ReviewInbox() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [openFor, setOpenFor] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["review-inbox"],
    queryFn: () => apiClient.reviewInbox.list(),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.list(),
  });

  const resolve = useMutation({
    mutationFn: ({ id, action, categoryId }: { id: string; action: string; categoryId?: string }) =>
      apiClient.reviewInbox.resolve(id, action, categoryId),
    onSuccess: async () => {
      setOpenFor(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["review-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
    },
  });

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Нужно проверить" }} />

      {isLoading ? <ActivityIndicator style={styles.loader} color={theme.accent} /> : null}

      {!isLoading && (items ?? []).length === 0 ? (
        <Text style={[styles.empty, { color: theme.onGradientSecondary }]}>
          Всё разобрано. Новые сомнительные операции появятся здесь.
        </Text>
      ) : null}

      {(items ?? []).map((item, index) => (
        <FadeIn key={item.id} index={Math.min(index, 6)}>
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.icon, { backgroundColor: theme.warningSoft }]}>
                <Icon name="inbox" color={theme.warning} size={18} />
              </View>
              <Text style={[styles.merchant, { color: theme.textPrimary }]} numberOfLines={1}>
                {item.transaction.merchant ?? "Без описания"}
              </Text>
              <Text style={[styles.amount, { color: theme.textPrimary }]}>
                {formatMinor(item.transaction.amountMinor)} ₽
              </Text>
            </View>

            <Text style={[styles.reason, { color: theme.textSecondary }]}>
              {REASON_LABEL[item.reason] ?? item.reason}
              {item.confidence !== null ? ` · уверенность ${item.confidence}%` : ""}
            </Text>

            {item.reason === "probable_duplicate" ? (
              <View style={styles.actions}>
                <Action
                  label="Это дубль, удалить"
                  onPress={() => resolve.mutate({ id: item.id, action: "confirm_duplicate" })}
                />
                <Action
                  label="Не дубль"
                  primary
                  onPress={() => resolve.mutate({ id: item.id, action: "not_duplicate" })}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <Action
                  label={openFor === item.id ? "Скрыть категории" : "Выбрать категорию"}
                  primary
                  onPress={() => setOpenFor(openFor === item.id ? null : item.id)}
                />
                <Action
                  label="Пропустить"
                  onPress={() => resolve.mutate({ id: item.id, action: "dismiss" })}
                />
              </View>
            )}

            {openFor === item.id ? (
              <View style={styles.categoryGrid}>
                {(categories ?? [])
                  .filter((c: Category) => c.type === "expense")
                  .map((category: Category) => {
                    const color = categoryColor(category.systemCode ?? category.id);
                    return (
                      <PressableScale
                        key={category.id}
                        onPress={() =>
                          resolve.mutate({
                            id: item.id,
                            action: "categorize",
                            categoryId: category.id,
                          })
                        }
                        style={StyleSheet.flatten([
                          styles.chip,
                          { borderColor: theme.border, backgroundColor: theme.surfaceSunken },
                        ])}
                      >
                        <Icon name={categoryIcon(category)} color={color} size={16} />
                        <Text style={[styles.chipText, { color: theme.textPrimary }]}>
                          {category.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
              </View>
            ) : null}
          </Card>
        </FadeIn>
      ))}
    </Screen>
  );
}

function Action({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={StyleSheet.flatten([
        styles.action,
        primary
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { borderColor: theme.border },
      ])}
    >
      <Text style={[styles.actionText, { color: primary ? theme.onAccent : theme.textPrimary }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.xxl, lineHeight: 21 },
  card: { gap: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  merchant: { ...typography.body, fontWeight: "600", flex: 1 },
  amount: { ...typography.body, fontWeight: "700" },
  reason: typography.caption,
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  action: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: { ...typography.caption, fontWeight: "600" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
  },
  chipText: typography.caption,
});
