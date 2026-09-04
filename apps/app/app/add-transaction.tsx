import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { generateClientId } from "../src/utils/uuid";

// Fast manual entry: amount → category → save. Account defaults to the first one and
// stays out of the way — per the product spec, nothing here is required to save.
export default function AddTransaction() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
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
        clientId: generateClientId(),
      });
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.typeRow}>
        {(["expense", "income"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setType(t);
              setCategoryId(null);
            }}
            style={[
              styles.typeButton,
              { borderColor: theme.border },
              type === t && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
          >
            <Text style={{ color: type === t ? "#fff" : theme.textPrimary }}>
              {t === "expense" ? "Расход" : "Доход"}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        autoFocus
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={theme.textSecondary}
        value={amount}
        onChangeText={setAmount}
        style={[styles.amountInput, { color: theme.textPrimary }]}
      />

      <ScrollView contentContainerStyle={styles.categoryGrid}>
        {visibleCategories.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCategoryId(c.id)}
            style={[
              styles.categoryChip,
              { borderColor: theme.border },
              categoryId === c.id && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
          >
            <Text style={{ color: categoryId === c.id ? "#fff" : theme.textPrimary }}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        disabled={!canSave}
        onPress={save}
        style={[styles.saveButton, { backgroundColor: canSave ? theme.accent : theme.border }]}
      >
        <Text style={styles.saveButtonText}>{saving ? "Сохраняю…" : "Сохранить"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  amountInput: { fontSize: 48, fontWeight: "700" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  saveButton: { borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: "auto" },
  saveButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
