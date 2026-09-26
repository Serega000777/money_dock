import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { CommandDraft } from "@money-dock/shared-types";
import { useQuery } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { DraftSummary, useVoiceCapture } from "../src/features/voiceCapture";
import { useTheme } from "../src/theme/useTheme";
import { GradientBox } from "../src/ui/Gradient";
import { Icon } from "../src/ui/Icon";
import { PulseRing } from "../src/ui/PulseRing";
import { Text } from "../src/ui/Text";
import { Card, FadeIn, PressableScale, Screen } from "../src/ui/primitives";
import { apiErrorMessage, isPlanLimitError } from "../src/utils/apiError";
import { useAudioRecorder } from "../src/voice/useAudioRecorder";
import { useSpeechRecognition } from "../src/voice/useSpeechRecognition";

const EXAMPLES = [
  "Вчера потратил 840 рублей в кафе с наличных",
  "Добавь 2500 рублей на топливо",
  "Добавь доход 50 тысяч, оплата от клиента",
];

const MIC_SIZE = 108;

/**
 * The typing/examples fallback for the primary press-and-hold flow, which lives on the
 * home screen now (see `(tabs)/index.tsx`) — this screen is what browsers with no speech
 * API fall back to, and where "or just type it" always was for anyone who prefers that.
 */
export default function Voice() {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<CommandDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const voice = useVoiceCapture();

  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => apiClient.entitlements.get(),
  });

  const parseValue = useCallback(
    (value: string, source: "voice" | "text") => {
      voice.parse.mutate(
        { value, source },
        {
          onSuccess: (result) => {
            setError(null);
            setDraft(result);
          },
          onError: (e) => {
            setDraft(null);
            // The paywall modal (opened by useVoiceCapture's own onError) already
            // explains a plan-limit 403 — no need to duplicate that as inline text.
            setError(isPlanLimitError(e) ? null : apiErrorMessage(e, "Не удалось разобрать команду"));
          },
        },
      );
    },
    // `voice.parse` is a stable mutation object for the life of the screen.
    [],
  );

  // A finished utterance goes straight to the parser; nothing is saved without a tap.
  const speech = useSpeechRecognition(
    useCallback((transcript: string) => {
      setText(transcript);
      parseValue(transcript, "voice");
    }, []),
  );

  // The iOS fallback: WebKit has never implemented SpeechRecognition, so a held press
  // there records audio instead and sends the clip to the server to be transcribed.
  const recorder = useAudioRecorder();
  const releaseRecording = useCallback(async () => {
    const clip = await recorder.stop();
    if (!clip) return;
    voice.transcribe.mutate(clip, {
      onSuccess: (result) => {
        setError(null);
        setDraft(result);
      },
      onError: (e) => {
        setDraft(null);
        setError(isPlanLimitError(e) ? null : apiErrorMessage(e, "Не удалось распознать речь"));
      },
    });
    // `recorder`/`voice.transcribe` are stable for the life of the screen.
  }, []);

  const voiceLeft =
    entitlements && entitlements.limits.voice >= 0
      ? Math.max(0, entitlements.limits.voice - entitlements.used.voice)
      : null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Голос и текст" }} />

      {speech.supported || recorder.supported ? (
        <FadeIn index={0}>
          <View style={styles.micWrap}>
            <PulseRing
              active={speech.supported ? speech.listening : recorder.recording}
              color={theme.accent}
              size={MIC_SIZE}
            />
            <Pressable
              onPressIn={speech.supported ? speech.start : recorder.start}
              onPressOut={speech.supported ? speech.stop : releaseRecording}
            >
              <GradientBox
                colors={
                  (speech.supported ? speech.listening : recorder.recording)
                    ? [theme.negative, theme.accent]
                    : theme.accentGradient
                }
                diagonal
                radius={radii.pill}
                style={styles.mic}
              >
                <View style={styles.micInner}>
                  <Icon name="mic" color="#FFFFFF" size={34} strokeWidth={1.9} />
                </View>
              </GradientBox>
            </Pressable>
            <Text style={[styles.micHint, { color: theme.textSecondary }]}>
              {voice.transcribe.isPending
                ? "Распознаю…"
                : (speech.supported ? speech.listening : recorder.recording)
                  ? "Говорите…"
                  : "Удерживайте и говорите"}
            </Text>
            {voiceLeft !== null ? (
              <Text style={[styles.hint, { color: theme.textTertiary }]}>
                Осталось голосовых операций в этом месяце: {voiceLeft}
                {voiceLeft === 0 ? " · безлимит входит в Pro" : ""}
              </Text>
            ) : null}
          </View>
        </FadeIn>
      ) : (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
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
            onSubmitEditing={() => parseValue(text, "text")}
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
            onPress={() => text.trim() && !voice.parse.isPending && parseValue(text, "text")}
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
      {recorder.error ? (
        <Text style={[styles.error, { color: theme.negative }]}>{recorder.error}</Text>
      ) : null}
      {error ? <Text style={[styles.error, { color: theme.negative }]}>{error}</Text> : null}

      {draft ? (
        <FadeIn index={2}>
          <Card>
            <DraftSummary
              draft={draft}
              onChange={setDraft}
              saving={voice.save.isPending}
              onDiscard={() => setDraft(null)}
              onSave={() => voice.save.mutate(draft, { onSuccess: () => router.back() })}
            />
          </Card>
        </FadeIn>
      ) : (
        <FadeIn index={2}>
          <View style={styles.examples}>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>Например:</Text>
            {EXAMPLES.map((example) => (
              <Pressable
                key={example}
                onPress={() => {
                  setText(example);
                  parseValue(example, "text");
                }}
              >
                <Text style={[styles.example, { color: theme.accent }]}>«{example}»</Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  micWrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  mic: { width: MIC_SIZE, height: MIC_SIZE },
  micInner: { flex: 1, alignItems: "center", justifyContent: "center" },
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

  examples: { gap: spacing.xs },
  example: { ...typography.callout, lineHeight: 22 },
});
