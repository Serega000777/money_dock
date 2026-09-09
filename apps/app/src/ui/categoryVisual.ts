import { categoryPalette } from "@money-dock/design-tokens";
import type { Category } from "@money-dock/shared-types";

import { CATEGORY_ICONS, type IconName } from "./Icon";

/** Stable hash so a category keeps the same colour forever without storing one. */
function paletteIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % categoryPalette.length;
}

/** Stored `color` wins (user-picked, from the same palette); the seeded system
 * categories predate that column, so they fall back to the stable hash. */
export function categoryColor(
  category?: Pick<Category, "color" | "systemCode" | "id"> | null,
): string {
  if (category?.color) return category.color;
  const seed = category?.systemCode ?? category?.id ?? "none";
  return categoryPalette[paletteIndex(seed)] ?? categoryPalette[0];
}

export function categoryIcon(category?: Pick<Category, "systemCode" | "icon"> | null): IconName {
  const key = category?.systemCode ?? category?.icon ?? "";
  return CATEGORY_ICONS[key] ?? "dots";
}
