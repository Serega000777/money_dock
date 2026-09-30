import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { AssistantAction } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { Icon } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { Card, PressableScale, Screen } from "../src/ui/primitives";
import { formatMinor } from "../src/utils/format";
import { useAudioRecorder } from "../src/voice/useAudioRecorder";
import { useSpeechRecognition } from "../src/voice/useSpeechRecognition";

const QUICK_PROMPTS = [
  "Сколько я потратил в этом месяце?",
  "Сколько можно тратить в день?",
  "Покажи мой баланс",
  "Какой прогноз до конца месяца?",
];

export default function AssistantScreen() {
  const theme = useTheme();
  const { prompt, inputType } = useLocalSearchParams<{ prompt?: string; inputType?: "text" | "voice" }>();
  const queryClient = useQueryClient();
  const recorder = useAudioRecorder();
  const listRef = useRef<FlatList>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [action, setAction] = useState<AssistantAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialPromptSent = useRef(false);

  const conversations = useQuery({
    queryKey: ["assistant", "conversations"],
    queryFn: () => apiClient.assistant.listConversations(),
  });
  const createConversation = useMutation({
    mutationFn: () => apiClient.assistant.createConversation(),
    onSuccess: (conversation) => setConversationId(conversation.id),
    onError: () => setError("Не удалось открыть Amola Assistant"),
  });
  useEffect(() => {
    if (conversationId || conversations.isLoading || createConversation.isPending) return;
    const latest = conversations.data?.[0];
    if (latest) setConversationId(latest.id);
    else createConversation.mutate();
  }, [conversationId, conversations.data, conversations.isLoading, createConversation]);

  const messages = useQuery({
    queryKey: ["assistant", "messages", conversationId],
    queryFn: () => apiClient.assistant.listMessages(conversationId!),
    enabled: Boolean(conversationId),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["assistant", "messages", conversationId] }),
      queryClient.invalidateQueries({ queryKey: ["assistant", "conversations"] }),
    ]);
  };
  const send = useMutation({
    mutationFn: (value: string) => apiClient.assistant.sendMessage(conversationId!, value),
    onSuccess: async (response) => {
      setAction(response.action);
      setText("");
      setError(null);
      await refresh();
    },
    onError: () => setError("Не удалось отправить сообщение. Попробуйте ещё раз."),
  });
  const sendVoice = useMutation({
    mutationFn: (audio: Blob) => apiClient.assistant.sendVoice(conversationId!, audio),
    onSuccess: async (response) => {
      setAction(response.action);
      setError(null);
      await refresh();
    },
    onError: () =>
      setError("Голосовой ввод временно недоступен. Можно ввести команду текстом."),
  });
  const localSpeech = useSpeechRecognition((transcript) => {
    if (!conversationId) return;
    void apiClient.assistant.sendMessage(conversationId, transcript, "voice").then(async (response) => {
      setAction(response.action);
      await refresh();
    }).catch(() => setError("Не удалось обработать голосовую команду."));
  });
  const confirm = useMutation({
    mutationFn: (id: string) => apiClient.assistant.confirmAction(id),
    onSuccess: async (updated) => {
      setAction(updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => apiClient.assistant.cancelAction(id),
    onSuccess: setAction,
  });

  const releaseRecording = async () => {
    const clip = await recorder.stop();
    if (clip && conversationId) sendVoice.mutate(clip);
  };
  const submit = (value = text) => {
    const trimmed = value.trim();
    if (trimmed && conversationId && !send.isPending) send.mutate(trimmed);
  };
  useEffect(() => {
    if (!conversationId || !prompt || initialPromptSent.current) return;
    initialPromptSent.current = true;
    if (inputType === "voice") {
      void apiClient.assistant.sendMessage(conversationId, prompt, "voice").then(async (response) => {
        setAction(response.action);
        await refresh();
      }).catch(() => setError("Не удалось обработать голосовую команду."));
    } else submit(prompt);
  }, [conversationId, inputType, prompt]);
  const items = messages.data ?? [];

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: "Amola Assistant" }} />
      {messages.isLoading || !conversationId ? (
        <ActivityIndicator color={theme.accent} style={styles.loader} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.orb, { backgroundColor: theme.accentSoft }]}>
            <Icon name="sparkle" color={theme.accent} size={34} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Чем помочь с финансами?</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Напишите вопрос или продиктуйте операцию</Text>
          <View style={styles.prompts}>
            {QUICK_PROMPTS.map((prompt) => (
              <Pressable key={prompt} onPress={() => submit(prompt)} style={[styles.prompt, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.promptText, { color: theme.textPrimary }]}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.message, item.role === "user" ? styles.userMessage : styles.assistantMessage, { backgroundColor: item.role === "user" ? theme.accent : theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.messageText, { color: item.role === "user" ? theme.onAccent : theme.textPrimary }]}>{item.content}</Text>
            </View>
          )}
        />
      )}

      {action ? <ActionCard action={action} busy={confirm.isPending || cancel.isPending} onConfirm={() => confirm.mutate(action.id)} onCancel={() => cancel.mutate(action.id)} onUpdated={setAction} /> : null}
      {error || recorder.error ? <Text style={[styles.error, { color: theme.negative }]}>{error ?? recorder.error}</Text> : null}

      <Card style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => submit()}
          placeholder="Сообщение Amola…"
          placeholderTextColor={theme.textTertiary}
          style={[styles.input, { color: theme.textPrimary }]}
          returnKeyType="send"
        />
        {recorder.supported || localSpeech.supported ? (
          <PressableScale onPressIn={localSpeech.supported ? localSpeech.start : recorder.start} onPressOut={localSpeech.supported ? localSpeech.stop : () => void releaseRecording()} style={StyleSheet.flatten([styles.circleButton, { backgroundColor: recorder.recording || localSpeech.listening ? theme.negative : theme.accentSoft }])}>
            <Icon name="mic" color={recorder.recording || localSpeech.listening ? "#FFFFFF" : theme.accent} size={21} />
          </PressableScale>
        ) : null}
        <PressableScale onPress={() => submit()} style={StyleSheet.flatten([styles.circleButton, { backgroundColor: text.trim() ? theme.accent : theme.surfaceSunken }])}>
          {send.isPending || sendVoice.isPending ? <ActivityIndicator size="small" color={theme.onAccent} /> : <Icon name="arrowUpRight" color={text.trim() ? theme.onAccent : theme.textTertiary} size={20} />}
        </PressableScale>
      </Card>
    </Screen>
  );
}

