import type { ImportPreview } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { formatMinor } from "../src/utils/format";

const STATUS_LABEL: Record<string, string> = {
  new: "Новая",
  duplicate: "Дубль",
  review: "На проверку",
  error: "Ошибка",
};

export default function Import() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.accounts.list(),
  });
  const account = accounts?.[0];

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!account) throw new Error("Сначала нужно добавить счёт");
      return apiClient.imports.preview(account.id, file, file.name);
    },
    onSuccess: (result) => {
      setError(null);
      setPreview(result);
    },
    onError: (e: Error) => setError(e.message),
  });

  const commit = useMutation({
    mutationFn: (jobId: string) => apiClient.imports.commit(jobId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["review-inbox"] }),
      ]);
      router.back();
    },
  });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: true, title: "Импорт выписки" }} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          CSV-выписка из банка. Колонки даты, суммы и назначения определяются автоматически. Ничего
          не сохранится, пока вы не подтвердите.
        </Text>

        {Platform.OS === "web" ? (
          // RN has no file input; on web (which is where the Mini App lives) we drive the
          // native one directly instead of pulling in a picker dependency.
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        ) : null}

        <Pressable
          onPress={() => inputRef.current?.click()}
          disabled={upload.isPending || !account}
          style={[styles.button, { backgroundColor: account ? theme.accent : theme.border }]}
        >
          <Text style={styles.buttonText}>
            {upload.isPending ? "Разбираю файл…" : "Выбрать CSV-файл"}
          </Text>
        </Pressable>

        {!account ? (
          <Text style={[styles.error, { color: theme.warning }]}>Сначала добавьте счёт</Text>
        ) : null}
        {error ? <Text style={[styles.error, { color: theme.negative }]}>{error}</Text> : null}

        {preview ? (
          <>
            {preview.alreadyImportedJobId ? (
              <Text style={[styles.error, { color: theme.warning }]}>
                Этот файл уже импортировали раньше — повторные строки будут отмечены дублями.
              </Text>
            ) : null}

            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Stat label="Строк в файле" value={preview.stats.rowsFound} theme={theme} />
              <Stat label="Новых" value={preview.stats.new} theme={theme} />
              <Stat label="Дублей" value={preview.stats.duplicates} theme={theme} />
              <Stat label="На проверку" value={preview.stats.reviewNeeded} theme={theme} />
              <Stat label="Ошибок" value={preview.stats.errors} theme={theme} />
            </View>

            {preview.rows.slice(0, 30).map((row) => (
              <View key={row.rowNumber} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text
                    style={[styles.rowMerchant, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {row.merchant ?? row.error ?? "—"}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                    {STATUS_LABEL[row.status] ?? row.status}
                    {row.occurredAt
                      ? ` · ${new Date(row.occurredAt).toLocaleDateString("ru-RU")}`
                      : ""}
                  </Text>
                </View>
                {row.amountMinor ? (
                  <Text
                    style={[
                      styles.rowAmount,
                      { color: row.type === "income" ? theme.positive : theme.textPrimary },
                    ]}
                  >
                    {row.type === "income" ? "+" : "−"}
                    {formatMinor(row.amountMinor)} ₽
                  </Text>
                ) : null}
              </View>
            ))}

            <Pressable
              onPress={() => commit.mutate(preview.jobId)}
              disabled={commit.isPending}
              style={[styles.button, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.buttonText}>
                {commit.isPending
                  ? "Сохраняю…"
                  : `Импортировать ${preview.stats.new + preview.stats.reviewNeeded} операций`}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type Theme = ReturnType<typeof useTheme>;

function Stat({ label, value, theme }: { label: string; value: number; theme: Theme }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 12 },
  hint: { fontSize: 13, lineHeight: 19 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  stat: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { fontSize: 13 },
  statValue: { fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowMain: { flex: 1, gap: 2 },
  rowMerchant: { fontSize: 14 },
  rowMeta: { fontSize: 11 },
  rowAmount: { fontSize: 14, fontWeight: "600" },
});
