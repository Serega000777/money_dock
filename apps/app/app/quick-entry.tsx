import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { Text } from "../src/ui/Text";
import { Card, PressableScale, Screen } from "../src/ui/primitives";

const API_URL = `${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"}/shortcut/transactions`;

export default function QuickEntry() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["shortcut-credentials"], queryFn: apiClient.shortcutCredentials.list });
  const create = useMutation({ mutationFn: () => apiClient.shortcutCredentials.create(), onSuccess: (value) => { setToken(value.token); void qc.invalidateQueries({ queryKey: ["shortcut-credentials"] }); } });
  const revoke = useMutation({ mutationFn: apiClient.shortcutCredentials.revoke, onSuccess: () => qc.invalidateQueries({ queryKey: ["shortcut-credentials"] }) });
  const copy = (value: string) => { if (Platform.OS === "web") void navigator.clipboard.writeText(value); };
  const active = data?.find((item) => !item.revokedAt);
  return <><Stack.Screen options={{ headerShown: true, title: "Быстрый ввод" }} /><Screen>
    <Card gradient><Text style={styles.hero}>Добавляйте расходы и доходы, не открывая Amola</Text><Text style={styles.heroSub}>Нажал → продиктовал → готово</Text></Card>
    <Card style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Apple Shortcuts</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>Создайте команду: «Запросить ввод» или «Диктовать текст» → «Получить содержимое URL» методом POST.</Text>
      <Text style={[styles.label, { color: theme.textTertiary }]}>URL</Text><Text selectable style={[styles.code, { color: theme.textPrimary }]}>{API_URL}</Text>
      <PressableScale style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])} onPress={() => copy(API_URL)}><Text style={{ color: theme.onAccent }}>Скопировать URL</Text></PressableScale>
      <Text style={[styles.body, { color: theme.textSecondary }]}>Заголовок: Authorization = Bearer TOKEN. JSON: {`{"input":"Текст","mode":"text","source":"ios_shortcut","clientRequestId":"UUID"}`}</Text>
    </Card>
    <Card style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Персональный ключ</Text>
      {token ? <><Text style={[styles.warning, { color: theme.warning }]}>Сохраните сейчас: после ухода с экрана ключ больше не показывается.</Text><Text selectable style={[styles.code, { color: theme.textPrimary }]}>{token}</Text><PressableScale style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])} onPress={() => copy(token)}><Text style={{ color: theme.onAccent }}>Скопировать ключ</Text></PressableScale></> : <Text style={[styles.body, { color: theme.textSecondary }]}>{active ? `Ключ активен${active.lastUsedAt ? " · использовался" : ""}` : "Активного ключа нет"}</Text>}
      <PressableScale style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])} onPress={() => active ? revoke.mutate(active.id) : create.mutate()}><Text style={{ color: active ? theme.negative : theme.textPrimary }}>{active ? "Отозвать ключ" : "Создать ключ"}</Text></PressableScale>
      {active ? <PressableScale style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])} onPress={() => create.mutate()}><Text style={{ color: theme.textPrimary }}>Перевыпустить ключ</Text></PressableScale> : null}
    </Card>
  </Screen></>;
}
const styles = StyleSheet.create({ hero: { ...typography.title, color: "#fff" }, heroSub: { ...typography.body, color: "rgba(255,255,255,.8)" }, card: { gap: spacing.md }, title: typography.headline, body: { ...typography.body, lineHeight: 21 }, label: typography.overline, code: { ...typography.caption }, warning: typography.caption, button: { padding: spacing.md, borderRadius: radii.md, alignItems: "center" }, secondary: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, alignItems: "center" } });
