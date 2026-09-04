# ADR 0001: Modular monolith, not microservices

## Status

Accepted

## Context

The product is a single-team, single-database personal finance app. Microservices earn
their cost only when independent scaling, independent deploys, or independent teams are
real constraints — none of that applies at MVP stage, and premature service boundaries
would force network calls, distributed transactions, and duplicated auth for no benefit.

## Decision

Backend is one NestJS application (`apps/api`) organized into modules with explicit
public interfaces (Auth, Users, Accounts, Categories, Transactions, Import, ReviewInbox,
Categorization, Deduplication, Analytics, Voice, Insights, Banking, Subscription, ...).
Modules may not reach into each other's repositories or entities directly — only through
exported services. No module may introduce a circular dependency on another.

External systems (Telegram, speech-to-text, LLM providers, bank data) are integrated
through provider interfaces defined in the owning module, never called directly from
domain code.

## Consequences

- One deployable, one database, one migration history — simple ops for a small team.
- If a module later needs to become an independent service, its already-explicit public
  interface makes extraction mechanical instead of a rewrite.
- Enforced by convention + code review now; a dependency-cruiser/ESLint boundary rule can
  be added once module count makes accidental coupling likely.
