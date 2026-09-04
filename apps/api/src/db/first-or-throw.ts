/** `INSERT ... RETURNING` always yields exactly one row for a single-row insert; this just
 * satisfies `noUncheckedIndexedAccess` without silencing a real missing-row bug elsewhere. */
export function firstOrThrow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error("Expected at least one row, got none");
  return row;
}
