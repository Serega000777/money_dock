import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { CommandDraft } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { Icon } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { Card, FadeIn, PressableScale, Screen } from "../src/ui/primitives";
import { formatMinor } from "../src/utils/format";
import { generateClientId } from "../src/utils/uuid";
import { useSpeechRecognition } from "../src/voice/useSpeechRecognition";

const EXAMPLES = [
  "Вчера потратил 840 рублей в кафе с наличных",
  "Добавь 2500 рублей на топливо",
  "Добавь доход 50 тысяч, оплата от клиента",
];

/** A ring that breathes while the mic is open — the only looping animation in the app. */
function PulseRing({ active, color }: { active: boolean; color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        {
          borderColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
        },
      ]}
    />
  );
}

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
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Голос и текст" }} />

      {speech.supported ? (
        <FadeIn index={0}>
          <View style={styles.micWrap}>
            <PulseRing active={speech.listening} color={theme.onGradientPrimary} />
            <Pressable onPressIn={speech.start} onPressOut={speech.stop}>
              <View
                style={StyleSheet.flatten([
                  styles.mic,
                  { backgroundColor: theme.surface, shadowColor: theme.shadowColor },
                ])}
              >
                <View style={styles.micInner}>
                  <Icon
                    name="mic"
                    color={speech.listening ? theme.negative : theme.accent}
                    size={34}
                    strokeWidth={1.9}
                  />
                </View>
              </View>
            </Pressable>
            <Text style={[styles.micHint, { color: theme.onGradientPrimary }]}>
              {speech.listening ? "Говорите…" : "Удерживайте и говорите"}
            </Text>
            {voiceLeft !== null ? (
              <Text style={[styles.hint, { color: theme.onGradientSecondary }]}>
                Осталось голосовых операций в этом месяце: {voiceLeft}
                {voiceLeft === 0 ? " · безлимит входит в Pro" : ""}
              </Text>
            ) : null}
          </View>
        </FadeIn>
      ) : (
        <Text style={[styles.hint, { color: theme.onGradientSecondary }]}>
          Этот браузер не поддерживает распознавание речи — введите команду текстом.
        </Text>
      )}

      <FadeIn index={1}>
        <View style={styles.textRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Или напишите: потратил 840 в кафе"
            placeholderTextColor={theme.textTertiary}
            onSubmitEditing={() => parse.mutate({ value: text, source: "text" })}
            style={[
              styles.input,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
                color: theme.textPrimary,
              },
            ]}
          />
          <PressableScale
            onPress={() =>
              text.trim() && !parse.isPending && parse.mutate({ value: text, source: "text" })
            }
            style={StyleSheet.flatten([
              styles.parseButton,
              { backgroundColor: text.trim() ? theme.accent : theme.surfaceSunken },
            ])}
          >
            <Icon
              name="chevron"
              color={text.trim() ? theme.onAccent : theme.textTertiary}
              size={20}
              strokeWidth={2}
            />
          </PressableScale>
        </View>
      </FadeIn>

      {speech.error ? (
        <Text style={[styles.error, { color: theme.negative }]}>{speech.error}</Text>
      ) : null}
      {error ? <Text style={[styles.error, { color: theme.negative }]}>{error}</Text> : null}

      {draft ? (
        <FadeIn index={2}>
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>Я распознал</Text>

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
                onPress={() => setDraft(null)}
                style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])}
              >
                <Text style={[styles.actionText, { color: theme.textPrimary }]}>Изменить</Text>
              </PressableScale>
              <PressableScale
                onPress={() => !save.isPending && save.mutate(draft)}
                style={StyleSheet.flatten([styles.primary, { backgroundColor: theme.accent }])}
              >
                <Text style={[styles.actionText, { color: theme.onAccent }]}>
                  {save.isPending ? "Сохраняю…" : "Сохранить"}
                </Text>
              </PressableScale>
            </View>
          </Card>
        </FadeIn>
      ) : (
        <FadeIn index={2}>
          <View style={styles.examples}>
            <Text style={[styles.hint, { color: theme.onGradientSecondary }]}>Например:</Text>
            {EXAMPLES.map((example) => (
              <Pressable
                key={example}
                onPress={() => {
                  setText(example);
                  parse.mutate({ value: example, source: "text" });
                }}
                style={StyleSheet.flatten([
                  styles.exampleChip,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ])}
              >
                <Text style={[styles.example, { color: theme.textPrimary }]}>«{example}»</Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>
      )}
    </Screen>
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
  micWrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  mic: {
    width: 108,
    height: 108,
    borderRadius: radii.pill,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  micInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  pulse: {
    position: "absolute",
    top: spacing.lg,
    width: 108,
    height: 108,
    borderRadius: radii.pill,
    borderWidth: 3,
  },
  micHint: { ...typography.headline, marginTop: spacing.xs },
  hint: { ...typography.caption, textAlign: "center" },

  textRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    ...typography.body,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  parseButton: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  error: typography.caption,

  card: { gap: spacing.sm },
  cardTitle: { ...typography.overline, textTransform: "uppercase" },
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

  examples: { gap: spacing.sm },
  exampleChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  example: { ...typography.callout, lineHeight: 22 },
});
