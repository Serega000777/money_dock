# ADR 0007: No Redis, queues, or object storage until a real use case exists

## Status

Accepted

## Context

It is tempting to stand up Redis + BullMQ + S3 "for later" — background jobs, caching,
file storage will all eventually be needed (voice audio, statement imports, exports). The
product explicitly asks for minimal service load, and every extra managed dependency is
another moving part to run, monitor, and pay for before it earns its keep.

## Decision

Stage 0 ships with exactly two runtime dependencies: the API container and PostgreSQL.
No queue, no cache, no object storage yet.

- `import_jobs` (statement imports) and `voice_requests` run synchronously or via simple
  polling until volume/latency actually requires a queue.
- Uploaded files (bank statements) are processed in-request with strict size/type limits
  before any decision to add S3-compatible storage.
- The trigger to add Redis/BullMQ is a concrete need (e.g. import jobs that must survive
  an API restart, or a rate limiter that must be shared across instances) — not "we'll
  need it eventually".

## Consequences

- Lower hosting cost and fewer failure modes for the MVP.
- `BankProvider`, `SpeechRecognitionProvider`, and similar adapters are still designed as
  interfaces (ADR 0001) specifically so that adding a queue behind them later is an
  internal change, not an API-breaking one.
