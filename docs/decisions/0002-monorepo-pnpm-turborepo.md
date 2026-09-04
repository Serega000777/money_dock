# ADR 0002: pnpm workspaces + Turborepo monorepo

## Status

Accepted

## Context

The API, the Telegram/mobile app, and their shared domain code (money math, validation,
types, design tokens) must stay in lockstep — a change to a shared type should be a single
commit, not a cross-repo version bump. We also want fast, cached CI.

## Decision

Single repository. `pnpm` workspaces for package linking (fast installs, strict
node_modules by default, native `workspace:*` protocol). `Turborepo` for task
orchestration and caching (`build`, `lint`, `typecheck`, `test` run only for what changed,
respecting the dependency graph via `dependsOn: ["^build"]`).

## Consequences

- `apps/*` and `packages/*` share one lockfile and one set of tool versions.
- Every shared package (`shared-types`, `validation`, `business-rules`, `design-tokens`,
  `api-client`) compiles to `dist/` via `tsc` and is consumed like a normal npm package by
  both the Node API and the Metro-bundled app — no dual ESM/CJS hazard, no path hacks.
- Adding `apps/mobile` later (native iOS/Android builds) is "add a workspace member", not
  a new repository.
