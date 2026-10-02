import { radii, typography } from "@money-dock/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { apiClient } from "../api/client";
import { useAuthStore } from "../auth/authStore";
import { useTheme } from "../theme/useTheme";
import { GradientBox } from "../ui/Gradient";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { PressableScale } from "../ui/primitives";

import { usePaywallStore } from "./paywall";

export const ASSISTANT_BUTTON_SIZE = 48;

/** A big four-point spark with two small ones — "AI" without a robot or a speech bubble. */
function Sparkles({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M10 3.2c.5 3.9 2.1 5.5 6 6-3.9.5-5.5 2.1-6 6-.5-3.9-2.1-5.5-6-6 3.9-.5 5.5-2.1 6-6Z"
        fill={color}
      />
      <Path
        d="M18.2 13.2c.28 2.1 1.1 2.92 3.2 3.2-2.1.28-2.92 1.1-3.2 3.2-.28-2.1-1.1-2.92-3.2-3.2 2.1-.28 2.92-1.1 3.2-3.2Z"
        fill={color}
        opacity={0.92}
      />
      <Path
        d="M18.6 2.4c.18 1.3.7 1.82 2 2-1.3.18-1.82.7-2 2-.18-1.3-.7-1.82-2-2 1.3-.18 1.82-.7 2-2Z"
        fill={color}
        opacity={0.8}
      />
    </Svg>
  );
}

/**
 * The floating assistant launcher pinned above the "+" — lives in the tab layout, so it
 * stays put across every tab. Three looks: Pro (glow + crown), free with trial messages
 * left (count badge), and out of trials (dimmed with a lock — a tap opens the paywall).
 */
export function AssistantButton({ bottom, right }: { bottom: number; right: number }) {
  const theme = useTheme();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data } = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => apiClient.entitlements.get(),
    enabled: Boolean(accessToken),
  });

  const isPro = data ? data.plan !== "free" : false;
  const left = data && data.limits.assistant >= 0 ? Math.max(0, data.limits.assistant - data.used.assistant) : null;
  const locked = !isPro && left === 0;

  const onPress = () => {
    if (locked) {
      usePaywallStore
        .getState()
        .open("Бесплатные сообщения ИИ-ассистенту в этом месяце закончились. Ассистент входит в Pro.");
      return;
    }
    router.push("/assistant");
  };

  const label = locked
    ? "ИИ-ассистент — доступен в Pro"
    : isPro
      ? "ИИ-ассистент"
      : `ИИ-ассистент — осталось бесплатных: ${left ?? ""}`;

  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={StyleSheet.flatten([
        styles.wrap,
        { bottom, right, shadowColor: locked ? "#000000" : theme.accent },
        isPro && styles.glow,
        locked && styles.dim,
      ])}
    >
      {locked ? (
        <View style={[styles.circle, { backgroundColor: theme.surface }]}>
          <Sparkles size={26} color={theme.textTertiary} />
        </View>
      ) : (
        <GradientBox
          colors={theme.accentGradient}
          diagonal
          highlight
          highlightSize={40}
          radius={radii.pill}
          style={styles.circle}
        >
          {/* A positioned wrapper: the gradient's absolute <svg> would otherwise paint over a static sibling. */}
          <View>
            <Sparkles size={26} color="#FFFFFF" />
          </View>
        </GradientBox>
      )}

      {locked ? (
        <View style={[styles.badge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Icon name="lock" size={11} color={theme.textSecondary} strokeWidth={2.4} />
        </View>
      ) : isPro ? (
        <View style={[styles.badge, { backgroundColor: theme.warning, borderColor: theme.surface }]}>
          <Icon name="crown" size={11} color="#FFFFFF" strokeWidth={2.2} filled />
        </View>
      ) : left !== null ? (
        <View style={[styles.badge, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
          <Text style={[styles.countText, { color: theme.accent }]}>{left}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    width: ASSISTANT_BUTTON_SIZE,
    height: ASSISTANT_BUTTON_SIZE,
    borderRadius: radii.pill,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  glow: { shadowOpacity: 0.5, shadowRadius: 16 },
  dim: { shadowOpacity: 0.1, opacity: 0.85 },
  circle: {
    width: ASSISTANT_BUTTON_SIZE,
    height: ASSISTANT_BUTTON_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { ...typography.overline, fontSize: 10, lineHeight: 12, letterSpacing: 0, textTransform: "none" },
});
