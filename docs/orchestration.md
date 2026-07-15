# Orchestration Model (spec §15, adapted to available models)

## Roles

- **Orchestrator + architect:** Claude Fable 5 (this project's driving model). The spec
  names Opus as architect/reviewer; per its fallback clause ("preserve the role split:
  strongest available reasoning model for architecture review"), Fable 5 — the stronger
  model — holds both the orchestrator and architecture-review roles. Architecture-sensitive
  work is authored or explicitly reviewed at this level and recorded in `docs/adr/`.
- **Implementation agents:** Sonnet subagents execute bounded, pre-specified tasks
  (UI modules, fixtures, mechanical refactors). They receive a task brief with acceptance
  criteria and affected files; they do not touch protected paths.

## Architecture-sensitive paths (no implementation-agent edits)

See `.github/CODEOWNERS`. In short: `db/migrations/`, database roles/grants, AppSync
schema/resolvers/auth, Cognito config, availability passcode/token flow, import
normalization/aggregation/transaction logic, `src/lib/calculations/`, `src/lib/units/`,
production environment guards.

## Per-milestone workflow

1. Orchestrator writes a scoped task brief (acceptance criteria, affected files).
2. Architecture-sensitive work gets an ADR or ADR update first.
3. Implementation happens as one bounded task.
4. Tests run; architecture-sensitive diffs get an explicit review pass.
5. `docs/build-status.md` checklist updated; work committed.

## Stop conditions (halt and re-review before proceeding)

- A real source export contradicts a documented fixture.
- A new table or KPI storage pattern is proposed.
- An import would need an undocumented aggregation.
- A calculation's window, denominator, or missing-data behavior changes.
- A frontend request appears to need broader Availability permissions.
- A production resource points at dev configuration.
- A test reveals partial imports, unauthorized access, or precision loss.
