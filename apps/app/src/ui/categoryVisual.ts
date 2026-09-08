import { categoryPalette } from "@money-dock/design-tokens";
import type { Category } from "@money-dock/shared-types";

import { CATEGORY_ICONS, type IconName } from "./Icon";

/** Stable hash so a category keeps the same colour forever without storing one. */
function paletteIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % categoryPalette.length;
}

export function categoryColor(seed: string | null | undefined): string {
  return categoryPalette[paletteIndex(seed ?? "none")] ?? categoryPalette[0];
}

export function categoryIcon(category?: Pick<Category, "systemCode" | "icon"> | null): IconName {
  const key = category?.systemCode ?? category?.icon ?? "";
  return CATEGORY_ICONS[key] ?? "dots";
}
