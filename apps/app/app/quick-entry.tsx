import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
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
  const { data } = useQuery({
    queryKey: ["shortcut-credentials"],
    queryFn: apiClient.shortcutCredentials.list,
  });
  const create = useMutation({
    gcTime: 0,
    mutationFn: () => apiClient.shortcutCredentials.create(),
    onSuccess: (value) => {
      setToken(value.token);
      void qc.invalidateQueries({ queryKey: ["shortcut-credentials"] });
    },
    onError: () => setNotice("Не удалось создать ключ. Попробуйте ещё раз."),
  });
  const revoke = useMutation({
    mutationFn: apiClient.shortcutCredentials.revoke,
    onSuccess: () => {
      setToken(null);
      return qc.invalidateQueries({ queryKey: ["shortcut-credentials"] });
    },
    onError: () => setNotice("Не удалось отозвать ключ. Проверьте соединение."),
  });
  const copy = async (value: string) => {
    try {
      if (Platform.OS === "web") await navigator.clipboard.writeText(value);
      else await Clipboard.setStringAsync(value);
      setNotice("Скопировано");
    } catch {
      setNotice("Не удалось скопировать автоматически. Выделите текст и скопируйте вручную.");
    }
  };
  const active = data?.find((item) => !item.revokedAt);
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Быстрый ввод" }} />
      <Screen>
        <Card gradient>
          <Text style={[styles.hero, { color: theme.textPrimary }]}>
            Добавляйте расходы и доходы, не открывая Amola
          </Text>
          <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
            Нажал → продиктовал → готово
          </Text>
        </Card>
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={{ color: theme.textSecondary }}>
            {notice}
          </Text>
        ) : null}
        <Card style={styles.card}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Apple Shortcuts</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            1. Откройте приложение «Команды» на iPhone и создайте команду «Расход Amola».{"\n\n"}2.
            Добавьте действие «Диктовать текст» или «Запросить ввод». Например: «Кофе 340 рублей».
            {"\n\n"}3. Добавьте «Получить содержимое URL», вставьте адрес ниже и выберите метод POST.
          </Text>
          <Text style={[styles.label, { color: theme.textTertiary }]}>URL</Text>
          <Text selectable style={[styles.code, { color: theme.textPrimary }]}>
            {API_URL}
          </Text>
          <PressableScale
            style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])}
            onPress={() => copy(API_URL)}
          >
            <Text style={{ color: theme.onAccent }}>Скопировать URL</Text>
          </PressableScale>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            4. В заголовках добавьте Authorization со значением Bearer и вашим ключом через пробел.
            {"\n\n"}5. Тело запроса — JSON, вставьте образец ниже и подставьте в поле input
            переменную с продиктованным текстом вместо слова «Текст».{"\n\n"}6. Добавьте «Показать
            результат» и закрепите команду на домашнем экране или назначьте на кнопку действия.
          </Text>
          <Text style={[styles.label, { color: theme.textTertiary }]}>Тело запроса</Text>
          <Text
            selectable
            style={[styles.code, { color: theme.textPrimary }]}
          >{`{"input": "Текст", "mode": "text"}`}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Операция появится в Amola и разделе «Проверка быстрого ввода». Нужен интернет, Telegram
            открывать не нужно. Первые 3 быстрых ввода в месяц бесплатны, дальше — в подписке Pro.
            Продиктованный текст отправляется как текст — лимит голосового
            распознавания Amola не расходуется. Поле clientRequestId можно не добавлять — без него
            теряется только защита от случайного дубля при повторной отправке того же запроса, iOS
            не даёт готового способа сгенерировать его без стороннего приложения.
          </Text>
        </Card>
        <Card style={styles.card}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Фото чека вместо текста</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Тот же URL и ключ, только тело запроса — с фото вместо надиктованного текста.{"\n\n"}
            <Text style={{ fontWeight: "600" }}>iPhone, «Команды»:</Text> добавьте действие «Снять
            фото» (или «Выбрать фото»), затем «Кодировать медиафайл» с параметром «Кодировать как:
            Base64» — на разных версиях iOS шаг может называться чуть иначе, смысл тот же.{"\n\n"}
            Тело запроса:
          </Text>
          <Text
            selectable
            style={[styles.code, { color: theme.textPrimary }]}
          >{`{"input": "Base64", "mode": "photo", "imageMimeType": "image/jpeg"}`}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Подставьте в поле input результат «Кодировать медиафайл» вместо слова «Base64».{"\n\n"}
            <Text style={{ fontWeight: "600" }}>Android, HTTP Shortcuts:</Text> выберите фото как
            переменную типа File, затем при вставке в поле input выберите у неё опцию «Base64-encoded
            content».{"\n\n"}
            Чек появится в «Проверке быстрого ввода» уже с распознанной суммой и магазином — останется
            проверить и одобрить.
          </Text>
        </Card>
        <Card style={styles.card}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Android (HTTP Shortcuts)</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            1. Установите бесплатное приложение «HTTP Shortcuts» (Google Play или F-Droid, автор —
            Roland Meyer) — оно делает то же самое, что «Команды» на iPhone.{"\n\n"}2. Создайте
            новый шорткат: тип запроса — Text Request, метод — POST, вставьте адрес ниже.
          </Text>
          <Text style={[styles.label, { color: theme.textTertiary }]}>URL</Text>
          <Text selectable style={[styles.code, { color: theme.textPrimary }]}>
            {API_URL}
          </Text>
          <PressableScale
            style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])}
            onPress={() => copy(API_URL)}
          >
            <Text style={{ color: theme.onAccent }}>Скопировать URL</Text>
          </PressableScale>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            3. В заголовках (Headers) добавьте Authorization со значением Bearer и вашим ключом
            через пробел.{"\n\n"}4. В теле запроса (Request body, тип JSON) вставьте образец ниже —
            сначала создайте переменную типа «Text Input» с диалогом ввода, вставьте её в поле input
            через кнопку {"{x}"} у поля.
          </Text>
          <Text style={[styles.label, { color: theme.textTertiary }]}>Тело запроса</Text>
          <Text
            selectable
            style={[styles.code, { color: theme.textPrimary }]}
          >{`{"input": "{{ваша переменная}}", "mode": "text"}`}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            5. Сохраните и добавьте значок на главный экран (пункт меню «Place on home screen»).
            {"\n\n"}Дальше: тапнули значок → откроется поле ввода → нажмите значок микрофона на
            клавиатуре Android и продиктуйте, например «Кофе 340 рублей» → подтвердите. Операция
            появится в Amola и разделе проверки. Telegram открывать не нужно, интернет — нужен.
            clientRequestId в теле запроса можно не указывать — при повторном одинаковом запросе
            сервер один раз создаст новую операцию сам (без него теряется только защита от
            случайного дубля при повторной отправке того же самого запроса).
          </Text>
        </Card>
        <Card style={styles.card}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Персональный ключ</Text>
          {token ? (
            <>
              <Text style={[styles.warning, { color: theme.warning }]}>
                Сохраните сейчас: после ухода с экрана ключ больше не показывается.
              </Text>
              <Text selectable style={[styles.code, { color: theme.textPrimary }]}>
                {token}
              </Text>
              <PressableScale
                style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])}
                onPress={() => copy(token)}
              >
                <Text style={{ color: theme.onAccent }}>Скопировать ключ</Text>
              </PressableScale>
            </>
          ) : (
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              {active
                ? `Ключ активен${active.lastUsedAt ? " · использовался" : ""}`
                : "Активного ключа нет"}
            </Text>
          )}
          <Text style={[styles.warning, { color: theme.textSecondary }]}>
            Ключ даёт право добавлять операции. Не отправляйте его другим людям. Перевыпуск отключит
            предыдущую команду до замены ключа.
          </Text>
          <PressableScale
            style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])}
            onPress={() => {
              if (!create.isPending && !revoke.isPending) {
                if (active) revoke.mutate(active.id);
                else create.mutate();
              }
            }}
          >
            <Text style={{ color: active ? theme.negative : theme.textPrimary }}>
              {create.isPending || revoke.isPending
                ? "Подождите…"
                : active
                  ? "Отозвать ключ"
                  : "Создать ключ"}
            </Text>
          </PressableScale>
          {active ? (
            <PressableScale
              style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])}
              onPress={() => {
                if (!create.isPending && !revoke.isPending) create.mutate();
              }}
            >
              <Text style={{ color: theme.textPrimary }}>Перевыпустить ключ</Text>
            </PressableScale>
          ) : null}
        </Card>
      </Screen>
    </>
  );
}
const styles = StyleSheet.create({
  hero: { ...typography.title, color: "#fff" },
  heroSub: { ...typography.body, color: "rgba(255,255,255,.8)" },
  card: { gap: spacing.md },
  title: typography.headline,
  body: { ...typography.body, lineHeight: 21 },
  label: typography.overline,
  code: { ...typography.caption },
  warning: typography.caption,
  button: { padding: spacing.md, borderRadius: radii.md, alignItems: "center" },
  secondary: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, alignItems: "center" },
});
