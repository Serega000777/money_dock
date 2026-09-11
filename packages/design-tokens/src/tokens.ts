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
  /** The primary account card's fill — vivid, but a different ramp from accentGradient
   * so the hero card stays the loudest thing on the screen. */
  tileGradient: readonly string[];
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
  backgroundGlow: readonly {
    top: `${number}%`;
    left: `${number}%`;
    size: number;
    color: string;
    opacity: number;
  }[];
  /** Colour for the decorative glows — corner washes inside flat cards, the halo behind
   * the mic — or `null` to draw none at all. The same soft blob reads as depth on a dark
   * surface and as a stain on a white one, so light theme opts out entirely. */
  decorGlow: string | null;
  background: string;
  surface: string;
  /** Bottom sheets sit visibly above the page instead of blending into it. */
  sheet: string;
  surfaceSunken: string;
  /** The unfilled part of a progress bar — lighter than the card it sits on, per the
   * reference, rather than a darker sunken well. */
  barTrack: string;
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

  // Every value below is the reference's own palette (its `base.css` custom properties),
  // flattened from rgba-over-background to the solid equivalent RN needs.
  accent: "#FF2BC7", // --pink
  accentSoft: "#3A0F33",
  accentPressed: "#E521B0",
  onAccent: "#FFFFFF",
  // .balance-card / .mic-button: pink → magenta → blue-violet at 135°.
  accentGradient: ["#FF23B8", "#B626F0", "#5D33FF"],
  // .account-card--gradient at 140° — a distinctly bluer ramp than the hero's.
  tileGradient: ["#D81EE0", "#7B31FF", "#563DFF"],
  // .action-btn: understated, so the icon's own glow carries the accent.
  chipGradient: ["#3A1B42", "#26122C"],

  // The page background stays as it is — the user likes the glowing wash; only the
  // blocks sitting on it move to the reference's palette.
  backgroundGradient: ["#33104E", "#180C2E", "#0A0614"],
  backgroundGlow: [
    { top: "-8%", left: "-20%", size: 420, color: "#E935C1", opacity: 0.55 },
    { top: "38%", left: "55%", size: 460, color: "#8B5CF6", opacity: 0.55 },
  ],
  decorGlow: "#913AFF",
  background: "#0A0614",
  surface: "#281030", // --card-dark over the page
  sheet: "#301738",
  surfaceSunken: "#1B0A21",
  barTrack: "#422D49",
  border: "#3A2440", // --card-border over the card
  borderStrong: "#4C3354",

  textPrimary: "#FFFFFF", // --text-main
  textSecondary: "#C4B4CB", // --text-soft
  textTertiary: "#9A8CA0", // --text-muted

  positive: "#1CCB57",
  positiveSoft: "#0E2E1A",
  negative: "#FF4D5E",
  negativeSoft: "#33131A",
  warning: "#FFB521",
  warningSoft: "#33260D",

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

  // The brand hues washed across the whole page — a faint pink at the top drifting
  // through lavender into a cool tint at the bottom. Deliberately a full-bleed ramp and
  // not blobs: a localised glow reads as a stain on white, where the same shape reads as
  // depth on black.
  backgroundGradient: ["#FFF6FC", "#F8F2FF", "#EFF0FD"],
  backgroundGlow: [],
  decorGlow: null,
  background: "#FBF9FE",
  surface: "#FFFFFF",
  sheet: "#FFFFFF",
  surfaceSunken: "#F0F1F8",
  barTrack: "#E7E5F2",
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
