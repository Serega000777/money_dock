import { radii, spacing, typography } from "@money-dock/design-tokens";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { OnboardingArt } from "../src/onboarding/OnboardingArt";
import { onboardingSteps } from "../src/onboarding/content";
import { useOnboardingStore } from "../src/onboarding/onboardingStore";
import { useTheme } from "../src/theme/useTheme";
import { GradientBox } from "../src/ui/Gradient";
import { Text } from "../src/ui/Text";
import { PressableScale, Screen } from "../src/ui/primitives";


export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const [index, setIndex] = useState(0);

  const step = onboardingSteps[index];
  const isLast = index === onboardingSteps.length - 1;

  const finish = () => {
    markSeen();
    router.replace("/sign-in");
  };

  if (!step) return null;

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.skipRow}>
        <PressableScale onPress={finish} hitSlop={8}>
          <Text style={[styles.skip, { color: theme.textSecondary }]}>Пропустить</Text>
        </PressableScale>
      </View>

      <View style={styles.body}>
        <OnboardingArt variant={step.key} />

        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{step.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{step.subtitle}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {onboardingSteps.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? theme.accent : theme.border,
                  width: i === index ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        <PressableScale
          onPress={() => (isLast ? finish() : setIndex((i) => i + 1))}
          style={styles.ctaWrap}
        >
          <GradientBox colors={theme.accentGradient} radius={radii.pill} style={styles.cta}>
            <Text style={[styles.ctaText, { color: theme.onAccent }]}>
              {isLast ? "Начать" : "Далее"}
            </Text>
          </GradientBox>
        </PressableScale>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipRow: { alignItems: "flex-end", paddingTop: spacing.sm },
  skip: { ...typography.callout, fontWeight: "600" },
  body: { flex: 1, justifyContent: "center", gap: spacing.xl },
  textBlock: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  title: { ...typography.title, fontWeight: "700", textAlign: "center" },
  subtitle: { ...typography.body, textAlign: "center" },
  footer: { gap: spacing.lg, paddingBottom: spacing.lg },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 8, borderRadius: radii.pill },
  ctaWrap: { alignSelf: "stretch" },
  cta: { paddingVertical: spacing.md, alignItems: "center" },
  ctaText: { ...typography.headline, fontWeight: "700" },
});
