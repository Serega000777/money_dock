import { normalizeMerchant } from "./import";

/**
 * Deterministic keyword → system category classifier (spec §9/§18: "локальный
 * классификатор" — not an LLM, not machine-learned, just generic RU/EN terms that aren't
 * tied to one specific brand — see merchant-aliases.ts (or the DB table of the same name)
 * for brand-specific matches, which take priority over this).
 */
const KEYWORD_RULES: ReadonlyArray<{ systemCode: string; keywords: readonly string[] }> = [
  {
    systemCode: "restaurants",
    keywords: ["кафе", "ресторан", "кофейня", "столовая", "coffee", "cafe", "restaurant"],
  },
  { systemCode: "groceries", keywords: ["супермаркет", "продукты", "grocery", "market"] },
  { systemCode: "transport", keywords: ["такси", "метро", "автобус", "taxi", "transport"] },
  { systemCode: "fuel", keywords: ["азс", "заправка", "fuel", "gas station"] },
  { systemCode: "health", keywords: ["аптека", "клиника", "больница", "pharmacy", "clinic"] },
  { systemCode: "housing", keywords: ["жкх", "квартплата", "коммунальные", "аренда квартиры"] },
  { systemCode: "entertainment", keywords: ["кинотеатр", "театр", "концерт", "cinema"] },
  { systemCode: "communication", keywords: ["связь", "мобильная связь", "интернет-провайдер", "telecom"] },
];

/** Returns a system category code for a generic keyword match, or null. */
export function classifyByKeyword(merchant: string): string | null {
  const normalized = normalizeMerchant(merchant);
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) return rule.systemCode;
  }
  return null;
}
