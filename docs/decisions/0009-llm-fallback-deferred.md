# ADR 0009: LLM fallback for categorization stays unwired until it has a revenue base

## Status

Accepted

## Context

The spec's categorization pipeline (§18) has seven steps: user rule → user history →
global merchant alias → MCC → local classifier → LLM fallback → uncategorized/review. As
of Stage 6 the first five and the seventh are implemented (`CategorizationService`,
`packages/business-rules/src/mcc.ts`, `local-classifier.ts`). A Gemini API key already
sits in `.env`, so wiring step 6 is a small amount of code away.

The product principle (doc 01 §8, ADR 0005's spirit) is that money math and
categorization are deterministic by default; an LLM is a fallback for what determinism
can't reach, not a first resort. Every one of the five active steps together already
covers personal rules, prior behavior, well-known brands, bank-supplied MCCs, and generic
keywords — a real network call would only fire for merchants that are genuinely novel
*and* unrecognizable by keyword, which is a narrow, low-frequency case at MVP traffic
levels, while every call still costs money and adds latency + an external dependency to
a request path.

## Decision

Do not call any LLM from `CategorizationService` yet. The pipeline stops after the local
classifier and falls through to `uncategorized` (Review Inbox), exactly where the spec's
own step 7 already sends low-confidence rows. Revisit once the product has paying users
whose categorization-quality complaints justify the marginal cost — not before.

The five deterministic steps are engineered to leave this decision reversible without a
larger rewrite: `CategorizationService.categorize()` already returns a
`CategorizationResult` with `source`/`confidence`/`explanationCode`, so an `llm_fallback`
source slots in as one more private method call between `matchLocalClassifier` and the
`UNCATEGORIZED` return, with no caller-visible change.

## Consequences

- No new runtime dependency, no per-request latency risk, no API cost, and no new class
  of failure (rate limits, provider outage, prompt-injection-via-merchant-string) to
  handle for Stage 6.
- A merchant unmatched by rule/history/alias/MCC/keyword lands in Review Inbox
  (`low_category_confidence`) instead of getting an automatic best-guess category — more
  manual taps for users on genuinely novel merchants, which is the accepted cost.
- The unused `GEMINI_API_KEY` in `.env` is not a leftover to clean up — it's there for
  when this ADR is revisited.
