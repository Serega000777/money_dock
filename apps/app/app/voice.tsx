import type { CommandDraft } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { formatMinor } from "../src/utils/format";
import { generateClientId } from "../src/utils/uuid";
import { useSpeechRecognition } from "../src/voice/useSpeechRecognition";

const EXAMPLES = [
  "Вчера потратил 840 рублей в кафе с наличных",
  "Добавь 2500 рублей на топливо",
  "Добавь доход 50 тысяч, оплата от клиента",
];

export default function Voice() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<CommandDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => apiClient.entitlements.get(),
  });

  const parse = useMutation({
    mutationFn: ({ value, source }: { value: string; source: "voice" | "text" }) =>
      apiClient.commands.parse(value, source),
    onSuccess: (result) => {
      setError(null);
      setDraft(result);
    },
    onError: (e: Error) => {
      setDraft(null);
      setError(e.message.replace(/^\d+\s*/, ""));
    },
  });

  // A finished utterance goes straight to the parser; nothing is saved without a tap.
  const speech = useSpeechRecognition(
    useCallback(
      (transcript: string) => {
        setText(transcript);
        parse.mutate({ value: transcript, source: "voice" });
      },
      // The mutation object is stable for the life of the screen.
      [],
    ),
  );

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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      router.back();
    },
  });

  const voiceLeft =
    entitlements && entitlements.limits.voice >= 0
      ? Math.max(0, entitlements.limits.voice - entitlements.used.voice)
      : null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: true, title: "Голос и текст" }} />

      <ScrollView contentContainerStyle={styles.content}>
        {speech.supported ? (
          <Pressable
            onPressIn={speech.start}
            onPressOut={speech.stop}
            style={[
              styles.micButton,
              {
                backgroundColor: speech.listening ? theme.negative : theme.accent,
              },
            ]}
          >
            <Text style={styles.micText}>
              {speech.listening ? "Говорите…" : "Удерживайте и говорите"}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Этот браузер не поддерживает распознавание речи — введите команду текстом.
          </Text>
        )}

        {voiceLeft !== null ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Осталось голосовых операций в этом месяце: {voiceLeft}
            {voiceLeft === 0 ? " · безлимит входит в Pro" : ""}
          </Text>
        ) : null}

        <View style={styles.textRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Или напишите: потратил 840 в кафе"
            placeholderTextColor={theme.textSecondary}
            onSubmitEditing={() => parse.mutate({ value: text, source: "text" })}
            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
          />
          <Pressable
            onPress={() => parse.mutate({ value: text, source: "text" })}
            disabled={!text.trim() || parse.isPending}
            style={[
              styles.parseButton,
              { backgroundColor: text.trim() ? theme.accent : theme.border },
            ]}
          >
            <Text style={styles.micText}>→</Text>
          </Pressable>
        </View>

        {speech.error ? (
          <Text style={[styles.error, { color: theme.negative }]}>{speech.error}</Text>
        ) : null}
        {error ? <Text style={[styles.error, { color: theme.negative }]}>{error}</Text> : null}

        {draft ? (
          <View
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>Я распознал:</Text>

            <Row
              label={draft.type === "income" ? "Доход" : "Расход"}
              value={`${formatMinor(draft.amountMinor)} ₽`}
              theme={theme}
              strong
            />
            <Row label="Категория" value={draft.categoryName ?? "Не определена"} theme={theme} />
            <Row label="Счёт" value={draft.accountName ?? "Нет счёта"} theme={theme} />
            <Row
              label="Дата"
              value={new Date(draft.occurredAt).toLocaleDateString("ru-RU")}
              theme={theme}
            />

            <Text style={[styles.confidence, { color: theme.textSecondary }]}>
              Уверенность {Math.round(draft.confidence * 100)}% · распознано:{" "}
              {draft.explanation.join(", ")}
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={() => setDraft(null)}
                style={[styles.secondary, { borderColor: theme.border }]}
              >
                <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>Изменить</Text>
              </Pressable>
              <Pressable
                onPress={() => save.mutate(draft)}
                disabled={save.isPending}
                style={[styles.primary, { backgroundColor: theme.accent }]}
              >
                <Text style={styles.micText}>{save.isPending ? "Сохраняю…" : "Сохранить"}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.examples}>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>Например:</Text>
            {EXAMPLES.map((example) => (
              <Pressable
                key={example}
                onPress={() => {
                  setText(example);
                  parse.mutate({ value: example, source: "text" });
                }}
              >
                <Text style={[styles.example, { color: theme.accent }]}>«{example}»</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type Theme = ReturnType<typeof useTheme>;

function Row({
  label,
  value,
  theme,
  strong,
}: {
  label: string;
  value: string;
  theme: Theme;
  strong?: boolean;
}) {
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
  screen: { flex: 1 },
  content: { padding: 20, gap: 14 },
  micButton: { borderRadius: 16, paddingVertical: 26, alignItems: "center" },
  micText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { fontSize: 13, lineHeight: 19 },
  textRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  parseButton: { borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  error: { fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  cardTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: "500" },
  rowValueStrong: { fontSize: 18, fontWeight: "700" },
  confidence: { fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primary: { flex: 2, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  examples: { gap: 6 },
  example: { fontSize: 13, lineHeight: 20 },
});
