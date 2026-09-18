import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { apiClient } from "../src/api/client";
import { useTheme } from "../src/theme/useTheme";
import { Text } from "../src/ui/Text";
import { Card, PressableScale, Screen, Segmented } from "../src/ui/primitives";

export default function AccountSharing() {
  const { id } = useLocalSearchParams<{ id: string }>(); const theme = useTheme(); const qc = useQueryClient();
  const [role, setRole] = useState<"member" | "viewer">("member"); const [hours, setHours] = useState<"24" | "168" | "0">("24"); const [link, setLink] = useState<string | null>(null);
  const { data: members } = useQuery({ queryKey: ["account-members", id], queryFn: () => apiClient.accounts.members(id) });
  const invite = useMutation({ mutationFn: () => apiClient.accounts.createInvite(id, { role, expiresInHours: hours === "0" ? null : Number(hours), maxUses: 1 }), onSuccess: ({ token }) => setLink(`https://t.me/amola_finance_bot/amola?startapp=budget_inv_${token}`) });
  const remove = useMutation({ mutationFn: (userId: string) => apiClient.accounts.removeMember(id, userId), onSuccess: () => qc.invalidateQueries({ queryKey: ["account-members", id] }) });
  const share = () => { if (!link || Platform.OS !== "web") return; if (navigator.share) void navigator.share({ title: "Приглашение в Amola", url: link }); else void navigator.clipboard.writeText(link); };
  return <><Stack.Screen options={{ headerShown: true, title: "Участники" }} /><Screen>
    <Card style={styles.card}>{members?.map((m) => <View key={m.userId} style={styles.row}><View style={styles.main}><Text style={[styles.name, { color: theme.textPrimary }]}>{m.displayName}</Text><Text style={[styles.sub, { color: theme.textSecondary }]}>{m.role === "owner" ? "Владелец" : m.role === "member" ? "Участник" : "Просмотр"}</Text></View>{m.role !== "owner" ? <PressableScale onPress={() => remove.mutate(m.userId)}><Text style={{ color: theme.negative }}>Удалить</Text></PressableScale> : null}</View>)}</Card>
    <Card style={styles.card}><Text style={[styles.name, { color: theme.textPrimary }]}>Создать приглашение</Text><Segmented value={role} onChange={setRole} options={[{ value: "member", label: "Участник" }, { value: "viewer", label: "Просмотр" }]} /><Segmented value={hours} onChange={setHours} options={[{ value: "24", label: "24 часа" }, { value: "168", label: "7 дней" }, { value: "0", label: "Без срока" }]} /><PressableScale style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])} onPress={() => invite.mutate()}><Text style={{ color: theme.onAccent }}>Создать ссылку</Text></PressableScale>{link ? <><Text selectable style={[styles.link, { color: theme.textPrimary }]}>{link}</Text><PressableScale style={StyleSheet.flatten([styles.button, { borderColor: theme.border, borderWidth: 1 }])} onPress={share}><Text style={{ color: theme.textPrimary }}>Поделиться</Text></PressableScale></> : null}</Card>
  </Screen></>;
}
const styles = StyleSheet.create({ card: { gap: spacing.md }, row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm }, main: { flex: 1 }, name: typography.headline, sub: typography.caption, button: { padding: spacing.md, borderRadius: radii.md, alignItems: "center" }, link: typography.caption });