function ActionCard({ action, busy, onConfirm, onCancel, onUpdated }: { action: AssistantAction; busy: boolean; onConfirm: () => void; onCancel: () => void; onUpdated: (action: AssistantAction) => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const preview = action.preview;
  const transactions = Array.isArray(preview.transactions)
    ? (preview.transactions as Array<Record<string, unknown>>)
    : [];
  const amountMinor =
    typeof preview.amountMinor === "number"
      ? preview.amountMinor
      : transactions.reduce(
          (sum, transaction) =>
            sum + (typeof transaction.amountMinor === "number" ? transaction.amountMinor : 0),
          0,
        );
  const amount = amountMinor > 0 ? formatMinor(amountMinor) : "—";
  const [amountText, setAmountText] = useState(amountMinor > 0 ? String(amountMinor / 100) : "");
  const [type, setType] = useState<"expense" | "income">(preview.type === "income" ? "income" : "expense");
  const [occurredAt, setOccurredAt] = useState(typeof preview.occurredAt === "string" ? preview.occurredAt : new Date().toISOString());
  const [categoryId, setCategoryId] = useState<string | null>(typeof preview.categoryId === "string" ? preview.categoryId : null);
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiClient.categories.list(), enabled: editing });
  const update = useMutation({
    mutationFn: () => apiClient.assistant.updateAction(action.id, {
      amountMinor: Math.round(Number(amountText.replace(",", ".")) * 100),
      type,
      occurredAt,
      categoryId,
    }),
    onSuccess: (updated) => { onUpdated(updated); setEditing(false); },
  });
  return (
    <Card style={styles.actionCard}>
      <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>{action.status === "completed" ? "✓ Добавлено" : action.status === "cancelled" ? "Отменено" : "Подтвердить операцию"}</Text>
      <Text style={[styles.actionAmount, { color: theme.textPrimary }]}>{amount} ₽</Text>
      {editing ? <View style={styles.editBox}>
        <View style={styles.actionButtons}>
          <PressableScale onPress={() => setType("expense")} style={StyleSheet.flatten([styles.actionButton, { backgroundColor: type === "expense" ? theme.accent : theme.surfaceSunken }])}><Text style={{ color: type === "expense" ? theme.onAccent : theme.textPrimary }}>Расход</Text></PressableScale>
          <PressableScale onPress={() => setType("income")} style={StyleSheet.flatten([styles.actionButton, { backgroundColor: type === "income" ? theme.accent : theme.surfaceSunken }])}><Text style={{ color: type === "income" ? theme.onAccent : theme.textPrimary }}>Доход</Text></PressableScale>
        </View>
        <TextInput value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder="Сумма" placeholderTextColor={theme.textTertiary} style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.border }]} />
        <TextInput value={occurredAt.slice(0, 10)} onChangeText={(value) => setOccurredAt(`${value}T12:00:00.000Z`)} placeholder="ГГГГ-ММ-ДД" placeholderTextColor={theme.textTertiary} style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.border }]} />
        <View style={styles.categoryChips}>{(categories.data ?? []).filter((item) => item.type === type || item.type === "both").map((item) => <Pressable key={item.id} onPress={() => setCategoryId(item.id)} style={[styles.categoryChip, { backgroundColor: categoryId === item.id ? theme.accent : theme.surfaceSunken }]}><Text style={{ color: categoryId === item.id ? theme.onAccent : theme.textPrimary }}>{item.name}</Text></Pressable>)}</View>
        <PressableScale disabled={update.isPending || !Number(amountText)} onPress={() => update.mutate()} style={StyleSheet.flatten([styles.actionButton, { backgroundColor: theme.accent }])}><Text style={{ color: theme.onAccent }}>Сохранить изменения</Text></PressableScale>
      </View> : null}
      {transactions.length > 0 ? (
        transactions.map((transaction, index) => (
          <Text key={index} style={[styles.actionMeta, { color: theme.textSecondary }]}>
            {String(transaction.categoryName ?? "Другое")} — {formatMinor(Number(transaction.amountMinor ?? 0))} ₽
          </Text>
        ))
      ) : (
        <Text style={[styles.actionMeta, { color: theme.textSecondary }]}>{String(preview.categoryName ?? "Другое")} · {String(preview.accountName ?? "Счёт")}</Text>
      )}
      {action.status === "pending" ? <View style={styles.actionButtons}>
        {action.tool === "create_transaction" || action.tool === "update_transaction" ? <PressableScale disabled={busy} onPress={() => setEditing((value) => !value)} style={StyleSheet.flatten([styles.actionButton, { backgroundColor: theme.surfaceSunken }])}><Text style={{ color: theme.textSecondary }}>Изменить</Text></PressableScale> : null}
        <PressableScale disabled={busy} onPress={onCancel} style={StyleSheet.flatten([styles.actionButton, { backgroundColor: theme.surfaceSunken }])}><Text style={{ color: theme.textSecondary }}>Отмена</Text></PressableScale>
        <PressableScale disabled={busy} onPress={onConfirm} style={StyleSheet.flatten([styles.actionButton, { backgroundColor: theme.accent }])}><Text style={{ color: theme.onAccent }}>Добавить</Text></PressableScale>
      </View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  orb: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  emptyTitle: { ...typography.title },
  emptyText: { ...typography.body, textAlign: "center" },
  prompts: { width: "100%", gap: spacing.sm, marginTop: spacing.lg },
  prompt: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md },
  promptText: { ...typography.body },
  messages: { paddingVertical: spacing.md, gap: spacing.sm },
  message: { maxWidth: "84%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, borderWidth: 1 },
  userMessage: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  assistantMessage: { alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  messageText: { ...typography.body },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm },
  input: { ...typography.body, flex: 1, minHeight: 42, paddingHorizontal: spacing.sm },
  circleButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  error: { ...typography.caption, textAlign: "center" },
  actionCard: { gap: 4 },
  actionTitle: { ...typography.body, fontWeight: "700" },
  actionAmount: { ...typography.title },
  actionMeta: { ...typography.caption },
  actionButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flex: 1, alignItems: "center", padding: spacing.sm, borderRadius: radii.md },
  editBox: { gap: spacing.sm, marginTop: spacing.sm },
  editInput: { borderWidth: 1, borderRadius: radii.md, padding: spacing.sm },
  categoryChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  categoryChip: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
