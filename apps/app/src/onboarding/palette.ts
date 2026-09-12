/**
 * Onboarding runs on its own fixed dark palette from the design spec, not on the app's
 * light/dark `Theme` — it is a standalone first-run surface shown before any preference
 * exists, and the reference design is dark in both cases.
 */
export const ob = {
  background: ["#120516", "#1D0824", "#25082F"] as const,
  primaryGradient: ["#FF27C9", "#C72CFF", "#6B36FF"] as const,
  secondaryGradient: ["#FF42D7", "#853CFF"] as const,
  buttonGradient: ["#FF27C9", "#B72CFF", "#6537FF"] as const,
  logoGradient: ["#FF41D2", "#D94FFF"] as const,

  textPrimary: "#FFFFFF",
  textSecondary: "#C9AECA",
  textMuted: "#8F769A",

  cardBackground: "rgba(45, 18, 53, 0.78)",
  cardBorder: "rgba(255,255,255,0.10)",
  cardRadius: 28,

  tileBackground: "rgba(45, 18, 53, 0.55)",
  fieldBackground: "rgba(255,255,255,0.06)",

  glowPink: "#FF27C9",
  glowViolet: "#8B3CFF",
  script: "#F06BE0",

  buttonHeight: 72,
  buttonRadius: 999,
} as const;

/** Category colours for the analytics donut, tuned to read on the dark ground. */
export const obCategoryColors = ["#B45CFF", "#FF3DC0", "#FFA06B", "#C79BFF", "#8C5BFF"] as const;
