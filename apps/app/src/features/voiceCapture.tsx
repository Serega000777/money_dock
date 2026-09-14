import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { CommandDraft } from "@money-dock/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { apiClient } from "../api/client";
import { useTheme } from "../theme/useTheme";
import { Text } from "../ui/Text";
import { PressableScale } from "../ui/primitives";
import { formatMinor } from "../utils/format";
import { generateClientId } from "../utils/uuid";

/**
 * Parse + save, shared by the home screen's press-and-hold mic and the dedicated /voice
 * screen (typed commands, examples, browsers with no speech API). Both need exactly the
 * same draft/save behaviour — only how the draft gets its first `value` differs — so this
 * is the one place that logic lives; each caller supplies its own per-call `onSuccess`.
 */
export function useVoiceCapture() {
  const queryClient = useQueryClient();

  const parse = useMutation({
    mutationFn: ({ value, source }: { value: string; source: "voice" | "text" }) =>
      apiClient.commands.parse(value, source),
  });

  const save = useMutation({
    mutationFn: (confirmed: CommandDraft) => {
      if (!confirmed.accountId) throw new Error("Сначала добавьте счёт");
      return apiClient.transactions.create({
        type: confirmed.type,
        accountId: confirmed.accountId,
        categoryId: confirmed.categoryId ?? undefined,
        amountMinor: confirmed.amountMinor,
        currency: confirmed.currency,
        occurredAt: confirmed.occurredAt,
        clientId: generateClientId(),
      });
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]),
  });

  return { parse, save };
}

/** The recognized draft — figures, category, account — with Save/Cancel. No outer card
 * or sheet chrome here, so it drops equally well into a `<Card>` (the /voice screen) or a
 * `<BottomSheet>` (the home screen's press-and-hold flow). */
export function DraftSummary({
  draft,
  saving,
  onDiscard,
  onSave,
}: {
  draft: CommandDraft;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>Я распознал</Text>

      <Row
        label={draft.type === "income" ? "Доход" : "Расход"}
        value={`${formatMinor(draft.amountMinor)} ₽`}
        strong
      />
      <Row label="Категория" value={draft.categoryName ?? "Не определена"} />
      <Row label="Счёт" value={draft.accountName ?? "Нет счёта"} />
      <Row label="Дата" value={new Date(draft.occurredAt).toLocaleDateString("ru-RU")} />

      <Text style={[styles.confidence, { color: theme.textTertiary }]}>
        Уверенность {Math.round(draft.confidence * 100)}% · распознано:{" "}
        {draft.explanation.join(", ")}
      </Text>

      <View style={styles.actions}>
        <PressableScale
          onPress={onDiscard}
          style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])}
        >
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>Отмена</Text>
        </PressableScale>
        <PressableScale
          onPress={onSave}
          style={StyleSheet.flatten([styles.primary, { backgroundColor: theme.accent }])}
        >
          <Text style={[styles.actionText, { color: theme.onAccent }]}>
            {saving ? "Сохраняю…" : "Сохранить"}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text
        style={[strong ? styles.rowValueStrong : styles.rowValue, { color: theme.textPrimary }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.overline, textTransform: "uppercase" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  rowLabel: typography.callout,
  rowValue: { ...typography.callout, fontWeight: "600" },
  rowValueStrong: { ...typography.title, fontWeight: "700" },
  confidence: { ...typography.caption, lineHeight: 17, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  secondary: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primary: { flex: 2, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center" },
  actionText: { ...typography.callout, fontWeight: "600" },
});
