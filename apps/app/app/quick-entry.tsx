import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, StyleSheet } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { Text } from "../src/ui/Text";
import { Card, PressableScale, Screen } from "../src/ui/primitives";

const API_URL = `${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"}/shortcut/transactions`;

export default function QuickEntry() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useFocusEffect(useCallback(() => () => setToken(null), []));
  const { data } = useQuery({ queryKey: ["shortcut-credentials"], queryFn: apiClient.shortcutCredentials.list });
  const create = useMutation({ gcTime: 0, mutationFn: () => apiClient.shortcutCredentials.create(), onSuccess: (value) => { setToken(value.token); void qc.invalidateQueries({ queryKey: ["shortcut-credentials"] }); }, onError: () => setNotice("Не удалось создать ключ. Попробуйте ещё раз.") });
  const revoke = useMutation({ mutationFn: apiClient.shortcutCredentials.revoke, onSuccess: () => { setToken(null); return qc.invalidateQueries({ queryKey: ["shortcut-credentials"] }); }, onError: () => setNotice("Не удалось отозвать ключ. Проверьте соединение.") });
  const copy = async (value: string) => { try { if (Platform.OS === "web") { await navigator.clipboard.writeText(value); setNotice("Скопировано"); } } catch { setNotice("Не удалось скопировать автоматически. Выделите текст и скопируйте вручную."); } };
  const active = data?.find((item) => !item.revokedAt);
  return <><Stack.Screen options={{ headerShown: true, title: "Быстрый ввод" }} /><Screen>
    <Card gradient><Text style={[styles.hero, { color: theme.textPrimary }]}>Добавляйте расходы и доходы, не открывая Amola</Text><Text style={[styles.heroSub, { color: theme.textSecondary }]}>Нажал → продиктовал → готово</Text></Card>
    {notice ? <Text accessibilityLiveRegion="polite" style={{ color: theme.textSecondary }}>{notice}</Text> : null}
    <Card style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Apple Shortcuts</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>1. Откройте приложение «Команды» на iPhone и создайте команду «Расход Amola».{"\n\n"}2. Добавьте действие «Диктовать текст» или «Запросить ввод». Например: «Кофе 340 рублей».{"\n\n"}3. Добавьте действие «Создать UUID»: новый идентификатор нужен при каждом запуске, чтобы повторная отправка не создавала дубликаты.{"\n\n"}4. Добавьте «Получить содержимое URL», вставьте адрес ниже и выберите метод POST.</Text>
      <Text style={[styles.label, { color: theme.textTertiary }]}>URL</Text><Text selectable style={[styles.code, { color: theme.textPrimary }]}>{API_URL}</Text>
      <PressableScale style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])} onPress={() => copy(API_URL)}><Text style={{ color: theme.onAccent }}>Скопировать URL</Text></PressableScale>
      <Text style={[styles.body, { color: theme.textSecondary }]}>5. В заголовках добавьте Authorization со значением Bearer и вашим ключом через пробел.{"\n\n"}6. Тело запроса — JSON. Поля: input — переменная с продиктованным текстом; mode — text; source — ios_shortcut; clientRequestId — переменная из действия «Создать UUID». Не вводите слова «Текст» и «UUID» вместо переменных.{"\n\n"}7. Добавьте «Показать результат» и закрепите команду на домашнем экране или назначьте на кнопку действия.{"\n\n"}Операция появится в Amola и разделе проверки. Нужен интернет. Telegram открывать не нужно. Продиктованный текст отправляется как текст — лимит голосового распознавания Amola не расходуется.</Text>
    </Card>
    <Card style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Персональный ключ</Text>
      {token ? <><Text style={[styles.warning, { color: theme.warning }]}>Сохраните сейчас: после ухода с экрана ключ больше не показывается.</Text><Text selectable style={[styles.code, { color: theme.textPrimary }]}>{token}</Text><PressableScale style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])} onPress={() => copy(token)}><Text style={{ color: theme.onAccent }}>Скопировать ключ</Text></PressableScale></> : <Text style={[styles.body, { color: theme.textSecondary }]}>{active ? `Ключ активен${active.lastUsedAt ? " · использовался" : ""}` : "Активного ключа нет"}</Text>}
      <Text style={[styles.warning, { color: theme.textSecondary }]}>Ключ даёт право добавлять операции. Не отправляйте его другим людям. Перевыпуск отключит предыдущую команду до замены ключа.</Text>
      <PressableScale style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])} onPress={() => { if (!create.isPending && !revoke.isPending) { if (active) revoke.mutate(active.id); else create.mutate(); } }}><Text style={{ color: active ? theme.negative : theme.textPrimary }}>{create.isPending || revoke.isPending ? "Подождите…" : active ? "Отозвать ключ" : "Создать ключ"}</Text></PressableScale>
      {active ? <PressableScale style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])} onPress={() => { if (!create.isPending && !revoke.isPending) create.mutate(); }}><Text style={{ color: theme.textPrimary }}>Перевыпустить ключ</Text></PressableScale> : null}
    </Card>
  </Screen></>;
}
const styles = StyleSheet.create({ hero: { ...typography.title, color: "#fff" }, heroSub: { ...typography.body, color: "rgba(255,255,255,.8)" }, card: { gap: spacing.md }, title: typography.headline, body: { ...typography.body, lineHeight: 21 }, label: typography.overline, code: { ...typography.caption }, warning: typography.caption, button: { padding: spacing.md, borderRadius: radii.md, alignItems: "center" }, secondary: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, alignItems: "center" } });
