export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "700" },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
} as const;

export interface Theme {
  accent: string;
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  positive: string;
  negative: string;
  warning: string;
}

// Single accent color per product concept: calm UI, no visual noise.
const accent = "#2563EB";

export const lightTheme: Theme = {
  accent,
  background: "#FFFFFF",
  surface: "#F8FAFC",
  border: "#E2E8F0",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  positive: "#16A34A",
  negative: "#DC2626",
  warning: "#D97706",
};

export const darkTheme: Theme = {
  accent,
  background: "#0B1220",
  surface: "#111A2C",
  border: "#1E293B",
  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
  positive: "#22C55E",
  negative: "#EF4444",
  warning: "#F59E0B",
};
