# ADR-002: Schema and Observation Model

- **Status:** Accepted (schema fixed by spec §3; this records the load-bearing choices)
- **Date:** 2026-07-15

## Context

The dashboard consumes three independent export sources (TeamBuildr, PlayerData, Perch)
that must reconcile into one queryable model without losing source traceability.

## Decision

- **One narrow observations table.** `metric_observations` stores exactly one normalized
  value per (athlete, session, kpi_key) — enforced by a unique constraint, the final
  duplicate barrier. Raw source rows live on `import_rows` (jsonb), never in the metric
  table.
- **Sessions are first-class.** Multiple sessions per date are expected; athlete+date is
  never a session key. Sessions carry `source` + `source_external_id` for re-import
  matching.
- **Source identity is a mapping table.** `athlete_source_identity` binds (source,
  external_id | normalized raw_name) → athlete. Fuzzy matches only ever *suggest*;
  creation of athletes is always an explicit staff action.
- **KPI registry is configuration data**, not code: canonical unit (immutable), display
  unit (editable), interpretation, aggregation method, valid range, visibility flags.
  `kpi_source_mapping` binds raw source headers to KPI keys.
- **UUID PKs, UTC timestamps, CHECK-constrained enums, soft-retire everywhere.**
  Positions are editable rows, not an enum; retiring never deletes history.
- **Imports are auditable end-to-end:** `imports` (file hash, S3 key, counts, status) +
  `import_rows` (raw, normalized, action, before/after) make rollback implementable later
  without schema change.

## Consequences

Adding a KPI is a registry row + mapping, not a migration. Perch and TeamBuildr
observations coexist independently for the same session. The unique constraint means
re-imports must declare Skip-existing or Replace-existing (§4.2 step 9) — no silent
upserts.
