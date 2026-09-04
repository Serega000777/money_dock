# ADR 0003: Drizzle ORM over Prisma

## Status

Accepted

## Context

The tech spec leaves the ORM open ("Prisma or Drizzle — pick one and commit"). Both are
production-ready with PostgreSQL. The product requirement that pushed the decision is
explicit: minimal server footprint and fast cold starts (single small container, no
separate infra).

## Decision

Use `drizzle-orm` + `drizzle-kit`.

- No generated query-engine binary or codegen step blocking startup (Prisma ships a Rust
  binary per platform and a generate step; Drizzle is pure TypeScript over `postgres-js`).
- Schema is plain TypeScript (`src/db/schema/*`), so it composes naturally with the rest
  of the modular-monolith module boundaries — no separate `.prisma` DSL to keep in sync.
- SQL-shaped API keeps query cost visible, which matters for the deterministic Analytics
  Engine (safe-to-spend, forecasts) that must stay fast and auditable.
- `drizzle-kit generate` / `migrate` cover the migration workflow the spec requires.

## Consequences

- Less "batteries included" tooling (no Prisma Studio) — acceptable trade for a leaner
  runtime; can be revisited if DX pain shows up.
- The team commits to writing slightly more explicit SQL-like queries in exchange for a
  smaller, faster runtime dependency.
