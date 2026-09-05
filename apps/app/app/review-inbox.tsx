import type { Category, ReviewInboxItem } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { formatMinor } from "../src/utils/format";

const REASON_LABEL: Partial<Record<ReviewInboxItem["reason"], string>> = {
  low_category_confidence: "Не удалось определить категорию",
  probable_duplicate: "Возможно, дубль",
  possible_transfer: "Возможно, перевод между своими счетами",
  import_error: "Ошибка импорта",
  missing_account: "Не найден счёт",
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
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: true, title: "Нужно проверить" }} />

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={theme.accent} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {(items ?? []).length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Всё разобрано. Новые сомнительные операции появятся здесь.
            </Text>
          ) : null}

          {(items ?? []).map((item) => (
            <View
              key={item.id}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.cardHeader}>
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
                    theme={theme}
                    onPress={() => resolve.mutate({ id: item.id, action: "confirm_duplicate" })}
                  />
                  <Action
                    label="Не дубль"
                    theme={theme}
                    primary
                    onPress={() => resolve.mutate({ id: item.id, action: "not_duplicate" })}
                  />
                </View>
              ) : (
                <View style={styles.actions}>
                  <Action
                    label={openFor === item.id ? "Скрыть категории" : "Выбрать категорию"}
                    theme={theme}
                    primary
                    onPress={() => setOpenFor(openFor === item.id ? null : item.id)}
                  />
                  <Action
                    label="Пропустить"
                    theme={theme}
                    onPress={() => resolve.mutate({ id: item.id, action: "dismiss" })}
                  />
                </View>
              )}

              {openFor === item.id ? (
                <View style={styles.categoryGrid}>
                  {(categories ?? [])
                    .filter((c: Category) => c.type === "expense")
                    .map((category: Category) => (
                      <Pressable
                        key={category.id}
                        onPress={() =>
                          resolve.mutate({
                            id: item.id,
                            action: "categorize",
                            categoryId: category.id,
                          })
                        }
                        style={[styles.chip, { borderColor: theme.border }]}
                      >
                        <Text style={{ color: theme.textPrimary, fontSize: 13 }}>
                          {category.name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type Theme = ReturnType<typeof useTheme>;

function Action({
  label,
  onPress,
  theme,
  primary,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.action,
        primary
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { borderColor: theme.border },
      ]}
    >
      <Text
        style={{ color: primary ? "#fff" : theme.textPrimary, fontSize: 13, fontWeight: "600" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { marginTop: 32 },
  content: { padding: 20, gap: 12 },
  empty: { fontSize: 14, textAlign: "center", marginTop: 32, lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  merchant: { fontSize: 15, fontWeight: "600", flex: 1 },
  amount: { fontSize: 15, fontWeight: "700" },
  reason: { fontSize: 12 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  action: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
});
