import { categoryPalette, radii, spacing, typography } from "@money-dock/design-tokens";
import type { Category } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { GradientBox } from "../src/ui/Gradient";
import { Icon, PICKABLE_ICONS, type IconName } from "../src/ui/Icon";
import { NumericKeypad } from "../src/ui/NumericKeypad";
import { Text } from "../src/ui/Text";
import { categoryColor, categoryIcon } from "../src/ui/categoryVisual";
import { BottomSheet, FadeIn, PressableScale, Screen, Segmented } from "../src/ui/primitives";
import { generateClientId } from "../src/utils/uuid";

/** Appends/backspaces/adds-a-decimal-point to the amount string the keypad edits. */
function applyKey(amount: string, key: string): string {
  if (key === "back") return amount.slice(0, -1);
  if (key === ".") return amount.includes(".") ? amount : `${amount || "0"}.`;
  if (amount === "0") return key;
  return amount + key;
}

// Fast manual entry: amount → category → save. Account defaults to the first one and
// stays out of the way — per the product spec, nothing here is required to save.
export default function AddTransaction() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
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
    <Screen contentStyle={styles.screen}>
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

      {/* The amount is the screen — everything else is optional decoration around it.
          Driven entirely by the keypad below, not the OS keyboard, so it looks and
          behaves the same in the Telegram web view, a browser, and native. */}
      <FadeIn index={1}>
        <View style={styles.amountRow}>
          <Text style={[styles.amountText, { color: theme.textPrimary }]} numberOfLines={1}>
            {amount || "0"}
          </Text>
          <Text style={[styles.currency, { color: theme.textTertiary }]}>₽</Text>
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <NumericKeypad onKey={(key) => setAmount((prev) => applyKey(prev, key))} />
      </FadeIn>

      <FadeIn index={3}>
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

      <FadeIn index={4}>
        <View style={styles.categoryGrid}>
          {visibleCategories.map((c) => {
            const active = categoryId === c.id;
            const color = categoryColor(c);
            return (
              // See NumericKeypad: PressableScale styles an inner Animated.View, so the
              // percentage width that lays out the grid has to live on a wrapper instead.
              <View key={c.id} style={styles.categoryItem}>
                <PressableScale
                  onPress={() => setCategoryId(active ? null : c.id)}
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

          <View style={styles.categoryItem}>
            <PressableScale
              onPress={() => setCreatingCategory(true)}
              style={styles.categoryItemInner}
              accessibilityLabel="Добавить категорию"
            >
              <View
                style={[
                  styles.categoryCircle,
                  styles.categoryAddCircle,
                  { borderColor: theme.border },
                ]}
              >
                <Icon name="plus" color={theme.textSecondary} size={20} />
              </View>
              <Text style={[styles.categoryLabel, { color: theme.textSecondary }]}>Добавить</Text>
            </PressableScale>
          </View>
        </View>
      </FadeIn>

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

      <CreateCategorySheet
        visible={creatingCategory}
        type={type}
        onClose={() => setCreatingCategory(false)}
        onCreated={(category) => {
          setCategoryId(category.id);
          setCreatingCategory(false);
        }}
      />
    </Screen>
  );
}

/** Name + icon + colour, saved as a real category (not just picked for this one
 * transaction) — it shows up in every picker and breakdown from then on. */
function CreateCategorySheet({
  visible,
  type,
  onClose,
  onCreated,
}: {
  visible: boolean;
  type: "expense" | "income";
  onClose: () => void;
  onCreated: (category: Category) => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName>("cart");
  const [color, setColor] = useState<string>(categoryPalette[0]);

  const create = useMutation({
    mutationFn: () => apiClient.categories.create({ type, name: name.trim(), icon, color }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setName("");
      setIcon("cart");
      setColor(categoryPalette[0]);
      onCreated(category);
    },
  });

  const canCreate = name.trim().length > 0 && !create.isPending;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Новая категория">
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Название категории"
        placeholderTextColor={theme.textTertiary}
        style={[
          styles.nameInput,
          { color: theme.textPrimary, backgroundColor: theme.surfaceSunken },
        ]}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Иконка</Text>
      <View style={styles.iconGrid}>
        {PICKABLE_ICONS.map((name_) => {
          const active = icon === name_;
          return (
            <Pressable
              key={name_}
              onPress={() => setIcon(name_)}
              style={[
                styles.iconOption,
                {
                  backgroundColor: active ? color : theme.surfaceSunken,
                  borderColor: active ? color : "transparent",
                },
              ]}
            >
              <Icon name={name_} color={active ? "#FFFFFF" : theme.textSecondary} size={18} />
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: theme.textSecondary }]}>Цвет</Text>
      <View style={styles.swatches}>
        {categoryPalette.map((swatch) => (
          <Pressable
            key={swatch}
            onPress={() => setColor(swatch)}
            accessibilityLabel={`Цвет ${swatch}`}
            style={[
              styles.swatch,
              { backgroundColor: swatch },
              swatch === color && { borderColor: theme.textPrimary, borderWidth: 2 },
            ]}
          />
        ))}
      </View>

      <Pressable disabled={!canCreate} onPress={() => create.mutate()} style={styles.createButton}>
        {canCreate ? (
          <GradientBox colors={theme.accentGradient} diagonal radius={radii.md}>
            <View style={styles.saveButton}>
              <Text style={[styles.saveText, { color: theme.onAccent }]}>
                {create.isPending ? "Добавляю…" : "Добавить"}
              </Text>
            </View>
          </GradientBox>
        ) : (
          <View style={[styles.saveButton, { backgroundColor: theme.surfaceSunken }]}>
            <Text style={[styles.saveText, { color: theme.textTertiary }]}>Добавить</Text>
          </View>
        )}
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  amountText: { ...typography.hero, fontSize: 52, lineHeight: 60, flex: 1 },
  currency: { ...typography.display, fontWeight: "500" },
  merchantInput: {
    ...typography.body,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  label: { ...typography.overline, textTransform: "uppercase", marginTop: spacing.xs },

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
  categoryAddCircle: { backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth },
  categoryLabel: { ...typography.caption, textAlign: "center" },

  saveButton: { borderRadius: radii.md, paddingVertical: spacing.lg, alignItems: "center" },
  saveText: { ...typography.headline, fontWeight: "700" },

  nameInput: {
    ...typography.body,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  swatch: { width: 28, height: 28, borderRadius: radii.pill, borderColor: "transparent" },
  createButton: { marginTop: spacing.xs },
});
