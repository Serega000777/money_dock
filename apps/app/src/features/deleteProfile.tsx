import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useMutation } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";

import { apiClient } from "../api/client";
import { queryClient } from "../api/queryClient";
import { useAuthStore } from "../auth/authStore";
import { useTheme } from "../theme/useTheme";
import { Text } from "../ui/Text";
import { BottomSheet } from "../ui/primitives";

/**
 * Deleting the whole profile from inside the app — App Store requires it for any app with
 * sign-up (guideline 5.1.1(v)), and 152-ФЗ gives the user that right anyway. The server
 * hard-deletes the user; everything they own goes with it (cascades), so the copy says so.
 */
export function DeleteProfileSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const remove = useMutation({
    mutationFn: () => apiClient.users.deleteMe(),
    onSuccess: () => {
      onClose();
      queryClient.clear();
      useAuthStore.getState().clear();
    },
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Удалить аккаунт?">
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        Счета, операции, цели, заметки и настройки будут удалены навсегда — восстановить их будет
        нельзя. Подписка, если она есть, тоже перестанет действовать.
      </Text>
      {remove.isError ? (
        <Text style={[styles.body, { color: theme.negative }]}>
          Не удалось удалить аккаунт. Проверьте соединение и попробуйте ещё раз.
        </Text>
      ) : null}
      <View style={styles.buttons}>
        <Pressable
          onPress={onClose}
          style={[styles.button, { backgroundColor: theme.surfaceSunken }]}
        >
          <Text style={[styles.buttonText, { color: theme.textPrimary }]}>Отмена</Text>
        </Pressable>
        <Pressable
          disabled={remove.isPending}
          onPress={() => remove.mutate()}
          style={[styles.button, { backgroundColor: theme.negative }]}
        >
          <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>
            {remove.isPending ? "Удаляю…" : "Удалить навсегда"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, textAlign: "center", marginBottom: spacing.md },
  buttons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  button: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radii.md },
  buttonText: { ...typography.callout, fontWeight: "600" },
});
