import {
  addDays,
  startOfDay,
  startOfMonth,
  startOfPreviousMonth,
} from "@money-dock/business-rules";

export type TotalsType = "income" | "expense" | "both";

export type TotalsPeriod =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "last_days"; days: number }
  | { kind: "this_month" }
  | { kind: "prev_month" }
  | { kind: "this_year" }
  | { kind: "all_time" }
  | { kind: "month"; monthIndex: number; year?: number };

export interface TotalsQuery {
  /** null = the message names no income/expense word (a bare "а в сентябре"). */
  type: TotalsType | null;
  period: TotalsPeriod;
  /** True when the period was named in the message rather than defaulted. */
  periodExplicit: boolean;
}

const MONTH_STEMS = [
  "январ",
  "феврал",
  "март",
  "апрел",
  "ма[йя]",
  "июн",
  "июл",
  "август",
  "сентябр",
  "октябр",
  "ноябр",
  "декабр",
];

const INCOME_WORDS = /доход|заработ|получил|получен|пришл|поступ|зарплат|начислен/;
const EXPENSE_WORDS = /потрат|расход|трат|ушл|израсход|заплатил|купил/;
const ASKING = /сколько|покажи|какой|какие|какая|итог|сумм|общ|всего|а\s|за\s|в\s/;

/**
 * Deterministic reading of "how much did I earn/spend, and when" — the question shape
 * behind most assistant traffic. Returns null when the message isn't recognizably such a
 * question, so creation commands ("кофе 350") and everything else fall through untouched.
 */
export function parseTotalsQuery(normalized: string): TotalsQuery | null {
  const hasIncome = INCOME_WORDS.test(normalized);
  const hasExpense = EXPENSE_WORDS.test(normalized);
  const type: TotalsType | null =
    hasIncome && hasExpense ? "both" : hasIncome ? "income" : hasExpense ? "expense" : null;

  const period = parsePeriod(normalized);
  // "потратил 500 на кофе" is a creation command, not a question: an amount-like number
  // that isn't part of a date or period expression means the user is stating, not asking.
  const withoutPeriodNumbers = normalized
    .replace(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/g, " ")
    .replace(/(?:за|последни[ехй]*|прошл[а-я]*)\s*\d+\s*(?:дн|недел|месяц)[а-я]*/g, " ")
    .replace(/\b20\d{2}\b/g, " ");
  if (/\d/.test(withoutPeriodNumbers)) return null;

  if (period.explicit) {
    if (!ASKING.test(normalized) && type === null) return null;
    return { type, period: period.value, periodExplicit: true };
  }
  // No period named: only a question when it clearly asks about income/expense totals —
  // including a bare follow-up like "а доход" / "а расходы?" to the previous answer.
  const bareFollowUp = /^а\s+(?:мои\s+|по\s+)?(?:доход|расход|трат|заработ|получ)/.test(normalized);
  if (
    type !== null &&
    (bareFollowUp || /сколько|покажи|какой|какие|какая|итог|сумм|всего/.test(normalized))
  ) {
    return { type, period: period.value, periodExplicit: false };
  }
  return null;
}

function parsePeriod(n: string): { value: TotalsPeriod; explicit: boolean } {
  const lastDays = /(?:за|последни[ехй]*)\s*(\d{1,3})\s*дн/.exec(n);
  if (lastDays) return { value: { kind: "last_days", days: Number(lastDays[1]) }, explicit: true };
  if (/две недели|2 недели|14\s*дн/.test(n))
    return { value: { kind: "last_days", days: 14 }, explicit: true };
  if (/недел/.test(n)) return { value: { kind: "last_days", days: 7 }, explicit: true };
  if (/позавчера/.test(n)) return { value: { kind: "last_days", days: 2 }, explicit: true };
  if (/вчера/.test(n)) return { value: { kind: "yesterday" }, explicit: true };
  if (/сегодня/.test(n)) return { value: { kind: "today" }, explicit: true };
  if (/прошл[а-я]*\s*месяц|предыдущ[а-я]*\s*месяц/.test(n))
    return { value: { kind: "prev_month" }, explicit: true };
  if (/все\s*время|всё\s*время|всего|за\s*все/.test(n))
    return { value: { kind: "all_time" }, explicit: true };
  if (/этот\s*год|этом\s*году|за\s*год|с начала года/.test(n))
    return { value: { kind: "this_year" }, explicit: true };

  const monthIndex = MONTH_STEMS.findIndex((stem) => new RegExp(stem).test(n));
  if (monthIndex >= 0) {
    const year = /\b(20\d{2})\b/.exec(n);
    return {
      value: { kind: "month", monthIndex, year: year ? Number(year[1]) : undefined },
      explicit: true,
    };
  }
  if (/этом месяце|этот месяц|за месяц|текущ[а-я]*\s*месяц/.test(n))
    return { value: { kind: "this_month" }, explicit: true };
  return { value: { kind: "this_month" }, explicit: false };
}

export interface ResolvedPeriod {
  from: Date;
  to: Date;
  label: string;
}

export function resolvePeriod(period: TotalsPeriod, now: Date, timezone: string): ResolvedPeriod {
  switch (period.kind) {
    case "today":
      return { from: startOfDay(now, timezone), to: now, label: "сегодня" };
    case "yesterday": {
      const to = startOfDay(now, timezone);
      return { from: addDays(to, -1), to, label: "вчера" };
    }
    case "last_days":
      return {
        from: addDays(now, -period.days),
        to: now,
        label: period.days === 7 ? "за неделю" : `за последние ${period.days} дн.`,
      };
    case "prev_month":
      return {
        from: startOfPreviousMonth(now, timezone),
        to: startOfMonth(now, timezone),
        label: "в прошлом месяце",
      };
    case "this_year":
      return {
        from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
        to: now,
        label: "в этом году",
      };
    case "all_time":
      return { from: new Date(0), to: now, label: "за всё время" };
    case "month": {
      const year =
        period.year ??
        (period.monthIndex > now.getUTCMonth() ? now.getUTCFullYear() - 1 : now.getUTCFullYear());
      const from = new Date(Date.UTC(year, period.monthIndex, 1));
      const to = new Date(Date.UTC(year, period.monthIndex + 1, 1));
      return {
        from,
        to,
        label: `за ${from.toLocaleDateString("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" })}`,
      };
    }
    case "this_month":
    default:
      return { from: startOfMonth(now, timezone), to: now, label: "в этом месяце" };
  }
}
