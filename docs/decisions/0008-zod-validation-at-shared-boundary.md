# ADR 0008: Zod schemas live in a shared package and are the single source of truth for DTOs

## Status

Accepted

## Context

Request/response shapes need to be validated on the server and, ideally, trusted on the
client without re-declaring the same shape twice (which drifts). NestJS's own DTO +
class-validator pattern works, but duplicating it with hand-written client types is a
recurring source of bugs.

## Decision

- `packages/validation` holds Zod schemas for every DTO crossing the API boundary,
  starting with `moneySchema`. Types are inferred (`z.infer<...>`) rather than
  hand-written in parallel.
- The API's `ValidationPipe` and NestJS controllers validate against these schemas (via a
  small Zod-to-Nest-pipe adapter added alongside the first real DTO in Stage 1).
- The client (`apps/app`, via `packages/api-client`) imports the same schemas/types —
  one definition, two consumers.

## Consequences

- A shape change is one file edit that both server validation and client types pick up;
  a mismatch is a compile error, not a runtime surprise.
- `packages/shared-types` stays for types with no runtime validation need (e.g. branded
  primitives like `MinorUnits`); `packages/validation` is for anything that must be
  checked against untrusted input.
