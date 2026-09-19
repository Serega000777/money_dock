import { radii, spacing, typography } from "@money-dock/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { create } from "zustand";

import { apiClient } from "../api/client";
import { useTheme } from "../theme/useTheme";
import { GradientBox } from "../ui/Gradient";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { BottomSheet, PressableScale } from "../ui/primitives";
import { apiErrorMessage, isPlanLimitError } from "../utils/apiError";

interface PaywallState {
  visible: boolean;
  message: string | null;
  open: (message?: string) => void;
  close: () => void;
}

/**
 * One shared sheet for every "you've hit a free-tier wall" moment (voice/import limits,
 * the Pro-only bank card art) instead of each screen building its own upsell UI — see
 * account.tsx, voiceCapture.tsx, import.tsx and accounts.tsx's BankPicker.
 */
export const usePaywallStore = create<PaywallState>((set) => ({
  visible: false,
  message: null,
  open: (message) => set({ visible: true, message: message ?? null }),
  close: () => set({ visible: false }),
}));

/** The server's 403 payload for a metered feature (EntitlementsService.consume) carries
 * a ready-to-show `message` — reused here so the paywall echoes exactly why it appeared,
 * same JSON.parse(error.message) shape OnboardingFlow already relies on. */
export function openPaywallFromError(error: unknown, fallback?: string): void {
  if (!isPlanLimitError(error)) return;
  usePaywallStore.getState().open(apiErrorMessage(error, fallback ?? "Эта возможность входит в подписку Pro."));
}

const FEATURES = [
  "Голос и импорт выписок — без ограничений",
  "Реалистичный дизайн банковской карты",
  "Совместные счета без ограничений на участников",
];

export function PaywallModal() {
  const theme = useTheme();
  const visible = usePaywallStore((state) => state.visible);
  const message = usePaywallStore((state) => state.message);
  const close = usePaywallStore((state) => state.close);
  const { data: pricing } = useQuery({
    queryKey: ["payments-pricing"],
    queryFn: () => apiClient.payments.pricing(),
    enabled: visible,
  });

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={styles.wrap}>
        <GradientBox colors={theme.accentGradient} diagonal radius={radii.pill} style={styles.badge}>
          {/* React Native Web's View defaults to position:relative, which is what makes a
              child paint above GradientRect's position:absolute fill — react-native-svg's
              own <Svg> has no such default, so a bare Icon here would render invisible,
              painted under the gradient regardless of DOM order (CSS: positioned boxes
              always paint after static ones, no matter the source order). */}
          <View style={styles.badgeIcon}>
            <Icon name="crown" color="#FFFFFF" size={26} />
          </View>
        </GradientBox>

        <Text style={[styles.title, { color: theme.textPrimary }]}>Оформите Pro</Text>
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          {message ?? "Эта возможность входит в подписку Pro."}
        </Text>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Icon name="check" color={theme.positive} size={16} strokeWidth={2.2} />
              <Text style={[styles.featureText, { color: theme.textSecondary }]}>{feature}</Text>
            </View>
          ))}
        </View>

        <PressableScale
          onPress={() => {
            close();
            router.push("/upgrade");
          }}
        >
          <GradientBox colors={theme.accentGradient} diagonal radius={radii.md}>
            <View style={styles.cta}>
              <Text style={[styles.ctaText, { color: theme.onAccent }]}>
                {pricing ? `Оформить Pro — ${pricing.starsMonthly} ⭐/мес` : "Оформить Pro"}
              </Text>
            </View>
          </GradientBox>
        </PressableScale>

        <PressableScale onPress={close} style={styles.dismiss}>
          <Text style={[styles.dismissText, { color: theme.textTertiary }]}>Не сейчас</Text>
        </PressableScale>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.sm },
  badge: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  badgeIcon: { alignItems: "center", justifyContent: "center" },
  title: { ...typography.title, marginTop: spacing.xs },
  message: { ...typography.body, textAlign: "center", lineHeight: 21 },
  features: { alignSelf: "stretch", gap: spacing.sm, marginVertical: spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featureText: { ...typography.callout, flex: 1 },
  cta: { paddingVertical: spacing.md, alignItems: "center", minWidth: 220 },
  ctaText: { ...typography.headline, fontWeight: "700" },
  dismiss: { paddingVertical: spacing.sm },
  dismissText: typography.callout,
});
