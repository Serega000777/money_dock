import { categoryPalette } from "@money-dock/design-tokens";
import type { Category } from "@money-dock/shared-types";

import { CATEGORY_ICONS, PICKABLE_ICONS, type IconName } from "./Icon";

const PICKABLE = new Set<string>(PICKABLE_ICONS);

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

/** Seeded categories map their system code; a user's own category stores the icon name
 * picked in the create sheet (that used to fall through to dots for every custom one). */
export function categoryIcon(category?: Pick<Category, "systemCode" | "icon"> | null): IconName {
  const bySystem = category?.systemCode ? CATEGORY_ICONS[category.systemCode] : undefined;
  if (bySystem) return bySystem;
  const icon = category?.icon ?? "";
  return PICKABLE.has(icon) ? (icon as IconName) : "dots";
}
