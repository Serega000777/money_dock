export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/**
 * A real scale, not a flat list: the hero number dominates and everything steps down
 * from it. Line heights are tuned for Cyrillic, which sits taller than Latin.
 */
export const typography = {
  hero: { fontSize: 44, lineHeight: 50, fontWeight: "700", letterSpacing: -1.2 },
  display: { fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.6 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "600", letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: "500" },
  caption: { fontSize: 12.5, lineHeight: 17, fontWeight: "400" },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.7 },
} as const;

/** Interface scale from settings — every font size is multiplied by this. */
export const textScale = { small: 0.92, medium: 1, large: 1.12 } as const;
export type TextScaleName = keyof typeof textScale;

export interface Theme {
  name: "light" | "dark";

  accent: string;
  accentSoft: string;
  accentPressed: string;
  onAccent: string;
  /** Pink → magenta → violet, used on the hero balance card and the central/mic
   * button — the one clearly-a-gradient surface in the app. Three stops in dark theme
   * (per the reference), two in light. */
  accentGradient: readonly string[];
  /** A whisper of the same hue, for secondary "block with a number" surfaces (stat
   * tiles) — just enough to read as not-flat, nowhere near accentGradient's intensity. */
  tileGradient: readonly [string, string];
  /** A subtle, almost-neutral vertical duo for pill action buttons (quick-action chips)
   * — dark and understated, so the icon's own glow is what reads as the accent, not the
   * button fill itself. */
  chipGradient: readonly [string, string];

  /** The page background is a gradient in both themes, never a flat fill. */
  backgroundGradient: readonly [string, string, string];
  /** Soft radial glows layered over the background gradient — empty in light theme,
   * a couple of oversized blurred blobs in dark theme for the "alive", not-flat glow
   * the reference has. `top`/`left` are CSS-style percentages (can go negative/>100 to
   * let a blob bleed off-screen), `size` is a pixel diameter. */
  backgroundGlow: readonly { top: `${number}%`; left: `${number}%`; size: number; color: string }[];
  background: string;
  surface: string;
  /** Bottom sheets sit visibly above the page instead of blending into it. */
  sheet: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;

  shadowColor: string;
}

export const darkTheme: Theme = {
  name: "dark",

  accent: "#8B5CF6",
  accentSoft: "#211A3D",
  accentPressed: "#7A4CE0",
  onAccent: "#FFFFFF",
  // Pink → magenta → blue-violet, matching the reference's hero/mic gradient exactly.
  accentGradient: ["#FF23B8", "#B626F0", "#5D33FF"],
  // Indigo → magenta — a second, distinct vivid pair (not just a muted step of
  // accentGradient) so account tiles and stat cards read as lively, not flat.
  tileGradient: ["#3654F4", "#9223D6"],
  // Understated dark-purple duo — quick-action pills stay subdued so the icon's own
  // glow carries the accent instead of the whole button shouting.
  chipGradient: ["#3A1B42", "#26122C"],

  // A glowing magenta-violet wash fading to near-black — per the reference: dark mode
  // should feel alive, not just a dim version of light mode.
  backgroundGradient: ["#33104E", "#180C2E", "#0A0614"],
  backgroundGlow: [
    { top: "-8%", left: "-20%", size: 420, color: "#E935C1" },
    { top: "38%", left: "55%", size: 460, color: "#8B5CF6" },
  ],
  background: "#0A0614",
  surface: "#151220",
  sheet: "#1C1830",
  surfaceSunken: "#100D18",
  border: "#241F33",
  borderStrong: "#322B48",

  textPrimary: "#F4F6FB",
  textSecondary: "#8E97AB",
  textTertiary: "#5F6979",

  positive: "#34D399",
  positiveSoft: "#10281F",
  negative: "#FF6B6B",
  negativeSoft: "#2B1519",
  warning: "#F0A93B",
  warningSoft: "#2A2113",

  shadowColor: "#000000",
};

export const lightTheme: Theme = {
  name: "light",

  accent: "#7C4DFF",
  accentSoft: "#EFEAFF",
  accentPressed: "#6B3FE8",
  onAccent: "#FFFFFF",
  accentGradient: ["#E935C1", "#7C4DFF"],
  // A visibly-lavender step, a bit stronger than the page background's barely-there tint.
  tileGradient: ["#FBF6FF", "#ECE1FF"],
  chipGradient: ["#FFFFFF", "#F7F2FF"],

  // Same gradient idea as dark, only barely tinted — it keeps the two themes related
  // instead of making light mode a flat sheet of paper.
  backgroundGradient: ["#FBFAFF", "#F5F5FD", "#EDEFFB"],
  // No glow blobs — the reference's glowing background is a dark-mode-only look.
  backgroundGlow: [],
  background: "#F7F7FC",
  surface: "#FFFFFF",
  sheet: "#FFFFFF",
  surfaceSunken: "#F0F1F8",
  border: "#E7E8F2",
  borderStrong: "#D3D6E6",

  textPrimary: "#0E1220",
  textSecondary: "#6B7285",
  textTertiary: "#9AA0B3",

  positive: "#0FA36B",
  positiveSoft: "#E6F7F0",
  negative: "#E5484D",
  negativeSoft: "#FDECEC",
  warning: "#C77700",
  warningSoft: "#FDF3E4",

  shadowColor: "#101828",
};

/**
 * The twelve colours a category can be painted in. Order matches the picker grid; the
 * hex is what gets stored, so reordering the grid never re-paints existing categories.
 */
export const categoryPalette = [
  "#10B981",
  "#3B82F6",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#06B6D4",
  "#A78BFA",
  "#84CC16",
  "#F97316",
  "#14B8A6",
  "#6366F1",
] as const;

/** Soft, low-contrast elevation — never a hard drop shadow. */
export const elevation = {
  card: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  float: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

export const motion = {
  /** Calm, not bouncy — money screens shouldn't feel like games. */
  fast: 160,
  normal: 260,
  slow: 420,
} as const;
