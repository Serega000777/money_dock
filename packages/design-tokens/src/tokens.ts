export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/**
 * A real scale, not a flat list: the hero number is meant to dominate the screen and
 * everything else steps down from it. Line heights are tuned for Cyrillic, which sits
 * taller than Latin at the same size.
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

/** One accent, as the product spec demands — no rainbow of category colors. */
const ACCENT = "#3B5BFF";

export interface Theme {
  accent: string;
  accentSoft: string;
  accentPressed: string;
  onAccent: string;
  background: string;
  surface: string;
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

export const lightTheme: Theme = {
  accent: ACCENT,
  accentSoft: "#EDF0FF",
  accentPressed: "#2E49D9",
  onAccent: "#FFFFFF",

  // Two ground tones so cards can sit *above* the page instead of being outlined boxes.
  background: "#F6F7FB",
  surface: "#FFFFFF",
  surfaceSunken: "#EFF1F7",
  border: "#E6E9F0",
  borderStrong: "#D3D8E4",

  textPrimary: "#0E1525",
  textSecondary: "#6B7488",
  textTertiary: "#9AA1B2",

  positive: "#12A150",
  positiveSoft: "#E7F6ED",
  negative: "#E5484D",
  negativeSoft: "#FDECEC",
  warning: "#C77700",
  warningSoft: "#FDF3E4",

  shadowColor: "#0E1525",
};

export const darkTheme: Theme = {
  accent: "#6C86FF",
  accentSoft: "#1B2340",
  accentPressed: "#5872F0",
  onAccent: "#0B0F1A",

  background: "#0B0F1A",
  surface: "#141A28",
  surfaceSunken: "#101623",
  border: "#232B3D",
  borderStrong: "#313A50",

  textPrimary: "#F2F4F9",
  textSecondary: "#98A1B6",
  textTertiary: "#6C778F",

  positive: "#3DD68C",
  positiveSoft: "#12271D",
  negative: "#FF6369",
  negativeSoft: "#2A1517",
  warning: "#F0A93B",
  warningSoft: "#2A2113",

  shadowColor: "#000000",
};

/** Soft, low-contrast elevation — "мягкие карточки", never a hard drop shadow. */
export const elevation = {
  card: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

export const motion = {
  /** Calm, not bouncy — money apps shouldn't feel like games. */
  fast: 160,
  normal: 260,
  slow: 420,
} as const;
