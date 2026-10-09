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

  // Exact names first; then any header that merely starts with the word ("Дата операции
  // (МСК)", "Сумма в валюте карты", "Описание операции").
  const findLoose = (exact: string[], prefix: string) => {
    const hit = find(exact);
    return hit !== -1 ? hit : normalized.findIndex((h) => h.startsWith(prefix));
  };
  const date = findLoose(DATE_HEADERS, "дата");
  const amount = findLoose(AMOUNT_HEADERS, "сумма");
  const merchant = findLoose(MERCHANT_HEADERS, "описание");
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

// ─── PDF statements ──────────────────────────────────────────────────────────────────
// PDF exports have no reliable column structure: some yield real tables (often only page
// by page, with the header on page 1 and nothing above the continuation pages), others
// only positioned text where one operation spreads over several lines — date, time, a
// wrapped description, then the amounts. Both readers below normalise into the same
// ["Дата", "Сумма", "Описание"] rows the CSV path already understands.

/** A dd.mm.yyyy / ISO date at the very start of a cell or line — the mark of a new
 * operation, unlike "Период выписки: 01.09.2026 — 30.09.2026" in the document header. */
const ROW_START_DATE =
  /^\s*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}|\d{4}-\d{2}-\d{2})(?:[ T,]+\d{1,2}:\d{2}(?::\d{2})?)?/;
const EMBEDDED_DATE_OR_TIME =
  /\d{4}-\d{2}-\d{2}|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}|\d{1,2}:\d{2}(?::\d{2})?/g;
/** A money figure with kopecks — "- 25 000.00 ₽", "+500,00", "1 468.95 руб". Kopecks are
 * required so document numbers and card digits never pass for an amount. */
const MONEY_SOURCE =
  "([+\\-\\u2212\\u2013]\\s?)?(?<![\\d.,])((?:\\d{1,3}(?:[ \\u00A0\\u202F]\\d{3})+|\\d+)[.,]\\d{2})(?!\\d)(\\s?(?:₽|руб\\.?|RUB|RUR|р\\.))?";
const MONEY_TOKEN = new RegExp(MONEY_SOURCE, "gi");
const MONEY_CELL = new RegExp(`^${MONEY_SOURCE}$`, "i");
const STATEMENT_HEADER = ["Дата", "Сумма", "Описание"];

/** "Оплата товаров по карте 8881 сумма 220.00 в Chao Simferopol RU дата …" → "Chao
 * Simferopol RU"; "Перевод … через СБП. Получатель: Тимур Игоревич С." → "Перевод СБП:
 * Тимур Игоревич С.". Anything else just loses the boilerplate tax notes. */
export function simplifyStatementDescription(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  // (No `\b` after "дата": JavaScript's word boundary is ASCII-only, so it never matches
  // next to a Cyrillic letter.)
  const shop = /(?:оплата|покупка).*?\sв\s(.+?)(?:\s+дата(?=\s|$)|\s+\d{1,2}[.\-/]\d{1,2}|$)/i.exec(
    text,
  );
  if (shop?.[1]) return shop[1].trim();
  const cash =
    /^(взнос наличных|снятие наличных|пополнение).*?\sв\s(.+?)(?:\s+дата(?=\s|$)|$)/i.exec(text);
  if (cash?.[1] && cash[2])
    return `${cash[1][0]!.toUpperCase()}${cash[1].slice(1)}: ${cash[2].trim()}`;
  const person =
    /(?:получатель|отправитель):\s*(.+?)(?:\.?\s*без ндс|\.?\s*ндс не облагается|$)/i.exec(text);
  if (person?.[1]) return `Перевод СБП: ${person[1].trim()}`;
  return text
    .replace(/\.?\s*без ндс\.?/gi, "")
    .replace(/\.?\s*ндс не облагается\.?/gi, "")
    .trim()
    .slice(0, 200);
}

interface StatementRecord {
  date: string;
  /** As printed; `null` = the statement showed no sign on this row. */
  sign: "+" | "-" | null;
  /** Unsigned figure, e.g. "25 000.00". */
  amount: string;
  description: string;
}

function signOf(raw: string | undefined): "+" | "-" | null {
  if (!raw) return null;
  return /[-−–]/.test(raw) ? "-" : "+";
}

function readRecord(record: string): StatementRecord | null {
  const start = ROW_START_DATE.exec(record);
  if (!start?.[1]) return null;
  const rest = record.slice(start[0].length);
  // Dates/times inside the description ("дата 2026-09-30 время 18:50:12") are blanked
  // out — same length, so match positions still line up with `rest` — before money search.
  const scrubbed = rest.replace(EMBEDDED_DATE_OR_TIME, (match) => " ".repeat(match.length));
  const tokens = [...scrubbed.matchAll(MONEY_TOKEN)];
  // A signed figure is the operation's own amount; failing that, one with a currency
  // mark; failing that, the first figure (a trailing one is usually the running balance).
  const pick = tokens.find((t) => t[1]) ?? tokens.find((t) => t[3]) ?? tokens[0];
  if (!pick?.[2]) return null;

  // Every column-amount token (signed or with a currency mark) is cut from the purpose
  // text, right to left so earlier positions stay valid.
  let description = rest;
  for (const token of [...tokens].reverse()) {
    if (token.index === undefined || (!token[1] && !token[3] && token !== pick)) continue;
    description = `${description.slice(0, token.index)} ${description.slice(token.index + token[0].length)}`;
  }
  // A long bare number at the start is the bank's document id, not part of the purpose.
  description = description.replace(/^\s*\d{6,}\s+/, "");

  return {
    date: start[1],
    sign: signOf(pick[1]),
    amount: pick[2],
    description: simplifyStatementDescription(description),
  };
}

