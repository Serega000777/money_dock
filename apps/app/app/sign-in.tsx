import { ApiError } from "@money-dock/api-client";
import { radii, spacing, typography } from "@money-dock/design-tokens";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { apiClient } from "../src/api/client";
import { signInDemo } from "../src/auth/AuthProvider";
import { useTheme } from "../src/theme/useTheme";
import { Icon, type IconName } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { PressableScale, Screen } from "../src/ui/primitives";

type Provider = "telegram" | "yandex" | "vk";

/** `ApiError.message` is the raw response body — the server sends structured JSON
 * (`{ code, message, correlationId }`), so pull the human-readable field out of it. */
function extractMessage(error: ApiError): string {
  try {
    const body = JSON.parse(error.message) as { message?: string };
    return body.message ?? "Способ входа пока недоступен.";
  } catch {
    return "Способ входа пока недоступен.";
  }
}

/**
 * Registration screen for the standalone app (browser or, eventually, a native mobile
 * build) — inside a real Telegram Mini App this never renders, because `AuthProvider`
 * already signed the user in silently by the time the router could reach it (see the
 * gate in `app/_layout.tsx`). Yandex ID and VK ID hit real scaffolded endpoints that
 * currently return 501 — see `AuthService.loginWithYandex`/`loginWithVk` for what's
 * still needed to wire them up for real.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Provider | null>(null);

  const goToApp = () => router.replace("/(tabs)");

  const handleTelegram = () => {
    setNotice("Откройте Money Dock из Telegram, чтобы войти через него автоматически.");
  };

  const handleOAuthStub = async (provider: "yandex" | "vk") => {
    setPending(provider);
    setNotice(null);
    try {
      const redirectUri = "money-dock://auth/callback";
      if (provider === "yandex") {
        await apiClient.auth.loginWithYandex("stub-code", redirectUri);
      } else {
        await apiClient.auth.loginWithVk("stub-code", redirectUri);
      }
    } catch (error) {
      setNotice(error instanceof ApiError ? extractMessage(error) : "Способ входа пока недоступен.");
    } finally {
      setPending(null);
    }
  };

  const handleDemo = async () => {
    setPending("telegram");
    try {
      await signInDemo();
      goToApp();
    } catch {
      setNotice("Не удалось войти в демо-режиме. Проверьте соединение и попробуйте ещё раз.");
      setPending(null);
    }
  };

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.body}>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Money Dock</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Войдите, чтобы начать вести финансы
          </Text>
        </View>

        <View style={styles.buttons}>
          <ProviderButton
            icon="telegram"
            label="Продолжить с Telegram"
            loading={pending === "telegram"}
            onPress={handleTelegram}
          />
          <ProviderButton
            icon="yandexId"
            label="Продолжить с Yandex ID"
            loading={pending === "yandex"}
            onPress={() => handleOAuthStub("yandex")}
          />
          <ProviderButton
            icon="vkId"
            label="Продолжить с VK ID"
            loading={pending === "vk"}
            onPress={() => handleOAuthStub("vk")}
          />
        </View>

        {notice ? (
          <View style={[styles.notice, { backgroundColor: theme.surfaceSunken }]}>
            <Text style={[styles.noticeText, { color: theme.textSecondary }]}>{notice}</Text>
          </View>
        ) : null}
      </View>

      <PressableScale onPress={handleDemo} style={styles.demoLink} hitSlop={8}>
        <Text style={[styles.demoText, { color: theme.textTertiary }]}>
          Продолжить в демо-режиме, без входа
        </Text>
      </PressableScale>
    </Screen>
  );
}

/** `yandexId`/`vkId` aren't real brand marks — just a lettermark badge, since these two
 * providers are scaffolding (see the module doc comment above). */
function ProviderButton({
  icon,
  label,
  loading,
  onPress,
}: {
  icon: IconName | "yandexId" | "vkId";
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={loading}>
      <View
        style={[
          styles.providerButton,
          { backgroundColor: theme.surface, borderColor: theme.border, opacity: loading ? 0.6 : 1 },
        ]}
      >
        <View style={[styles.providerBadge, { backgroundColor: theme.surfaceSunken }]}>
          {icon === "yandexId" ? (
            <Text style={[styles.badgeLetters, { color: theme.textPrimary }]}>Я</Text>
          ) : icon === "vkId" ? (
            <Text style={[styles.badgeLetters, { color: theme.textPrimary }]}>VK</Text>
          ) : (
            <Icon name={icon} color={theme.textPrimary} size={18} />
          )}
        </View>
        <Text style={[styles.providerLabel, { color: theme.textPrimary }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: "center", gap: spacing.xxl },
  heading: { gap: spacing.xs, alignItems: "center" },
  title: { ...typography.hero, fontWeight: "700" },
  subtitle: { ...typography.body, textAlign: "center" },
  buttons: { gap: spacing.sm },
  providerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  providerBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLetters: { ...typography.caption, fontWeight: "700" },
  providerLabel: { ...typography.callout, fontWeight: "600" },
  notice: { borderRadius: radii.md, padding: spacing.md },
  noticeText: { ...typography.caption, textAlign: "center" },
  demoLink: { alignItems: "center", paddingVertical: spacing.lg },
  demoText: { ...typography.caption, textDecorationLine: "underline" },
});
