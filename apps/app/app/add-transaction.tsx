import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { GradientBox } from "../src/ui/Gradient";
import { Icon } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { categoryColor, categoryIcon } from "../src/ui/categoryVisual";
import { FadeIn, PressableScale, Screen, Segmented } from "../src/ui/primitives";
import { generateClientId } from "../src/utils/uuid";

// Fast manual entry: amount → category → save. Account defaults to the first one and
// stays out of the way — per the product spec, nothing here is required to save.
export default function AddTransaction() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.accounts.list(),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.list(),
  });

  const account = accounts?.[0];
  const visibleCategories = (categories ?? []).filter((c) => c.type === type);
  const canSave = Boolean(account) && Number(amount) > 0 && !saving;

  async function save() {
    if (!account) return;
    setSaving(true);
    try {
      await apiClient.transactions.create({
        type,
        accountId: account.id,
        categoryId: categoryId ?? undefined,
        amountMinor: Math.round(Number(amount) * 100),
        currency: account.currency,
        merchant: merchant.trim() || undefined,
        clientId: generateClientId(),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: "Новая операция" }} />

      <FadeIn index={0}>
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
      </FadeIn>

      {/* The amount is the screen — everything else is optional decoration around it. */}
      <FadeIn index={1}>
        <View style={styles.amountRow}>
          <TextInput
            autoFocus
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.textTertiary}
            value={amount}
            onChangeText={setAmount}
            style={[styles.amountInput, { color: theme.textPrimary }]}
          />
          <Text style={[styles.currency, { color: theme.textTertiary }]}>₽</Text>
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder="Где потрачено (необязательно)"
          placeholderTextColor={theme.textTertiary}
          style={[
            styles.merchantInput,
            { color: theme.textPrimary, backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        />
      </FadeIn>

      <Text style={[styles.label, { color: theme.textSecondary }]}>Категория</Text>

      <ScrollView contentContainerStyle={styles.categoryGrid} showsVerticalScrollIndicator={false}>
        {visibleCategories.map((c) => {
          const active = categoryId === c.id;
          const color = categoryColor(c.systemCode ?? c.id);
          return (
            <PressableScale
              key={c.id}
              onPress={() => setCategoryId(active ? null : c.id)}
              style={StyleSheet.flatten([
                styles.categoryChip,
                {
                  backgroundColor: active ? `${color}26` : theme.surface,
                  borderColor: active ? color : theme.border,
                },
              ])}
            >
              <Icon name={categoryIcon(c)} color={color} size={18} />
              <Text style={[styles.categoryText, { color: theme.textPrimary }]}>{c.name}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <Pressable disabled={!canSave} onPress={save}>
        {canSave ? (
          <GradientBox colors={theme.accentGradient} diagonal radius={radii.md}>
            <View style={styles.saveButton}>
              <Text style={[styles.saveText, { color: theme.onAccent }]}>
                {saving ? "Сохраняю…" : "Сохранить"}
              </Text>
            </View>
          </GradientBox>
        ) : (
          <View style={[styles.saveButton, { backgroundColor: theme.surfaceSunken }]}>
            <Text style={[styles.saveText, { color: theme.textTertiary }]}>Сохранить</Text>
          </View>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, gap: spacing.md },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  amountInput: { ...typography.hero, fontSize: 52, lineHeight: 60, flex: 1 },
  currency: { ...typography.display, fontWeight: "500" },
  merchantInput: {
    ...typography.body,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  label: { ...typography.overline, textTransform: "uppercase", marginTop: spacing.xs },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  categoryText: typography.callout,
  saveButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  saveText: { ...typography.headline, fontWeight: "700" },
});
