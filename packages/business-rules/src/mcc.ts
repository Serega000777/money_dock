/**
 * ISO 18245 merchant category codes → our system category codes. Deliberately a small
 * curated subset (the common RU-statement codes), not the full ~800-code standard — the
 * pipeline falls through to the local keyword classifier or Review Inbox for anything
 * not listed here, which is a fine outcome (spec §18: MCC is one signal among several,
 * not the categorizer of record).
 */
const MCC_TO_SYSTEM_CATEGORY: Record<string, string> = {
  "5411": "groceries", // Grocery stores, supermarkets
  "5422": "groceries", // Meat/poultry
  "5441": "groceries", // Candy, nut, confectionery
  "5451": "groceries", // Dairy
  "5462": "groceries", // Bakeries
  "5499": "groceries", // Misc food stores
  "5812": "restaurants", // Eating places, restaurants
  "5813": "restaurants", // Bars, taverns
  "5814": "restaurants", // Fast food
  "4111": "transport", // Commuter transport, ferries
  "4121": "transport", // Taxi/limousine
  "4131": "transport", // Bus lines
  "4789": "transport", // Transportation services (n.e.c.)
  "5541": "fuel", // Service stations
  "5542": "fuel", // Automated fuel dispensers
  "4900": "housing", // Utilities
  "6513": "housing", // Real estate / rental agents
  "8011": "health", // Doctors
  "8021": "health", // Dentists
  "8062": "health", // Hospitals
  "5912": "health", // Drug stores, pharmacies
  "7832": "entertainment", // Motion picture theaters
  "7922": "entertainment", // Theatrical producers
  "7996": "entertainment", // Amusement parks
  "5311": "shopping", // Department stores
  "5651": "shopping", // Family clothing stores
  "5691": "shopping", // Men's/women's clothing
  "5999": "shopping", // Misc retail
  "4814": "communication", // Telecom services
  "4816": "communication", // Computer network / internet services
};

/** Returns our system category code for an MCC, or null if it isn't in the curated map. */
export function mccToSystemCategory(mcc: string): string | null {
  return MCC_TO_SYSTEM_CATEGORY[mcc.trim()] ?? null;
}
