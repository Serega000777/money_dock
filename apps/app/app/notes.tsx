import { categoryPalette, radii, spacing, typography } from "@money-dock/design-tokens";
import type { Note } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { Icon } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { Card, FadeIn, PressableScale, Screen } from "../src/ui/primitives";

/** Notes are a scratchpad next to the money, not part of the ledger — plans, limits, ideas. */
export default function Notes() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [colorIndex, setColorIndex] = useState(3);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: () => apiClient.notes.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notes"] });

  const create = useMutation({
    mutationFn: () =>
      apiClient.notes.create({ title: title.trim(), body: body.trim(), colorIndex }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      await invalidate();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      apiClient.notes.update(id, { pinned }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.notes.remove(id),
    onSuccess: invalidate,
  });

  const canSave = title.trim().length > 0 && !create.isPending;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Заметки" }} />

      <FadeIn index={0}>
        <Card style={styles.composer}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Заголовок"
            placeholderTextColor={theme.textTertiary}
            style={[styles.titleInput, { color: theme.textPrimary }]}
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Например: отложить 15 000 ₽ на страховку до 20 числа"
            placeholderTextColor={theme.textTertiary}
            multiline
            style={[
              styles.bodyInput,
              { color: theme.textPrimary, backgroundColor: theme.surfaceSunken },
            ]}
          />

          <View style={styles.composerFooter}>
            <View style={styles.swatches}>
              {categoryPalette.map((color, index) => (
                <Pressable
                  key={color}
                  onPress={() => setColorIndex(index)}
                  accessibilityLabel={`Цвет ${index + 1}`}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    index === colorIndex && { borderColor: theme.textPrimary, borderWidth: 2 },
                  ]}
                />
              ))}
            </View>

            <PressableScale
              onPress={() => canSave && create.mutate()}
              style={StyleSheet.flatten([
                styles.saveButton,
                { backgroundColor: canSave ? theme.accent : theme.surfaceSunken },
              ])}
            >
              <Icon
                name="check"
                color={canSave ? theme.onAccent : theme.textTertiary}
                size={18}
                strokeWidth={2}
              />
              <Text
                style={[styles.saveText, { color: canSave ? theme.onAccent : theme.textTertiary }]}
              >
                Сохранить
              </Text>
            </PressableScale>
          </View>
        </Card>
      </FadeIn>

      {isLoading ? <ActivityIndicator color={theme.accent} style={styles.loader} /> : null}

      {!isLoading && (notes ?? []).length === 0 ? (
        <Text style={[styles.empty, { color: theme.onGradientSecondary }]}>
          Заметок пока нет. Первая запись появится здесь.
        </Text>
      ) : null}

      {(notes ?? []).map((note: Note, index: number) => {
        const color = categoryPalette[note.colorIndex % categoryPalette.length];
        return (
          <FadeIn key={note.id} index={Math.min(index + 1, 6)}>
            <Card style={styles.note}>
              <View style={[styles.stripe, { backgroundColor: color }]} />
              <View style={styles.noteBody}>
                <View style={styles.noteHeader}>
                  <Text style={[styles.noteTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                    {note.title}
                  </Text>
                  <Pressable
                    onPress={() => update.mutate({ id: note.id, pinned: !note.pinned })}
                    accessibilityLabel={note.pinned ? "Открепить" : "Закрепить"}
                    hitSlop={8}
                  >
                    <Icon
                      name="pin"
                      color={note.pinned ? theme.accent : theme.textTertiary}
                      size={18}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => remove.mutate(note.id)}
                    accessibilityLabel="Удалить заметку"
                    hitSlop={8}
                  >
                    <Icon name="trash" color={theme.textTertiary} size={18} />
                  </Pressable>
                </View>
                {note.body ? (
                  <Text style={[styles.noteText, { color: theme.textSecondary }]}>{note.body}</Text>
                ) : null}
                <Text style={[styles.noteDate, { color: theme.textTertiary }]}>
                  {new Date(note.updatedAt).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                  {note.pinned ? " · закреплена" : ""}
                </Text>
              </View>
            </Card>
          </FadeIn>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: { gap: spacing.md },
  titleInput: { ...typography.headline, paddingVertical: 4 },
  bodyInput: {
    ...typography.body,
    minHeight: 76,
    borderRadius: radii.md,
    padding: spacing.md,
    textAlignVertical: "top",
  },
  composerFooter: { gap: spacing.md },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatch: { width: 22, height: 22, borderRadius: radii.pill, borderColor: "transparent" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  saveText: { ...typography.callout, fontWeight: "600" },

  loader: { marginTop: spacing.lg },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.lg },

  note: { flexDirection: "row", padding: 0, overflow: "hidden" },
  stripe: { width: 4 },
  noteBody: { flex: 1, padding: spacing.lg, gap: spacing.xs },
  noteHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  noteTitle: { ...typography.headline, flex: 1 },
  noteText: { ...typography.body, lineHeight: 21 },
  noteDate: typography.caption,
});
