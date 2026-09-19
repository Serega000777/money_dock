import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { apiClient } from "../src/api/client";
import { useTelegram } from "../src/telegram/TelegramProvider";
import { useTheme } from "../src/theme/useTheme";
import { GradientBox } from "../src/ui/Gradient";
import { Icon, type IconName } from "../src/ui/Icon";
import { Text } from "../src/ui/Text";
import { Card, FadeIn, Pill, PressableScale, Screen } from "../src/ui/primitives";

const FEATURES = [
  "Голос и импорт выписок — без ограничений",
  "Реалистичный дизайн банковской карты",
  "Совместные счета без ограничений на участников",
];

type PaymentStatus = "idle" | "opening" | "paid" | "failed";

/**
 * The "beautiful payment page" the account screen's Pro badge and the paywall modal both
 * route to. Telegram Stars is the one method actually wired to a provider (see
 * PaymentsController) — everything else is a "Скоро" row, same treatment the onboarding
 * screen already gives Yandex ID/VK ID while their OAuth apps don't exist yet.
 */
export default function Upgrade() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { webApp, isInsideTelegram } = useTelegram();
  const [status, setStatus] = useState<PaymentStatus>("idle");

  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => apiClient.entitlements.get(),
  });
  const { data: pricing } = useQuery({
    queryKey: ["payments-pricing"],
    queryFn: () => apiClient.payments.pricing(),
  });

  const buyWithStars = useMutation({
    mutationFn: () => apiClient.payments.starsInvoiceLink(),
    onSuccess: ({ url }) => {
      if (!webApp?.openInvoice) {
        setStatus("failed");
        return;
      }
      setStatus("opening");
      webApp.openInvoice(url, (result) => {
        if (result === "paid") {
          setStatus("paid");
          void queryClient.invalidateQueries({ queryKey: ["entitlements"] });
        } else if (result === "cancelled") {
          setStatus("idle");
        } else {
          setStatus("failed");
        }
      });
    },
    onError: () => setStatus("failed"),
  });

  const isPro = entitlements ? entitlements.plan !== "free" : false;
  const canPayWithStars = isInsideTelegram && Boolean(webApp?.openInvoice);
  const busy = buyWithStars.isPending || status === "opening";

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Amola Pro" }} />

      <FadeIn index={0}>
        <GradientBox
          colors={theme.accentGradient}
          diagonal
          highlight
          radius={radii.lg}
          style={styles.hero}
        >
          <View style={styles.heroBadge}>
            <Icon name="crown" color="#FFFFFF" size={30} />
          </View>
          <Text style={styles.heroTitle}>Amola Pro</Text>
          <Text style={styles.heroSubtitle}>
            {pricing ? `${pricing.starsMonthly} ⭐ в месяц` : "Без лимитов на голос и импорт"}
          </Text>
        </GradientBox>
      </FadeIn>

      <FadeIn index={1}>
        <Card style={styles.featuresCard}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Icon name="check" color={theme.positive} size={18} strokeWidth={2.2} />
              <Text style={[styles.featureText, { color: theme.textPrimary }]}>{feature}</Text>
            </View>
          ))}
        </Card>
      </FadeIn>

      {isPro ? (
        <FadeIn index={2}>
          <Card style={styles.doneCard}>
            <Icon name="check" color={theme.positive} size={22} strokeWidth={2.2} />
            <Text style={[styles.doneText, { color: theme.textPrimary }]}>
              Pro уже активен на вашем аккаунте
            </Text>
          </Card>
        </FadeIn>
      ) : status === "paid" ? (
        <FadeIn index={2}>
          <Card style={styles.doneCard}>
            <Icon name="check" color={theme.positive} size={22} strokeWidth={2.2} />
            <Text style={[styles.doneText, { color: theme.textPrimary }]}>
              Готово! Pro активирован
            </Text>
            <PressableScale onPress={() => router.back()}>
              <Text style={[styles.doneBack, { color: theme.accent }]}>Вернуться</Text>
            </PressableScale>
          </Card>
        </FadeIn>
      ) : (
        <FadeIn index={2}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Способ оплаты</Text>
          <Card style={styles.methodsCard}>
            <PaymentRow
              icon="star"
              label="Telegram Stars"
              hint={pricing ? `${pricing.starsMonthly} ⭐` : undefined}
              busy={busy}
              onPress={canPayWithStars ? () => buyWithStars.mutate() : undefined}
            />
            <PaymentRow icon="bank" label="СБП" soon />
            <PaymentRow icon="card" label="Картой" soon />
            <PaymentRow icon="wallet" label="Yandex Pay" soon />
            <PaymentRow icon="wallet" label="Tinkoff Pay" soon />
          </Card>

          {!canPayWithStars ? (
            <Text style={[styles.hint, { color: theme.textTertiary }]}>
              Оплата Stars доступна внутри Telegram — откройте Amola через бота.
            </Text>
          ) : null}
          {status === "failed" ? (
            <Text style={[styles.error, { color: theme.negative }]}>
              Не получилось оформить оплату. Попробуйте ещё раз.
            </Text>
          ) : null}
        </FadeIn>
      )}
    </Screen>
  );
}

function PaymentRow({
  icon,
  label,
  hint,
  soon,
  busy,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  soon?: boolean;
  busy?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale style={styles.row} onPress={onPress} disabled={!onPress || busy}>
      <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} color={theme.accent} size={18} />
      </View>
      <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
      {busy ? (
        <Text style={[styles.rowHint, { color: theme.textTertiary }]}>Открываю…</Text>
      ) : soon ? (
        <Pill label="Скоро" color={theme.textSecondary} background={theme.surfaceSunken} />
      ) : (
        <>
          {hint ? <Text style={[styles.rowHint, { color: theme.textTertiary }]}>{hint}</Text> : null}
          <Icon name="chevron" color={theme.textTertiary} size={18} />
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: 4 },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  heroTitle: { ...typography.display, color: "#FFFFFF" },
  heroSubtitle: { ...typography.body, color: "rgba(255,255,255,0.85)" },

  featuresCard: { gap: spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featureText: { ...typography.callout, flex: 1 },

  doneCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  doneText: { ...typography.headline, textAlign: "center" },
  doneBack: { ...typography.callout, fontWeight: "600" },

  sectionTitle: { ...typography.overline, textTransform: "uppercase", marginBottom: spacing.xs },
  methodsCard: { paddingVertical: spacing.xs, gap: 0 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
  rowIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  rowLabel: { ...typography.body, flex: 1 },
  rowHint: typography.callout,

  hint: { ...typography.caption, lineHeight: 17, marginTop: spacing.xs },
  error: { ...typography.caption, lineHeight: 17, marginTop: spacing.xs },
});
