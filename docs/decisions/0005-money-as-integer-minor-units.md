# ADR 0005: Money is always an integer count of minor units

## Status

Accepted

## Context

Floating point cannot represent decimal currency amounts exactly (`0.1 + 0.2 !== 0.3`),
which is unacceptable for a finance product. This is a hard constraint from the spec, not
a style preference.

## Decision

- `Money.amountMinor` (`packages/shared-types/src/money.ts`) is a branded integer type
  (`MinorUnits`); `asMinorUnits()` throws if given a non-integer.
- Postgres columns for money are `integer`/`bigint` minor units, never `numeric`/`float`
  used as if it were exact decimal.
- All money arithmetic goes through `packages/business-rules/src/money.ts`
  (`addMoney`, `subtractMoney`, `sumMoney`, ...), which also enforces same-currency
  operations — no ad hoc `+`/`-` on `Money` objects anywhere in the codebase.
- LLMs and other external providers never compute money; they only read numbers already
  produced by this deterministic layer (see `docs/architecture/overview.md`).

## Consequences

- Every new module doing money math imports from `business-rules` instead of
  reimplementing arithmetic — enforced by code review.
- Formatting/locale display (₽, decimal separators) is a presentation concern kept out of
  `business-rules` on purpose, to keep that package pure domain logic.
