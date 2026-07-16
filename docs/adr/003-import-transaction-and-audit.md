# ADR-003: Import Transaction and Audit

- **Status:** Proposed — design fixed by spec §4; final acceptance after ADR-001 spike
  proves the transaction mechanism
- **Date:** 2026-07-15

## Context

CSV import is the highest-risk workflow (§4). The browser previews; the server decides.

## Decision

- Client-side parse is preview-only. Every validation rule re-runs server-side at commit.
- Commit is **one database transaction**: `imports` status flip, `import_rows`,
  session/identity inserts, and `metric_observations` writes succeed or roll back
  together. A partial import must be impossible, not merely unlikely.
- File-level dedupe by SHA-256 of the original file; exact re-import requires an explicit
  reprocess choice.
- Row actions are a closed set: `insert | update | skip | error`. Errors block commit;
  warnings require acknowledgement. Replacements record `before_data` and `after_data`.
- Original CSVs go to private, encrypted S3, referenced by `imports.s3_object_key`,
  downloadable by authenticated staff only.
- Formula-injection safety: spreadsheet-formula prefixes are escaped on any CSV export of
  audit data. Raw CSV content never enters logs.

## Consequences

The Data API `BeginTransaction`/`CommitTransaction` (or the chosen resolver path) must
handle the full commit in one transaction — this is spike checklist item 5 and the main
thing that could force explicit resolvers over the generated integration.

## Local proof (2026-07-16, architect-role update per docs/orchestration.md)

The semantics above are now implemented in `src/lib/import/` and proven on PGlite (real
PostgreSQL): atomic commit with in-transaction re-validation, forced-failure rollback to
zero rows across every table, before/after audit on replacements, SHA-256 duplicate-file
guard with explicit reprocess, identity/mapping persistence, and cross-source session
sharing. Transaction _semantics are unchanged_ from this ADR; two local-only adaptations
apply until the AWS backend exists:

- `s3_object_key` stores a `local://imports/<sha256>/<filename>` placeholder (no S3 yet);
  the schema is untouched.
- The `imports` row is created inside the commit transaction with status `committed`; the
  `uploaded`/`previewed` staging statuses activate with the AWS upload flow, which is also
  where original-file storage and the §4.3 formula-escaping on audit _export_ land.
- Import counts are per source row, matching the `import_rows` audit exactly (a PlayerData
  row carrying 11 KPIs is one inserted row); observation-level counts remain visible in
  the preview.

Status stays Proposed only because the Aurora Data API transaction mechanism (spike item 5) is unproven; the pipeline behind the `ImportBackend` seam is final-shape.
