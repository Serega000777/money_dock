/**
 * Deterministic statement-import primitives: column detection, per-row normalization
 * and dedup scoring. Pure functions — the DB round-trips live in the API service, so
 * every parsing quirk here is unit-testable against fixtures.
 */

export function normalizeMerchant(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Classic DP edit distance. Small inputs (merchant strings), so the O(n*m) table is fine. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** 1 = identical after normalization, 0 = nothing in common. */
export function merchantSimilarity(a: string, b: string): number {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;

  // Statements love suffixes: "OZON" vs "OZON.RU", "АЗС ATAN" vs "АЗС ATAN 42". Raw edit
  // distance punishes those hard on short names, so a prefix match scores just under the
  // duplicate threshold — high enough for review, never high enough to auto-skip a row.
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (shorter.length >= 4 && longer.startsWith(shorter)) return 0.9;

  return 1 - levenshtein(na, nb) / maxLen;
}

export class RowParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RowParseError";
  }
}

/** Handles "1 234,56" (RU exports), "1234.56", "-500", "(500)" and stray currency signs. */
export function parseAmountToMinor(raw: string): number {
  // U+00A0 (non-breaking) and U+202F (narrow no-break) are what RU statements use as
  // the thousands separator, written as escapes so they stay visible in review.
  let cleaned = raw.replace(/[\s\u00A0\u202F]/g, "").replace(/[\u20BD$\u20AC"]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(cleaned)) {
    negative = true;
    cleaned = cleaned.slice(1, -1);
  }
  // A comma is a decimal separator in RU exports; a dot is one everywhere else.
  cleaned = cleaned.replace(",", ".");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new RowParseError(`Не удалось разобрать сумму: "${raw}"`);
  const minor = Math.round(Math.abs(value) * 100);
  return negative || value < 0 ? -minor : minor;
}

/** Accepts ISO (2026-03-15), RU (15.03.2026) and US-ish (03/15/2026) date columns. */
export function parseRowDate(raw: string): Date {
  const value = raw.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return new Date(Date.UTC(+iso[1]!, +iso[2]! - 1, +iso[3]!));

  const ru = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(value);
  if (ru) return new Date(Date.UTC(+ru[3]!, +ru[2]! - 1, +ru[1]!));

  throw new RowParseError(`Не удалось разобрать дату: "${raw}"`);
}

const DATE_HEADERS = ["date", "дата", "дата операции", "дата платежа", "operation date"];
const AMOUNT_HEADERS = [
  "amount",
  "сумма",
  "сумма операции",
  "сумма платежа",
  "сумма в валюте счёта",
  "сумма в валюте счета",
];
const MERCHANT_HEADERS = [
  "description",
  "merchant",
  "назначение",
  "описание",
  "назначение платежа",
  "получатель",
  "контрагент",
];
// MCC ("merchant category code") — some RU bank exports include it as its own column,
// which lets categorization skip straight to a reliable signal (spec §18).
const MCC_HEADERS = ["mcc", "мсс", "код категории", "категория мсс"];

export interface ColumnMap {
  date: number;
  amount: number;
  merchant: number | null;
  mcc: number | null;
}

/**
 * Universal mapper: finds the columns by header name across common RU/EN statement
 * exports. Bank-specific templates can layer on top later; this covers the common shape
 * (one signed amount column) without per-bank configuration.
 */
export function detectColumns(header: readonly string[]): ColumnMap {
  const normalized = header.map((h) => normalizeMerchant(h));
  const find = (candidates: string[]) => normalized.findIndex((h) => candidates.includes(h));

  const date = find(DATE_HEADERS);
  const amount = find(AMOUNT_HEADERS);
  const merchant = find(MERCHANT_HEADERS);
  const mcc = find(MCC_HEADERS);

  if (date === -1) throw new RowParseError("В файле не найдена колонка с датой");
  if (amount === -1) throw new RowParseError("В файле не найдена колонка с суммой");

  return {
    date,
    amount,
    merchant: merchant === -1 ? null : merchant,
    mcc: mcc === -1 ? null : mcc,
  };
}

export type DedupTier = "duplicate" | "review" | "new";

export interface DedupCandidate {
  amountMinor: number;
  merchant: string;
}

export interface DedupMatch {
  id: string;
  amountMinor: number;
  merchant: string | null;
}

export interface DedupVerdict {
  tier: DedupTier;
  matchId?: string;
  confidence: number;
}

/**
 * Amount must match exactly (money is the strong signal); merchant similarity then
 * decides between "definitely the same row" and "a human should look".
 * Nothing is ever deleted on the strength of this — high tier only skips creation.
 */
export function classifyDedup(
  candidate: DedupCandidate,
  existing: readonly DedupMatch[],
  { duplicateThreshold = 0.95, reviewThreshold = 0.6 } = {},
): DedupVerdict {
  let best: { match: DedupMatch; similarity: number } | null = null;

  for (const match of existing) {
    if (match.amountMinor !== candidate.amountMinor) continue;
    const similarity = merchantSimilarity(candidate.merchant, match.merchant ?? "");
    if (!best || similarity > best.similarity) best = { match, similarity };
  }

  if (!best) return { tier: "new", confidence: 0 };
  const confidence = Math.round(best.similarity * 100);
  if (best.similarity >= duplicateThreshold) {
    return { tier: "duplicate", matchId: best.match.id, confidence };
  }
  if (best.similarity >= reviewThreshold) {
    return { tier: "review", matchId: best.match.id, confidence };
  }
  return { tier: "new", confidence };
}