/** Unsigned rows take whatever sign the rest of the statement implies: Sber prints "+"
 * only on income, so there an unsigned figure is money out; a statement that marks
 * expenses with "-" means the opposite. */
function toRows(records: StatementRecord[]): string[][] {
  const hasPlus = records.some((r) => r.sign === "+");
  const hasMinus = records.some((r) => r.sign === "-");
  const unsigned = hasPlus && !hasMinus ? "-" : "";
  return [
    STATEMENT_HEADER,
    ...records.map((r) => [
      r.date,
      `${r.sign === "-" ? "-" : r.sign === "+" ? "" : unsigned}${r.amount}`,
      r.description,
    ]),
  ];
}

/** Positioned PDF text → statement rows: each operation starts at a line that begins
 * with a date and runs until the next one. */
export function rowsFromStatementText(text: string): string[][] {
  const records: StatementRecord[] = [];
  let current: string[] = [];
  const flush = () => {
    const record = current.length ? readRecord(current.join(" ")) : null;
    if (record) records.push(record);
    current = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\t/g, " ").trim();
    if (!line) continue;
    if (ROW_START_DATE.test(line)) {
      flush();
      current = [line];
    } else if (/(?:входящий|исходящий)\s+остаток|^итого|^обороты/i.test(line)) {
      flush();
    } else if (current.length && !/^\d{1,3}$|^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) {
      // (a bare 1–3 digit line, or pdf-parse's "-- 1 of 2 --", is a page break)
      current.push(line);
    }
  }
  flush();
  return toRows(records);
}

function findHeader(rows: string[][]): ColumnMap | null {
  for (const row of rows) {
    try {
      return detectColumns(row);
    } catch {
      // Not the header row — keep looking; it's often only on the first page.
    }
  }
  return null;
}

/** No header row anywhere: pick the columns by what's in them. */
function inferColumns(rows: string[][]): ColumnMap | null {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const best = (test: (cell: string) => boolean, exclude: number[]) => {
    let pick = -1;
    let score = 0.5;
    for (let i = 0; i < width; i++) {
      if (exclude.includes(i)) continue;
      const cells = rows.map((r) => r[i] ?? "").filter((c) => c.trim());
      const share = cells.length ? cells.filter(test).length / cells.length : 0;
      if (share > score) [pick, score] = [i, share];
    }
    return pick;
  };
  const date = best((c) => ROW_START_DATE.test(c), []);
  const amount = best((c) => MONEY_CELL.test(c.trim()), [date]);
  if (date === -1 || amount === -1) return null;
  let merchant: number | null = null;
  let letters = 0;
  for (let i = 0; i < width; i++) {
    if (i === date || i === amount) continue;
    const count = rows.reduce((sum, r) => sum + ((r[i] ?? "").match(/\p{L}/gu)?.length ?? 0), 0);
    if (count > letters) [merchant, letters] = [i, count];
  }
  return { date, amount, merchant, mcc: null };
}

/** pdf-parse tables (all pages, in order) → statement rows, or null when nothing in them
 * looks like operations. The header is searched for in every table, not just the first. */
export function rowsFromPdfTables(tables: string[][][]): string[][] | null {
  const rows = tables
    .flat()
    .map((row) => row.map((cell) => (cell ?? "").replace(/\s+/g, " ").trim()));
  const columns =
    findHeader(rows) ?? inferColumns(rows.filter((r) => r.some((c) => ROW_START_DATE.test(c))));
  if (!columns) return null;
  const records: StatementRecord[] = [];
  for (const row of rows) {
    const start = ROW_START_DATE.exec(row[columns.date] ?? "");
    const amount = (row[columns.amount] ?? "").replace(/₽|руб\.?|RUB|RUR|р\./gi, "").trim();
    if (!start?.[1] || !/\d/.test(amount)) continue;
    const bracketed = /^\(.*\)$/.test(amount);
    records.push({
      date: start[1],
      sign: bracketed ? "-" : signOf(/^[+\-−–]/.exec(amount)?.[0]),
      amount: amount.replace(/^[+\-−–]\s*|[()]/g, ""),
      description: simplifyStatementDescription(
        columns.merchant === null ? "" : (row[columns.merchant] ?? ""),
      ),
    });
  }
  return records.length ? toRows(records) : null;
}
