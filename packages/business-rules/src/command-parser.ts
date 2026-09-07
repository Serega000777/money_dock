/**
 * Rule-based parser for spoken/typed money commands in Russian.
 *
 * Deterministic and dependency-free: an LLM is only ever a fallback for phrases this
 * cannot read (spec: "LLM не считает деньги"). Every branch here is unit-tested, so a
 * regression shows up as a failing test rather than a wrong transaction.
 */

export type ParsedCommandType = "expense" | "income";

export interface ParsedCommand {
  type: ParsedCommandType;
  amountMinor: number;
  /** system_code of the matched category, or null when nothing matched confidently. */
  categoryCode: string | null;
  /** "cash" | "card" | "bank" — matched account hint, or null. */
  accountType: "cash" | "card" | "bank" | null;
  /** Days back from today: 0 = today, 1 = yesterday. */
  daysAgo: number;
  merchant: string | null;
  /** 0..1. Below the confirmation bar the UI must not save without a human. */
  confidence: number;
  /** Which signals fired, for "почему так распозналось" in the UI. */
  matched: string[];
}

const INCOME_WORDS = ["доход", "получил", "зарплат", "поступил", "пришл", "заработал", "оплата от"];
const EXPENSE_WORDS = ["потрат", "расход", "купил", "заплатил", "оплатил", "потратил"];

/** Category hints keyed by the system_code seeded in the categories table. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: [
    "продукт",
    "магазин",
    "пятёрочк",
    "пятерочк",
    "магнит",
    "перекрёсток",
    "перекресток",
    "ашан",
    "лент",
  ],
  restaurants: [
    "кафе",
    "ресторан",
    "кофе",
    "обед",
    "ужин",
    "завтрак",
    "бар",
    "столов",
    "доставка еды",
  ],
  transport: ["такси", "метро", "автобус", "трамвай", "транспорт", "каршеринг", "самокат"],
  fuel: ["бензин", "заправк", "топлив", "азс", "солярк", "дизел"],
  housing: ["жкх", "квартплат", "аренд", "квартир", "коммуналк", "электричеств"],
  health: ["аптек", "врач", "лекарств", "больниц", "стоматолог", "анализ"],
  entertainment: ["кино", "театр", "развлеч", "концерт", "подписк", "игр"],
  shopping: [
    "одежд",
    "покупк",
    "обув",
    "техник",
    "маркетплейс",
    "озон",
    "вайлдберриз",
    "wildberries",
    "ozon",
  ],
  communication: ["связь", "интернет", "мобильн", "телефон", "тариф"],
  salary: ["зарплат", "оклад", "аванс"],
  freelance: ["фриланс", "подработк", "заказ", "клиент"],
};

const ACCOUNT_KEYWORDS: Record<"cash" | "card" | "bank", string[]> = {
  cash: ["наличн", "нал ", "с налички", "кэш"],
  card: ["карт", "картой", "по карте"],
  bank: ["счёт", "счет", "банк", "перевод"],
};

const NUMBER_WORDS: Record<string, number> = {
  ноль: 0,
  один: 1,
  одна: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  семьдесят: 70,
  восемьдесят: 80,
  девяносто: 90,
  сто: 100,
  двести: 200,
  триста: 300,
  четыреста: 400,
  пятьсот: 500,
  шестьсот: 600,
  семьсот: 700,
  восемьсот: 800,
  девятьсот: 900,
};

export class CommandParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandParseError";
  }
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/ё/g, "ё").replace(/\s+/g, " ").trim();
}

/** "две тысячи пятьсот" → 2500. Returns null when no spelled-out number is present. */
function parseSpelledNumber(text: string): number | null {
  const tokens = text.split(/[\s-]+/);
  let total = 0;
  let current = 0;
  let found = false;

  for (const token of tokens) {
    const word = token.replace(/[.,!?]/g, "");
    const value = NUMBER_WORDS[word];
    if (value !== undefined) {
      current += value;
      found = true;
      continue;
    }
    if (/^тысяч/.test(word)) {
      total += (current || 1) * 1000;
      current = 0;
      found = true;
      continue;
    }
    if (/^миллион/.test(word)) {
      total += (current || 1) * 1_000_000;
      current = 0;
      found = true;
    }
  }

  return found ? total + current : null;
}

/** Digits first ("2500", "2 500", "1500.50"), then spelled-out numbers. */
function extractAmountMinor(text: string): number | null {
  const digits = text.match(/\d[\d\s\u00A0]*(?:[.,]\d{1,2})?/);
  if (digits) {
    const cleaned = digits[0].replace(/[\s\u00A0]/g, "").replace(",", ".");
    const value = Number(cleaned);
    if (Number.isFinite(value) && value > 0) {
      // No  here: JS word boundaries are ASCII-only and never match after a Cyrillic
      // letter, which silently dropped the x1000 multiplier for "50 тысяч".
      const thousandWord = /\d[\d\s\u00A0]*\s*(тысяч|тыс\.?|к)(?![а-яё])/.test(text);
      return Math.round(value * (thousandWord ? 1000 : 1) * 100);
    }
  }

  const spelled = parseSpelledNumber(text);
  return spelled && spelled > 0 ? spelled * 100 : null;
}

function extractDaysAgo(text: string): { daysAgo: number; matched: boolean } {
  if (/позавчера/.test(text)) return { daysAgo: 2, matched: true };
  if (/вчера/.test(text)) return { daysAgo: 1, matched: true };
  if (/сегодня/.test(text)) return { daysAgo: 0, matched: true };

  const daysBack = text.match(/(\d+)\s*(?:дн[еяй]|дня|дней)\s*назад/);
  if (daysBack?.[1]) return { daysAgo: Number(daysBack[1]), matched: true };

  return { daysAgo: 0, matched: false };
}

function firstKeywordMatch<T extends string>(
  text: string,
  dictionary: Record<T, string[]>,
): T | null {
  for (const [key, words] of Object.entries(dictionary) as [T, string[]][]) {
    if (words.some((word) => text.includes(word))) return key;
  }
  return null;
}

/**
 * Parses a command into a draft transaction. Throws only when there is no amount at all —
 * everything else degrades into a lower confidence score for the user to confirm.
 */
export function parseCommand(input: string): ParsedCommand {
  const text = normalize(input);
  if (!text) throw new CommandParseError("Пустая команда");

  const amountMinor = extractAmountMinor(text);
  if (amountMinor === null) throw new CommandParseError("Не удалось расслышать сумму");

  const matched: string[] = ["amount"];

  const isIncome = INCOME_WORDS.some((word) => text.includes(word));
  const isExpense = EXPENSE_WORDS.some((word) => text.includes(word));
  const type: ParsedCommandType = isIncome && !isExpense ? "income" : "expense";
  if (isIncome || isExpense) matched.push("type");

  const categoryCode = firstKeywordMatch(text, CATEGORY_KEYWORDS);
  if (categoryCode) matched.push("category");

  const accountType = firstKeywordMatch(text, ACCOUNT_KEYWORDS);
  if (accountType) matched.push("account");

  const { daysAgo, matched: dateMatched } = extractDaysAgo(text);
  if (dateMatched) matched.push("date");

  // Amount alone is a weak signal; every extra recognized field raises confidence, and
  // the UI still shows the parse for confirmation before anything is written.
  const confidence = Math.min(0.98, 0.55 + 0.11 * (matched.length - 1));

  return {
    type,
    amountMinor,
    categoryCode,
    accountType,
    daysAgo,
    merchant: null,
    confidence: Number(confidence.toFixed(2)),
    matched,
  };
}
