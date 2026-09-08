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
  /** Magenta → violet, used only on the central add button. */
  accentGradient: readonly [string, string];

  /** The page background is a gradient in both themes, never a flat fill — the same
   * magenta→violet hue as the brand, carried by the whole app instead of one card. */
  backgroundGradient: readonly [string, string, string];
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

  /** Text/icons sitting directly on the vivid page background (screen titles, the
   * greeting, section labels between cards) — never used inside a Card, which stays
   * light and keeps textPrimary/Secondary/Tertiary. */
  onGradientPrimary: string;
  onGradientSecondary: string;

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
  accentGradient: ["#E935C1", "#8B5CF6"],

  backgroundGradient: ["#C21FA0", "#8B3FE0", "#6D28D9"],
  background: "#8B3FE0",
  surface: "#151B29",
  sheet: "#1C2438",
  surfaceSunken: "#101623",
  border: "#232C40",
  borderStrong: "#313B52",

  textPrimary: "#F4F6FB",
  textSecondary: "#8E97AB",
  textTertiary: "#5F6979",

  onGradientPrimary: "#FFFFFF",
  onGradientSecondary: "rgba(255,255,255,0.78)",

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

  backgroundGradient: ["#E935C1", "#A855F7", "#7C4DFF"],
  background: "#7C4DFF",
  surface: "#FFFFFF",
  sheet: "#FFFFFF",
  surfaceSunken: "#F0F1F8",
  border: "#E7E8F2",
  borderStrong: "#D3D6E6",

  textPrimary: "#0E1220",
  textSecondary: "#6B7285",
  textTertiary: "#9AA0B3",

  onGradientPrimary: "#FFFFFF",
  onGradientSecondary: "rgba(255,255,255,0.82)",

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
