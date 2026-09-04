/**
 * Timezone-correct calendar-period math using only Intl (no date library needed).
 * `users.timezone` is an IANA zone (e.g. "Europe/Moscow") — "today"/"this month" are
 * always relative to that, never to server UTC.
 */

function offsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(instant).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

function localDateParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(instant).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

/** The UTC instant of local midnight for the calendar day containing `instant` in `timeZone`. */
export function startOfDay(instant: Date, timeZone: string): Date {
  const { year, month, day } = localDateParts(instant, timeZone);
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

/** The UTC instant of local midnight on the 1st of the calendar month containing `instant`. */
export function startOfMonth(instant: Date, timeZone: string): Date {
  const { year, month } = localDateParts(instant, timeZone);
  const guess = Date.UTC(year, month - 1, 1, 0, 0, 0);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

/** startOfMonth of the month immediately before the one containing `instant`. */
export function startOfPreviousMonth(instant: Date, timeZone: string): Date {
  const { year, month } = localDateParts(instant, timeZone);
  const guess = Date.UTC(year, month - 2, 1, 0, 0, 0);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

export function daysInMonth(instant: Date, timeZone: string): number {
  const { year, month } = localDateParts(instant, timeZone);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 1-based day-of-month in `timeZone` — also "how many days of this month have elapsed, including today". */
export function dayOfMonth(instant: Date, timeZone: string): number {
  return localDateParts(instant, timeZone).day;
}

export function daysRemainingInMonth(instant: Date, timeZone: string): number {
  return daysInMonth(instant, timeZone) - dayOfMonth(instant, timeZone) + 1;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
