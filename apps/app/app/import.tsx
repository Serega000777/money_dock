import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { ImportPreview } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { GradientBox } from "../src/ui/Gradient";
import { Icon } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { Card, FadeIn, Pill, PressableScale, Screen } from "../src/ui/primitives";
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
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Импорт выписки" }} />

      <FadeIn index={0}>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          CSV-выписка из банка. Колонки даты, суммы и назначения определяются автоматически. Ничего
          не сохранится, пока вы не подтвердите.
        </Text>
      </FadeIn>

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

      <FadeIn index={1}>
        <PressableScale
          onPress={() => !upload.isPending && account && inputRef.current?.click()}
          style={StyleSheet.flatten([
            styles.dropzone,
            { borderColor: theme.borderStrong, backgroundColor: theme.surface },
          ])}
        >
          <View style={[styles.dropIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="upload" color={theme.accent} size={24} />
          </View>
          <Text style={[styles.dropTitle, { color: theme.textPrimary }]}>
            {upload.isPending ? "Разбираю файл…" : "Выбрать CSV-файл"}
          </Text>
          <Text style={[styles.dropHint, { color: theme.textTertiary }]}>
            Сбербанк, Тинькофф, Альфа — любой CSV
          </Text>
        </PressableScale>
      </FadeIn>

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

          <FadeIn index={2}>
            <Card style={styles.statsCard}>
              <Stat label="Строк в файле" value={preview.stats.rowsFound} />
              <Stat label="Новых" value={preview.stats.new} tone="positive" />
              <Stat label="Дублей" value={preview.stats.duplicates} />
              <Stat label="На проверку" value={preview.stats.reviewNeeded} tone="warning" />
              <Stat label="Ошибок" value={preview.stats.errors} tone="negative" />
            </Card>
          </FadeIn>

          <Card style={styles.rowsCard}>
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
          </Card>

          <PressableScale onPress={() => !commit.isPending && commit.mutate(preview.jobId)}>
            <GradientBox colors={theme.accentGradient} diagonal radius={radii.md}>
              <View style={styles.commitButton}>
                <Text style={[styles.commitText, { color: theme.onAccent }]}>
                  {commit.isPending
                    ? "Сохраняю…"
                    : `Импортировать ${preview.stats.new + preview.stats.reviewNeeded} операций`}
                </Text>
              </View>
            </GradientBox>
          </PressableScale>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "warning" | "negative";
}) {
  const theme = useTheme();
  const colors = {
    positive: [theme.positive, theme.positiveSoft],
    warning: [theme.warning, theme.warningSoft],
    negative: [theme.negative, theme.negativeSoft],
  } as const;

  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      {tone && value > 0 ? (
        <Pill label={String(value)} color={colors[tone][0]} background={colors[tone][1]} />
      ) : (
        <Text style={[styles.statValue, { color: theme.textPrimary }]}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, lineHeight: 19 },
  dropzone: {
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: spacing.xl,
  },
  dropIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dropTitle: { ...typography.headline },
  dropHint: typography.caption,
  error: typography.caption,

  statsCard: { gap: spacing.sm },
  stat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: typography.callout,
  statValue: { ...typography.callout, fontWeight: "700" },

  rowsCard: { gap: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  rowMain: { flex: 1, gap: 2 },
  rowMerchant: typography.body,
  rowMeta: typography.caption,
  rowAmount: { ...typography.body, fontWeight: "600" },

  commitButton: { paddingVertical: spacing.lg, alignItems: "center" },
  commitText: { ...typography.headline, fontWeight: "700" },
});
