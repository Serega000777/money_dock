import { spacing, typography } from "@money-dock/design-tokens";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { legalDocuments, privacyPolicy } from "../../src/legal/content";
import { useTheme } from "../../src/theme/useTheme";
import { Text } from "../../src/ui/Text";
import { FadeIn, Screen } from "../../src/ui/primitives";

/** One screen for all three legal documents — content lives in src/legal/content.ts,
 * this just lays it out for reading (heading, updated-at caption, section by section). */
export default function LegalDocumentScreen() {
  const theme = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const doc = legalDocuments.find((d) => d.slug === slug) ?? privacyPolicy;

  return (
    <Screen contentStyle={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: doc.title }} />

      <FadeIn index={0}>
        <Text style={[styles.updatedAt, { color: theme.textTertiary }]}>
          Обновлено: {doc.updatedAt}
        </Text>
        <Text style={[styles.intro, { color: theme.textSecondary }]}>{doc.intro}</Text>
      </FadeIn>

      {doc.sections.map((section, index) => (
        <FadeIn key={section.heading} index={Math.min(index + 1, 6)}>
          <View style={styles.section}>
            <Text style={[styles.heading, { color: theme.textPrimary }]}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, i) => (
              <Text key={i} style={[styles.paragraph, { color: theme.textSecondary }]}>
                {paragraph}
              </Text>
            ))}
          </View>
        </FadeIn>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  updatedAt: { ...typography.caption, marginBottom: spacing.sm },
  intro: { ...typography.body, lineHeight: 22 },
  section: { gap: spacing.sm },
  heading: { ...typography.headline, fontWeight: "700" },
  paragraph: { ...typography.body, lineHeight: 22 },
});
