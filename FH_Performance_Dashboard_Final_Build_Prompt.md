# FH Performance Dashboard — From-Scratch Build Prompt

This is a ground-up rebuild, not a patch on the existing `FH_Performance_Dashboard.html`. Treat the current V1 file only as a reference for what data/behavior has already been validated with the coaching staff — the implementation itself should not be inherited. No 1.2MB single-line seed hack, no localStorage-as-database. Build this as a real, properly structured application, **fully on AWS** (no Supabase or other third-party backend-as-a-service).

## 0. Simplicity Principle (applies to every section below)

Simpler is better, everywhere. When a section below offers a choice, the plan-and-build process should default to the smallest thing that correctly satisfies the requirement, not the most impressive-sounding one:

- Prefer one clear table over a clever generalized one, one straightforward query over a clever abstraction, one obvious component over a configurable framework — **unless** this doc explicitly calls for the flexibility (e.g. the `positions` table and `kpi_registry` are intentionally configurable because real future change is named and expected — most other things are not).
- No speculative features, no "might need this later" scaffolding. If it isn't in Functional Requirements (§13) or explicitly asked for, don't build it.
- If Opus (planning) or Sonnet (execution) hits a fork between a simple approach and a fancier one and the simple one satisfies the spec, take the simple one and note the fancier option was considered and skipped — don't silently over-engineer.

---

## 1. Product Summary

A performance-monitoring dashboard for a college field hockey team (25 athletes) used by the strength & conditioning / performance staff. It replaces spreadsheet review of three exported data sources:

- **TeamBuildr** — lift data (Back Squat, Bench Press, Trap Bar Deadlift, Power Clean), exported as CSV.
- **PlayerData** — GPS/training-load data (distance, high-speed distance, player load, top speed, sprints, accelerations/decelerations, and PlayerData's own 1–10 Workload scale), exported as CSV.
- **Perch** — velocity-based-training (VBT) data, exported as its own CSV: mean concentric power on Back Squat/Bench/Trap Bar Deadlift, peak power on Power Clean, tied to the same lift sessions as TeamBuildr but from a separate export/device. Treat Perch as a **third, independent import source** — not a column tacked onto TeamBuildr's file — since it comes from a different piece of hardware on its own export schedule and may not line up 1:1 with every TeamBuildr session (a lift can have TeamBuildr load data with no Perch reading, or vice versa).

Season structure: **4 weeks preseason + 13 weeks in-season = 17 weeks**, daily GPS/load granularity, lifts logged on training days only. No max-effort testing battery, no TSA, no points/score system anywhere — the product shows raw metric values and derived load ratios (ACWR, monotony, strain) only.

Primary user: one or a small number of performance staff. Not athlete-facing, not public.

---

## 2. Tech Stack — All AWS

Use one repository and one AWS account, with separate dev and production environments. The chosen primary architecture is:

- **Frontend:** Vite + React + TypeScript + Tailwind.
- **Hosting and deployment:** AWS Amplify Hosting, connected to the git repository.
- **Authentication:** Amazon Cognito through Amplify Auth.
- **Database:** **Amazon Aurora PostgreSQL Serverless v2 with the RDS Data API enabled**, not a standard `db.t4g.micro` RDS instance. This is the coherent relational path for an AppSync-backed application because the AppSync relational database integration is built around an Aurora cluster exposed through the Data API.
- **API:** AWS AppSync GraphQL. Use Amplify Gen 2 Data's SQL integration only after the architecture verification spike below proves that it supports the required schema, transactions, authorization rules, and generated client behavior. If the generated SQL path is limiting, keep AppSync but implement explicit resolvers against the Aurora Data API. A Lambda/API Gateway API is the final fallback, not the default.
- **File storage:** a private Amazon S3 bucket for original CSV imports. Files are encrypted at rest, never public, and referenced by import records.
- **Secrets:** AWS Secrets Manager for database credentials and any server-side secret. No database password, passcode hash, IAM key, or secret is ever shipped to the browser.
- **Observability:** CloudWatch logs and alarms for API errors, failed imports, and authentication failures. Do not log CSV contents, access tokens, passcodes, athlete notes, or raw personally identifiable information.
- **Repository:** a proper git repository with migrations, tests, and commit history from day one.

### 2.1 Required architecture verification spike

Before building full pages, prove the backend path with a small vertical slice:

1. Provision the dev Aurora PostgreSQL cluster with the Data API enabled.
2. Apply one migration that creates `athletes`, `sessions`, and `metric_observations`.
3. Configure Cognito and AppSync.
4. From the React app, sign in with a dev Cognito account, create one synthetic athlete, write one metric observation, and read it back.
5. Prove a multi-statement transaction for an import commit.
6. Prove that an unauthenticated request cannot call the staff API.
7. Prove that the database connection uses a least-privileged application role rather than the master user.
8. Record the result in `docs/adr/001-backend-path.md`.

Do not let implementation agents build the full UI until this spike passes. If Amplify's generated SQL integration fails the spike, use explicit AppSync resolvers against the Aurora Data API. Only move to Lambda/API Gateway if AppSync itself cannot satisfy the transaction or authorization requirements.

### 2.2 Database authorization model

Cognito authenticates the human user at the API layer. PostgreSQL does not automatically understand a Cognito identity merely because the request came through AppSync.

For v1, all approved staff have the same application permissions. Create a least-privileged database role such as `fh_app_staff` and use that role for application queries. Grant it only the required tables, views, and functions. Enable PostgreSQL RLS as defense in depth where useful, but do not describe it as directly validating Cognito tokens unless the implementation explicitly passes verified identity context into the database session.

The production database must:

- have no public endpoint;
- reject use of the master database user by application code;
- allow no anonymous browser-to-database path;
- require authenticated staff access through AppSync for every endpoint except the tightly scoped Availability portal described in §7.1;
- use parameterized statements only;
- keep all schema changes in versioned migrations.

### 2.3 Cost guardrails

Do not assume this stack will stay below a specific monthly amount. Before production is created, make an AWS Pricing Calculator estimate for Aurora capacity, storage, AppSync, Amplify Hosting, S3, Cognito, logs, and backups. Create AWS Budget alerts at two levels, such as an early warning and a hard-review threshold. The alert values should be chosen from the estimate, not guessed in code.

## 3. Data Model — Aurora PostgreSQL Schema

The database stores session-level normalized observations. Raw source rows remain attached to the import audit record, while the main metric table contains the one normalized value that the dashboard uses for that athlete, session, and KPI.

```text
seasons
  id (uuid, pk)
  name
  start_date, end_date
  status                 -- planned | active | archived
  created_at, updated_at

positions
  id (uuid, pk)
  name
  sort_order
  active
  created_at, updated_at
  -- Editable list; retiring a position never deletes historical records.

athletes
  id (uuid, pk)
  first_name, last_name
  current_position_id (fk -> positions.id, nullable)
  jersey_number (nullable)
  height_in, weight_lb (nullable)
  years_on_team (nullable)
  status                 -- active | inactive
  created_at, updated_at
  -- Do not store DOB or other PII unless a functional requirement is added for it.

athlete_source_identity
  id (uuid, pk)
  athlete_id (fk -> athletes.id)
  source                 -- TeamBuildr | PlayerData | Perch
  external_id (nullable)
  raw_name
  created_at
  -- Stable source-to-athlete mapping. Prefer external_id when present.
  -- Unique on (source, external_id) when external_id is not null.
  -- Unique on (source, normalized raw_name) when no external_id exists.

sessions
  id (uuid, pk)
  season_id (fk -> seasons.id)
  session_date
  start_time (nullable)
  label
  type                   -- practice | lift | game | recovery | testing | other
  source
  source_external_id (nullable)
  created_at, updated_at
  -- Multiple sessions may occur on the same date.
  -- Do not use athlete + date as the only session key.

availability_entries
  id (uuid, pk)
  athlete_id (fk -> athletes.id)
  effective_date
  status                 -- full_go | limited | out
  operational_note (nullable)
  entry_channel          -- staff_app | availability_portal
  updated_by_sub (nullable)
  created_at, updated_at
  -- Operational_note is short and must not contain a diagnosis or detailed medical record.
  -- Unique on (athlete_id, effective_date).

kpi_registry
  id (uuid, pk)
  key (unique)           -- stable internal key, e.g. player_load
  display_name
  primary_source         -- TeamBuildr | PlayerData | Perch | Derived
  category               -- Strength | Power | GPS | Load
  canonical_unit         -- immutable storage unit
  display_unit           -- editable presentation unit
  interpretation         -- higher_is_better | lower_is_better | target_range | neutral
  aggregation_method     -- max | mean | sum | last | best_set | source_value
  valid_min (nullable)
  valid_max (nullable)
  decimal_places
  in_leaderboards
  in_monitoring
  in_profile
  active
  created_at, updated_at
  -- Changing display_unit never rewrites historical canonical values.

kpi_source_mapping
  id (uuid, pk)
  kpi_key (fk -> kpi_registry.key)
  source                 -- TeamBuildr | PlayerData | Perch
  raw_header
  active
  created_at
  -- Unique on (source, normalized raw_header).

metric_observations
  id (uuid, pk)
  athlete_id (fk -> athletes.id)
  session_id (fk -> sessions.id)
  kpi_key (fk -> kpi_registry.key)
  value_canonical (numeric)
  source_import_id (fk -> imports.id)
  created_at, updated_at
  -- Session-level normalized value only.
  -- Unique on (athlete_id, session_id, kpi_key).

imports
  id (uuid, pk)
  source                 -- TeamBuildr | PlayerData | Perch
  original_filename
  s3_object_key
  file_sha256
  uploaded_by_sub
  uploaded_at
  committed_at (nullable)
  row_count
  inserted_count
  updated_count
  skipped_count
  warning_count
  error_count
  status                 -- uploaded | previewed | committed | failed | rolled_back

import_rows
  id (uuid, pk)
  import_id (fk -> imports.id)
  source_row_number
  raw_data (jsonb)
  normalized_data (jsonb, nullable)
  action                 -- insert | update | skip | error
  before_data (jsonb, nullable)
  after_data (jsonb, nullable)
  warnings (jsonb)
  created_at
  -- Gives row-level traceability for every import.

saved_views
  id (uuid, pk)
  name
  owner_user_sub
  page
  config (jsonb)
  created_at, updated_at

dashboard_layout
  id (uuid, pk)
  owner_scope            -- team_default for v1
  config (jsonb)
  updated_by_sub
  created_at, updated_at

availability_gate
  id (smallint, pk, constrained to one row)
  passcode_hash
  hash_algorithm
  updated_at, updated_by_sub

app_settings
  key (text, pk)
  value (jsonb)
  updated_at, updated_by_sub
  -- Non-secret configuration only, such as active_season_id and visible thresholds.
```

### 3.1 Derived views and calculations

Create SQL views or tested query functions for:

- daily load by athlete and KPI;
- acute 7-day load;
- chronic 28-day weekly-equivalent load;
- ACWR;
- 7-day monotony;
- 7-day strain;
- personal-best top speed and current speed percentage;
- data-completeness status.

Use **Player Load** as the default load KPI for ACWR/monotony/strain unless the coach deliberately selects another compatible load KPI.

Definitions for v1:

- `acute_7d` = sum of the selected load KPI over the current date and previous 6 calendar days.
- `chronic_28d_weekly_equivalent` = sum over the current date and previous 27 calendar days divided by 4.
- `acwr` = `acute_7d / chronic_28d_weekly_equivalent`, only when the chronic value is greater than zero and the data window is complete enough to interpret.
- `monotony_7d` = mean daily load divided by the standard deviation of daily load over the 7-day window, only when the standard deviation is greater than zero.
- `strain_7d` = 7-day total load multiplied by monotony.
- `speed_percent_of_best` = selected-session top speed divided by the athlete's highest valid top speed in the configured comparison window.
- `percent_change` = `(current - baseline) / abs(baseline) * 100`, only when the baseline is non-zero and both values use the same canonical unit.
- A speed flag requires at least three prior valid top-speed observations. Otherwise show “insufficient baseline,” not a flag.

A missing import is not automatically a zero-load day. The session schedule and imported data must distinguish a confirmed rest/no-session day from missing data. If required dates are missing, omit the ratio and show a data-completeness warning.

### 3.2 Constraints and data handling

- Use UUID primary keys for application entities.
- Store timestamps in UTC and display dates/times in `America/New_York`.
- Use database check constraints for valid enums and plausible ranges.
- Use unique constraints as the final duplicate barrier; client-side checks are not enough.
- No calculation may emit infinity, NaN, or a divide-by-zero result.
- Never automatically create an athlete from a fuzzy name match.
- Soft-retire configurable records; do not delete historical data.
- Production backups and point-in-time recovery must be enabled before real data is imported.

## 4. CSV Import Pipeline

This is the highest-risk workflow in the application. The preview can parse client-side for speed, but every validation rule must run again server-side before commit. The browser is never the final authority.

### 4.1 Required source samples

Do not guess TeamBuildr, PlayerData, or Perch headers. Before implementing an adapter, require one representative, redacted CSV export from that platform. Store fixture copies under `tests/fixtures/imports/` with athlete names and identifiers replaced by synthetic values.

The import adapter must document:

- file encoding and delimiter;
- athlete identifier fields;
- session identifier/date/time fields;
- lift/exercise naming;
- whether rows represent a session, exercise, set, or rep;
- the exact aggregation used to create the session-level dashboard value;
- units supplied by the source;
- known empty-value and duplicate behaviors.

### 4.2 Import flow

1. **Select source and upload**
   - Coach selects TeamBuildr, PlayerData, or Perch.
   - Auto-detection may suggest a source but never silently overrides the coach.
   - Enforce an explicit file-size and row-count limit.
   - Calculate a SHA-256 hash.
   - Store the original file in a private, encrypted S3 bucket after the user confirms the upload.
   - Reject an exact previously committed file hash unless the coach explicitly chooses to reprocess it.

2. **Parse**
   - Parse client-side for immediate preview.
   - Normalize headers, dates, decimal formats, whitespace, and units.
   - Preserve the original row number and raw values.

3. **Resolve sessions**
   - Match by source session ID when available.
   - Otherwise use an explicit, reviewable combination of date, time, label, and session type.
   - Multiple sessions on the same day must remain separate.

4. **Resolve athletes**
   - Match stable source IDs first through `athlete_source_identity`.
   - Use normalized exact names second.
   - Use fuzzy matching only to suggest candidates.
   - Every unresolved or fuzzy match requires confirmation before commit.
   - “Create athlete” is a deliberate manual action; it is never automatic.

5. **Map KPIs**
   - Match headers through `kpi_source_mapping`.
   - Unmapped columns can be mapped to an existing KPI or marked Ignore.
   - A new KPI requires its display name, canonical unit, display unit, category, interpretation, aggregation method, and valid range before it can be used.

6. **Aggregate**
   - Convert set/rep-level source rows into the session-level value defined by `kpi_registry.aggregation_method`.
   - Do not invent an aggregation.
   - TeamBuildr and Perch remain independent. Either may produce an observation when the other has no matching value.

7. **Validate**
   - Validate required fields, date formats, units, plausible ranges, athlete/session mapping, and duplicate keys.
   - Run the same validation in the API.
   - Mark each row Insert, Update, Skip, or Error.
   - Errors block commit. Warnings require acknowledgement but may be committed.

8. **Preview**
   - Show a clear table with the source row, resolved athlete, resolved session, KPI, incoming value, canonical value, action, and warning/error.
   - Include filter chips for Errors, Warnings, Updates, Inserts, and Skips.
   - Show summary counts before commit.

9. **Commit**
   - Re-run validation server-side.
   - Commit the `imports`, `import_rows`, session/identity changes, and metric observations in one database transaction.
   - If any required write fails, roll back the entire import.
   - Upserts require an explicit per-import choice: Skip existing or Replace existing.
   - A replacement records both `before_data` and `after_data`.

10. **History and audit**
    - Import History lists the source, filename, uploader, time, hash, counts, and status.
    - Drill-in shows every source row and its exact action.
    - The original CSV can be downloaded only by authenticated staff.
    - Rollback is optional for v1, but the audit data must be sufficient to implement it later without changing the schema.

### 4.3 Import security and data quality rules

- Parameterized SQL only.
- Never place raw CSV content in application logs or error-monitoring payloads.
- Escape spreadsheet-formula prefixes when exporting any audit data back to CSV.
- Do not treat blank, `0`, `N/A`, and missing as equivalent.
- Preserve enough decimal precision to avoid round-trip loss.
- Unit conversion happens during normalization into the canonical unit.
- A partial or bad import must be detectable before commit and fully traceable afterward.

## 5. Information Architecture

**This supersedes any earlier draft of this section — the structure below is taken directly from the coach's own whiteboard layout ("Penn V2 + Additions") and is the authoritative IA.**

Persistent left sidebar (collapsible), top bar with athlete-count badge, current session/date context, an **Import Data** action, and a session/date picker. (No "Send Report" — cut from v1 scope.) Four coach-facing primary sections — **Overview, Monitoring, Data Trends, Performance** — each opening into its own **horizontal sub-tab row** across the top of the content area (same pattern as the reference screenshots' "SESSION OVERVIEW / TEAM COMPARE / ..." row) — plus two admin-only sections underneath, kept visually separate from the four primary ones.

### 5.1 Overview

- **Team Dashboard** — the tile grid:
  - **Availability** — team-wide status at a glance.
  - **Last Session GPS** — key numbers from the most recent session.
  - **Load Health** — ACWR (acute:chronic workload ratio), condensed to one clear status.
  - **S&C % Change** — percent change on a coach-selected S&C variable, over a chosen basis (last session / all-time / custom range).
  - **Athlete Flags** — flags athletes with a notable current value; the flag type named on the whiteboard is **speed flag** (top speed below 90% of personal best), built so additional flag types can be added later without restructuring.
- **Athletes** — a single-day metric overview: pick a date, see every athlete's key metrics for that specific day.

### 5.2 Monitoring

- **Availability** — roster status (Full Go / Limited / Out), filterable by group (position).
- **Readiness** — Team Trend (load trend + ACWR) and Individuals (same lens, per athlete).
- **GPS** — three sub-tabs:
  - **Session Overview** — all major GPS metrics for the selected session, categorized/broken down by athlete.
  - **Session Compare** — multi-session overlay (this is where the earlier draft's "Team Compare" concept lives).
  - **Trends & Recommendations** — long-range trend view (this absorbs the earlier draft's "Load Analysis": 7/14/28/60/90-day ranges, A:C band overlay, monotony/strain) plus rule-based team alerts and session recommendations (e.g. "Acute load is 42% above the 28-day weekly equivalent" with the number, data-completeness status, and a suggested 1–2 session review; recovery-vs-normal-vs-push guidance with a computed target volume band). These are workload observations, not injury predictions. Transparent thresholds shown, never a black-box score.

### 5.3 Data Trends

Its own primary section (not a widget tucked inside Overview) — same underlying concept in both sub-tabs: a trend-analysis view combining a **graph and a table together**, sortable/filterable by **Group** (position) or **Individual** (single athlete). The split is by data source, not by behavior:

- **Performance** sub-tab — trend analysis over S&C metrics (lifts, Perch power) across time, graph + table, Group/Individual toggle.
- **GPS** sub-tab — trend analysis over GPS/load metrics across time, graph + table, Group/Individual toggle.

Both sub-tabs share the same underlying component (metric picker, date range, Group/Individual sort) — only the metric catalog each one pulls from differs (S&C-sourced KPIs vs. GPS/load-sourced KPIs, per `kpi_registry.primary_source` and `category` in §3). Keep it that way rather than building two separate implementations — it's the same interaction pattern applied to two metric sets.

### 5.4 Performance (Strength & Conditioning)

- **Overview** — tiles for all key S&C KPIs.
- **Leaderboards** — full leaderboard for every S&C metric, each entry showing value + change vs. a selectable basis (prior week default; prior session or rolling average as alternatives). No points anywhere.
- **Athlete Profile** — individual overview: a radar chart plus a metric comparison view. Radar spokes use direction-aware percentile rank within the selected season and comparison group, not raw values with incompatible units. Show the raw value and sample size beside every percentile, require at least five valid comparison athletes, and never calculate a combined radar score.

### 5.5 Admin (not on the whiteboard — still required, kept separate from the four sections above)

- **KPI Settings** — manage `kpi_registry`: display name, primary source, display unit, interpretation, aggregation method, valid range, decimal precision, visibility flags, and per-KPI source column mapping (feeds §4). The canonical storage unit is protected from casual UI edits. The same area manages `positions` — rename, add, reorder, or retire groups; retiring one does not delete historical data.
- **Import Data** — upload flow + import history log (§4).
- **Data Management** — controls the _layout_ of the coach-facing frontend, as distinct from KPI Settings (which controls _metric config_, not layout): reorder the four primary sections and their sub-tabs, show/hide optional widgets (e.g. individual tiles on the Overview Team Dashboard), and reorder tiles within a section. Persisted server-side (a `dashboard_layout` config, similar shape to `saved_views` in §3) so the layout choice is the same on every device, not a per-browser setting. Scope this to structural show/hide/reorder only — it is not a page builder; it doesn't let anyone invent new widget types or change what a widget computes, only whether it's shown and where.

### Reconciling this with the earlier draft of this doc

A few things named differently or placed differently in the original spec now live here instead — noted so nothing gets silently lost:

- The earlier standalone **"Roster Breakdown"** page is gone as its own nav item — its speed/A:C flag content now lives in Overview's **Athlete Flags** tile and Monitoring → Readiness → **Individuals**.
- The earlier standalone **"Player Profile"** tab is now **Performance → Athlete Profile** (radar + metric comparison), scoped to S&C — GPS-side individual detail instead lives in Monitoring → GPS → **Session Overview** (per-athlete breakdown) and Overview → **Athletes** (single-day view).
- The earlier standalone **"Rankings / Leaderboards"** page is now **Performance → Leaderboards**, scoped to S&C metrics (matches the whiteboard's placement).
- **"Load Analysis"** is folded into **Monitoring → GPS → Trends & Recommendations** rather than being its own page.
- **Data Trends** started as a tile inside Overview in an earlier pass of this doc — it's since been promoted to its own primary section (§5.3), split into Performance and GPS sub-tabs, each a combined graph+table view sortable by Group or Individual.

---

## 6. Global Rules (non-negotiable, apply everywhere)

1. **Condense meaningful panels** — every dashboard card or persistent analysis panel has a compact state. Do not add a condense control to modal dialogs, form fields, or simple table toolbars merely to satisfy this sentence.
2. **No points or composite score** — raw metrics and clearly named derived calculations only. PlayerData's 1–10 Workload remains a source metric.
3. **Canonical units are immutable** — store values in `canonical_unit`; show them in `display_unit`. Changing a KPI's display unit updates presentation everywhere without rewriting historical records or losing precision.
4. **Savable views** — metric, date-range, group, athlete, comparison-basis, and chart/table settings can be saved and reloaded by name on supported analysis pages.
5. **No broken values** — no infinity, NaN, empty placeholder artifacts, or misleading zero. Omit an unavailable calculation and explain why.
6. **Interpretation-aware behavior** — KPIs may be higher-is-better, lower-is-better, target-range, or neutral. Do not force ACWR, monotony, strain, or workload into a higher/lower-is-better model.
7. **Data completeness is visible** — calculations that depend on rolling windows show whether the underlying dates are complete. Missing data must never silently become zero.
8. **No medical diagnosis or injury prediction** — alerts describe observed workload or performance conditions, such as “load spike” or “below recent speed baseline.” Do not state that an athlete is injured or predict injury from ACWR alone.
9. **Transparent rules** — every flag or recommendation exposes the metric, comparison window, threshold, and calculation used.
10. **Current season context** — every page and saved view is scoped to a selected season, with a clear current-season default.
11. **Minimum necessary athlete data** — do not collect personal fields that are not used by a functional requirement.
12. **Server-authoritative writes** — all permissions, validation, duplicate rules, and calculations that affect stored data are enforced server-side, even when the UI performs the same check for usability.

## 7. Authentication, Authorization, and Security

The production application is a real internet-reachable service and must be secure by design.

### 7.1 Staff authentication

- Use Amazon Cognito through Amplify Auth.
- Start with one staff permission level, but create individual named accounts rather than one shared username.
- Require TOTP MFA for all production staff accounts.
- Use short-lived ID/access tokens and an appropriately limited refresh-token lifetime.
- Implement an application-level inactivity timer that signs the user out after the configured idle period. Token expiration alone is not an idle-timeout feature.
- Sign-out must clear local auth state and revoke the refresh token where supported.
- The AppSync API requires a valid Cognito JWT for every staff query and mutation.
- The frontend login screen is not the security boundary; authorization is enforced at the API and database-access layers.

### 7.2 Availability portal — limited passcode exception

The Availability portal is the only production route that may be used without a full staff Cognito account. It must not expose the dashboard or general athlete data.

Flow:

1. Before passcode verification, show no roster data.
2. Submit the passcode over HTTPS to a dedicated server-side verification endpoint.
3. Verify it against a salted **Argon2id or bcrypt** hash stored in `availability_gate`.
4. Apply API throttling and a short lockout after repeated failures.
5. On success, issue a signed, short-lived token scoped only to `availability:read_minimal` and `availability:write`, expiring in approximately 15 minutes.
6. The token may retrieve only the minimum roster fields needed for entry: athlete ID, display name, position, and current availability status.
7. The token may create or update Availability entries only. It cannot read GPS, strength, profile, import, settings, or historical health-related data.
8. Audit the time, athlete, resulting status, and entry channel. Do not log the passcode.
9. Permit only a short operational note. The UI must state not to enter diagnoses, treatment details, or sensitive medical information.

The passcode is never stored in plaintext. It will necessarily be submitted to the server inside an encrypted HTTPS connection; do not attempt a reusable client-side hash scheme that simply turns the hash into a replayable password. Ensure the value is excluded from logs, analytics, browser persistence, and error reports.

### 7.3 Development and rollout

Use three execution modes but only two AWS data environments:

- **Local development:** synthetic data only. `AUTH_MODE=mock` may auto-sign-in a synthetic staff identity. Mock mode must be impossible in a production build.
- **Dev AWS environment:** synthetic data only, separate Aurora/Cognito/AppSync resources, and real Cognito authentication with test accounts. Do not accept arbitrary credentials on a publicly deployed dev URL.
- **Production AWS environment:** real data only; Cognito and the Availability gate are always enforced.

Use explicit environment validation during build/deploy:

- a production build fails if `AUTH_MODE` is not `cognito`;
- a production build fails if the Availability gate is disabled;
- a production build fails if it points to dev resource identifiers;
- seed commands refuse to run against production.

The login and Availability prompt UIs can be developed with mocks locally, but there is no production or public-dev state where “any input works.”

### 7.4 Secrets, networking, logging, and recovery

- HTTPS only.
- No RDS/Aurora credentials, passcode hashes, IAM keys, or app client secrets in the repository or frontend bundle.
- Public configuration such as Cognito Pool ID, App Client ID, AppSync endpoint, region, and environment name may be delivered to the frontend through generated Amplify configuration.
- Database secrets remain in Secrets Manager and are accessed only by the backend data source.
- Use a least-privileged database role for application access.
- Do not log JWTs, refresh tokens, passcodes, CSV row contents, athlete operational notes, or query results containing athlete data.
- Enable CloudTrail/CloudWatch records for authentication and backend events.
- Enable production backup retention and point-in-time recovery.
- Complete a pre-launch review with the institution's IT/privacy or compliance owner before importing real athlete data.

## 8. Synthetic / Demo Data — Realistic, Coherent, and Reproducible

The dev dataset must resemble a real Division I women's field hockey performance dataset closely enough that charts, flags, calculations, imports, empty states, and edge cases can be evaluated honestly. It must not be a collection of independent random numbers.

The generator should model a plausible team and season, create raw source-style exports for all three systems, and then run those exports through the same import pipeline used by the application. Direct database seeding may be used only for low-level tests. The primary demo dataset should prove the actual import workflow.

All generated athletes, names, IDs, dates, and measurements are fictional. Never derive synthetic records from a real athlete's identifiable data.

### 8.1 Accuracy boundary

Until representative TeamBuildr, PlayerData, and Perch exports are supplied, the generated column names and source-file layouts are **provisional fixtures**, not claims about the exact production exports.

Build the generator in two layers:

1. **Canonical simulation layer** — creates the underlying athletes, sessions, training plan, physiological/performance traits, and true normalized observations.
2. **Source-export adapters** — transform those observations into provisional TeamBuildr, PlayerData, and Perch CSV fixtures, including source-specific names, units, row structures, missing values, and formatting.

When the first redacted real export from each source becomes available, update only the relevant source adapter and calibration configuration. Do not rewrite the whole generator.

### 8.2 Reproducibility and configuration

- Use a deterministic seeded pseudo-random generator.
- Default seed: `20260801`.
- Store generator settings in a versioned file such as `seed/config.v1.ts`.
- The same seed and configuration must always produce the same athletes and records.
- Support alternate seeds for UI stress testing.
- Store a `generator_version` with each generated dataset.
- Provide one command such as:

```bash
npm run seed:generate -- --season=2026 --seed=20260801
```

- Provide a separate destructive command for resetting the dev database.
- Both commands must refuse to run when `APP_ENV=production`.

### 8.3 Team composition

Generate exactly 25 athletes:

| Position   | Count | Typical roster role                                  |
| ---------- | ----: | ---------------------------------------------------- |
| Goalkeeper |     3 | 1 primary starter, 1 regular backup, 1 developmental |
| Defender   |     7 | mixture of high-minute starters and rotation players |
| Midfielder |     8 | generally highest running-volume group               |
| Forward    |     7 | generally highest sprint-frequency group             |

Each athlete receives stable latent traits that influence every later record:

- body mass;
- height;
- training age;
- strength potential;
- lower-body power;
- maximal running speed;
- aerobic/work-capacity factor;
- acceleration factor;
- fatigue sensitivity;
- session-to-session variability;
- attendance reliability;
- expected playing-time role;
- position;
- starter/rotation/developmental role.

Do not expose these hidden traits in the UI. They exist only so one athlete's data behaves like one coherent person across the season.

Suggested fictional roster ranges:

| Variable                      | Outfield players |   Goalkeepers |
| ----------------------------- | ---------------: | ------------: |
| Height                        |         61–72 in |      64–73 in |
| Body mass                     |       120–185 lb |    135–195 lb |
| Years on team                 |              1–4 |           1–4 |
| Training age                  |           1–6 yr |        1–6 yr |
| Individual top-speed capacity |    15.0–20.0 mph | 12.0–16.5 mph |

Use truncated distributions rather than uniform distributions, so most athletes fall near the middle and only a few sit at either extreme. Height, mass, speed, strength, and power should be moderately related rather than independent.

Do not store date of birth. Generate a class year or years-on-team value only.

### 8.4 Season and session calendar

Generate one 17-week season:

- 4 preseason weeks;
- 13 in-season weeks;
- daily calendar coverage;
- separate morning and afternoon sessions where appropriate;
- multiple sessions allowed on the same date.

#### Preseason pattern

A normal preseason week should contain approximately:

- 5–6 field sessions;
- 3 lift sessions;
- 0–1 scrimmage;
- 1 lower-load or recovery day;
- 1 full rest day.

The first three preseason weeks should progressively increase total field load. The final preseason week should remain demanding but include enough reduction before the opening match that the season does not begin at an artificial load peak.

#### In-season pattern

A common in-season week should contain:

- 1–2 games;
- 2 lift sessions;
- 2–4 field practices;
- at least 1 recovery or off day.

Create several believable week types:

- one-game week;
- two-game Friday/Sunday week;
- travel week;
- lighter academic/recovery week;
- one overtime game;
- one weather-shortened practice;
- one session canceled or rescheduled;
- one deload/taper week late in the season.

Do not make every week identical. Preserve a recognizable weekly rhythm:

- post-game recovery;
- early-week development;
- midweek moderate/high practice;
- reduced volume before competition;
- game-day spike based on actual minutes played.

### 8.5 Participation and playing time

Generate athlete participation before generating GPS values.

For each session, assign:

- invited;
- attended;
- full participation;
- modified participation;
- did not participate;
- minutes played or exposure duration.

Playing time must reflect roster role and position:

- regular starters receive the most game minutes;
- rotation athletes vary substantially;
- developmental athletes have occasional low-minute or zero-minute games;
- one goalkeeper plays most games, a second appears occasionally, and the third rarely plays;
- no outfield athlete plays an impossible number of minutes;
- overtime increases only the minutes and load of athletes who actually participated.

GPS load must scale primarily from exposure duration, then from session type, position, and athlete traits. Never generate high game distance for an athlete who recorded zero minutes.

### 8.6 Availability data

Generate daily Availability entries separately from workload.

Expected team pattern:

- most athletes are `full_go` on most days;
- usually 0–3 athletes are `limited`;
- usually 0–2 athletes are `out`;
- occasional short clusters last 2–7 days;
- a small number of longer restrictions may last 1–3 weeks;
- status changes affect participation and workload, but are not perfectly deterministic.

Use operational notes only, such as:

- `Modified field volume`
- `Non-contact work`
- `Lift only`
- `Individual conditioning`
- `Unavailable today`
- `Return-to-full progression`

Do not generate diagnoses, body-part details, treatment information, or claims about injury risk.

### 8.7 GPS and load simulation

Generate PlayerData observations from shared session and athlete factors so all metrics move together logically.

#### Core generation model

For athlete `a` in session `s`, derive a session-load multiplier from:

- session type and planned intensity;
- exposure duration;
- position;
- athlete work-capacity and speed traits;
- participation restriction;
- accumulated recent load/fatigue;
- small individual noise;
- device noise.

Metrics must be correlated:

- total distance rises with exposure duration;
- high-speed distance is a subset of total distance;
- sprints rise with high-speed distance;
- top speed is constrained by the athlete's stable capacity;
- accelerations and decelerations tend to rise together;
- Player Load rises with duration, distance, and changes of direction;
- the 1–10 Workload value is related to session demand but includes modest independent variation.

#### Provisional plausible session ranges

These are simulation bounds, not clinical thresholds. Values outside the “typical” column may occur occasionally but must remain inside the hard bound.

##### Outfield athletes

| Metric              | Recovery / short practice | Normal practice | High practice / scrimmage |                      Game | Hard bound |
| ------------------- | ------------------------: | --------------: | ------------------------: | ------------------------: | ---------: |
| Total distance      |              800–2,800 yd |  2,500–5,500 yd |            4,000–7,500 yd | 2,000–7,500 yd by minutes | 0–9,000 yd |
| High-speed distance |                  0–180 yd |      100–550 yd |                250–900 yd |   100–1,000 yd by minutes | 0–1,300 yd |
| Player Load         |                 50–220 AU |      180–480 AU |                350–700 AU |     180–700 AU by minutes |   0–850 AU |
| Top speed           |             10.0–16.0 mph |   13.0–18.5 mph |             14.0–19.5 mph |             13.0–20.0 mph | 0–21.0 mph |
| Sprints             |                       0–5 |            2–14 |                      8–24 |           2–25 by minutes |       0–35 |
| Accelerations       |                      3–25 |           15–50 |                     30–75 |          10–75 by minutes |       0–90 |
| Decelerations       |                      3–25 |           15–55 |                     30–80 |          10–80 by minutes |       0–95 |
| Workload            |                       1–4 |             3–7 |                       6–9 |           4–10 by minutes |       1–10 |

##### Goalkeepers

| Metric              |     Practice |         Game | Hard bound |
| ------------------- | -----------: | -----------: | ---------: |
| Total distance      | 300–1,800 yd | 150–1,200 yd | 0–2,500 yd |
| High-speed distance |      0–80 yd |      0–60 yd |   0–150 yd |
| Player Load         |    40–260 AU |    30–220 AU |   0–350 AU |
| Top speed           | 8.0–15.0 mph | 8.0–15.5 mph | 0–17.0 mph |
| Sprints             |          0–5 |          0–4 |        0–8 |
| Accelerations       |         5–35 |         3–30 |       0–50 |
| Decelerations       |         5–35 |         3–30 |       0–50 |
| Workload            |          1–7 |          1–7 |       1–10 |

#### Position behavior

Use modest position effects, not caricatures:

- midfielders: highest average total distance and repeated acceleration volume;
- forwards: higher sprint frequency and high-speed-distance rate;
- defenders: moderate distance, moderate sprinting, frequent acceleration/deceleration;
- goalkeepers: much lower locomotor distance but non-zero Player Load and movement events.

Individual role and minutes must explain more variation than position alone.

#### Top-speed behavior

Each outfield athlete has a stable latent top-speed capacity.

- In a normal valid session, observed top speed usually falls between 85% and 99% of capacity.
- True personal-best efforts occur infrequently.
- Recovery sessions commonly fail to expose maximal speed and should not be interpreted as deterioration.
- Add occasional low readings from short exposure or device noise.
- A speed flag should appear only when the comparison session is intended to expose speed and the athlete has a sufficient baseline.
- Avoid a dataset in which every athlete sets a new personal best every week.

#### Logical GPS constraints

Every generated row must satisfy:

- `high_speed_distance_yd <= distance_yd`;
- no negative values;
- workload is an integer from 1 to 10;
- top speed is zero/null only when the device has no valid speed reading;
- zero minutes produces no normal GPS row unless the source explicitly reports a zero-exposure record;
- sprints, accelerations, and decelerations are whole numbers;
- a modified participant generally has lower exposure than a full participant in the same session;
- game load is strongly related to minutes played.

### 8.8 Strength and TeamBuildr simulation

Model strength from athlete-level estimated capacities and a realistic training plan. TeamBuildr values represent the **top prescribed/completed working load for that lift session**, not a true one-repetition maximum unless the source fixture explicitly labels a test.

Create latent preseason estimated 1RM values within broad fictional ranges:

| Exercise          | Typical estimated 1RM | Hard fictional bound |
| ----------------- | --------------------: | -------------------: |
| Back Squat        |            145–245 lb |            95–300 lb |
| Bench Press       |             75–135 lb |            45–175 lb |
| Trap Bar Deadlift |            185–335 lb |           125–405 lb |
| Power Clean       |             75–145 lb |            45–185 lb |

Generate programmed working loads from planned intensity and repetitions:

- higher-repetition sessions use lower percentages;
- strength sessions use higher percentages;
- power sessions use moderate loads moved faster;
- round loads to realistic plate increments, normally 5 lb;
- use the same athlete's strength trait across all lifts;
- stronger athletes tend to be stronger in multiple lifts, but not identically ranked in every exercise;
- power-clean ability should relate more strongly to the power trait than bench press does.

Seasonal behavior:

- modest improvement through preseason, generally about 1–6% depending on training age and attendance;
- maintenance or small fluctuations during the competitive season;
- occasional reduced loads during congested game weeks;
- no perfectly linear weekly increase;
- no unexplained 20–30% jump;
- missed or modified lifts create absent or reduced records rather than fake normal values.

Include normal logging variation:

- a small number of sessions with no completed value;
- a corrected value in one import;
- athlete name or exercise aliases that the mapping system must resolve;
- one duplicate row that preview identifies before commit.

### 8.9 Perch power simulation

Perch remains independent from TeamBuildr. A TeamBuildr session may exist without Perch data, and a Perch observation may exist even when the corresponding load entry is absent.

Generate session-level power observations:

| Exercise / metric                       | Typical fictional range | Hard fictional bound |
| --------------------------------------- | ----------------------: | -------------------: |
| Back Squat mean concentric power        |               300–850 W |          150–1,100 W |
| Bench Press mean concentric power       |               140–420 W |             75–600 W |
| Trap Bar Deadlift mean concentric power |             450–1,200 W |          250–1,600 W |
| Power Clean peak power                  |             650–1,650 W |          350–2,100 W |

Power should depend on:

- athlete strength and power traits;
- body mass;
- exercise;
- relative working load;
- fatigue/readiness;
- technical consistency;
- small measurement noise.

Expected relationships:

- athletes with high lower-body power generally rank well in trap-bar and clean power;
- power usually falls slightly in highly fatigued or congested weeks;
- preseason technique adaptation may improve power modestly;
- heavier load does not automatically mean higher mean velocity or power;
- values should vary within an athlete, but not jump randomly between implausible extremes.

Create realistic source incompleteness:

- approximately 8–15% of eligible lift sessions have no Perch reading;
- occasional Perch-only records;
- a small number of invalid/blank readings;
- one unit/header mapping issue in a test fixture;
- no silent replacement of TeamBuildr load data.

### 8.10 Rolling-load behavior

The generated calendar should naturally produce useful ACWR, monotony, and strain examples rather than hardcoding final ratio values.

Target dataset behavior:

- the first 28 days show “insufficient chronic history” where appropriate;
- most mature-season ACWR observations fall approximately between 0.80 and 1.30;
- occasional legitimate spikes reach approximately 1.31–1.55;
- a very small number may exceed 1.55 due to return from low exposure, schedule congestion, or missing-data scenarios;
- some low-load periods fall below 0.80;
- missing-data windows are labeled incomplete rather than calculated as zero;
- monotony rises during repetitive congested weeks and falls when session loads vary;
- strain reflects both total weekly load and monotony.

Do not reverse-engineer daily values solely to force a desired ratio. Generate the calendar and athlete exposures first, calculate the rolling metrics second, then run a quality check. Regenerate only when the whole dataset is clearly unrealistic.

### 8.11 Missingness and data-quality scenarios

A realistic dev dataset must include clean records and controlled imperfections.

Approximate targets across the full synthetic season:

| Scenario                               |                                     Target frequency |
| -------------------------------------- | ---------------------------------------------------: |
| Valid expected rows                    |                                               90–96% |
| GPS device missing/failed              |                       2–4% of expected GPS exposures |
| Athlete absent or did not participate  |                  determined by schedule/availability |
| Perch missing despite an eligible lift |                                                8–15% |
| TeamBuildr completed value missing     |                         2–5% of expected lift values |
| Exact duplicate row in fixture         |                                 1–3 deliberate cases |
| Fuzzy athlete-name candidate           |                                 2–4 deliberate cases |
| Unmapped source header                 |                  at least 1 per source fixture suite |
| Corrected/replacement value            |                                 2–4 deliberate cases |
| Multiple sessions on the same date     | common throughout preseason and occasional in-season |
| Missing-data rolling window            |                          at least 3 athlete examples |

Deliberate import problems belong in separate named fixture files, not mixed invisibly into the main “clean realistic season” export.

Recommended fixture set:

```text
tests/fixtures/imports/
  teambuildr_clean_preseason.csv
  teambuildr_duplicate_and_alias.csv
  playerdata_clean_game_week.csv
  playerdata_missing_device_rows.csv
  perch_clean_power.csv
  perch_unmapped_header_and_blank.csv
  cross_source_same_session.csv
```

### 8.12 Correlation and realism checks

After generation, automatically calculate and print a synthetic-data quality report.

The report must confirm:

- total distance has a strong positive relationship with exposure duration;
- game distance and Player Load vary with minutes played;
- high-speed distance never exceeds total distance;
- sprints positively relate to high-speed distance;
- top speed is substantially more stable within an athlete than between athletes;
- strength values are stable and progress gradually;
- Perch power is positively related to athlete power/strength traits but retains realistic noise;
- midfielders have the highest team-average distance without every midfielder outranking every other position;
- forwards have a higher sprint rate on average without impossible separation;
- goalkeepers form a clearly different GPS distribution;
- modified participation reduces expected exposure;
- `limited` or `out` status is reflected in participation often enough to appear coherent;
- missingness is not concentrated entirely in one athlete or week unless a deliberate device scenario says so;
- no metric contains negative, infinite, or NaN values;
- every hard bound and database constraint passes;
- the active roster remains exactly 25 athletes.

Include summary distributions by:

- position;
- session type;
- preseason versus in-season;
- starter/rotation/developmental role;
- athlete;
- source.

The generator should fail loudly when a hard invariant is violated.

### 8.13 Visual scenarios the dataset must produce

The default seed must create enough variation to visibly test:

- one athlete with a legitimate speed flag;
- one athlete with insufficient speed baseline;
- one athlete returning from several low-exposure days;
- one congested two-game week;
- one incomplete rolling-load window;
- one athlete showing modest preseason strength improvement;
- one athlete plateauing;
- one athlete with reduced in-season lift loads;
- one TeamBuildr session with no Perch value;
- one Perch value with no TeamBuildr load;
- one goalkeeper profile;
- one high-minute midfielder profile;
- one low-minute developmental player profile;
- one import with warnings but no blocking errors;
- one import with a blocking error;
- one session with every athlete present;
- one session with mixed Full Go, Limited, Out, and no-device outcomes.

These scenarios must emerge from named simulation events and traits, not from manually editing final database rows after generation.

### 8.14 Calibration after real exports arrive

Once approved real exports are available, add a calibration script that reads **de-identified aggregate summaries**, not athlete names, and reports:

- source headers and data types;
- rows per session and per athlete;
- metric percentiles;
- zero, blank, and missing-value rates;
- session-type distributions;
- position-group distributions;
- within-athlete variability;
- cross-metric correlations;
- common naming aliases;
- common duplicate patterns.

Update the synthetic configuration to resemble those aggregate distributions while preserving fully fictional identities and values. Keep the original provisional configuration versioned so changes are reviewable.

The goal is not to clone a real athlete. The goal is to reproduce the structure, scale, relationships, noise, and operational messiness of the real system closely enough that the dashboard behaves honestly before production data is connected.

## 9. Testing

### 9.1 Unit and calculation tests

- CSV header normalization, mapping, unit conversion, valid-range checks, identity resolution, and aggregation.
- ACWR, monotony, strain, speed-percentage, and percent-change calculations against hand-calculated fixtures.
- Missing-data behavior, including no-session days, missing imports, zero chronic load, and zero standard deviation.
- Display-unit conversion round trips with no material precision loss.
- Interpretation behavior for higher, lower, target-range, and neutral KPIs.

### 9.2 Database and import integration tests

- Apply migrations to an empty database and to the previous released schema.
- Unique constraints prevent duplicate observations under concurrent requests.
- Import commit is atomic: a forced error leaves no partial records.
- Replace-existing captures before/after audit values.
- Reprocessing an identical file hash is detected.
- Fuzzy matches cannot auto-create an athlete.
- TeamBuildr and Perch observations can exist independently for the same session.

### 9.3 Authorization tests

- Anonymous requests cannot access the staff API.
- A valid staff JWT can access permitted staff operations.
- An Availability token cannot call any staff query or mutation.
- Failed passcode attempts are throttled.
- Production configuration cannot enable mock auth or seed data.
- The default synthetic seed is deterministic and passes all hard invariants in §8.
- Synthetic quality-report distributions and correlations remain within configured acceptance bands.
- Seed and reset commands refuse to run against production.
- Application code cannot connect with the database master user.

### 9.4 End-to-end smoke tests

Before every production deploy:

1. Sign in with MFA in the staging/dev environment.
2. Load Overview.
3. Open a Data Trends view with one group and one athlete.
4. Run a complete synthetic CSV preview and commit.
5. Confirm Import History drill-in.
6. Enter one Availability update through the limited portal.
7. Confirm mobile single-column layout.
8. Confirm no console error, NaN, infinity, or unauthorized network response.

## 10. Build Order

0. **Repository and architecture spike**
   - Initialize git, TypeScript strict mode, linting, formatting, test runner, migration tooling, and ADR folder.
   - Complete and approve the §2.1 backend vertical slice before full-page work.

1. **Infrastructure and schema**
   - Provision dev Aurora PostgreSQL Serverless v2, Data API, Cognito, AppSync, S3 import bucket, logging, and secrets.
   - Apply the complete initial schema through versioned migrations.
   - Create least-privileged database roles and authorization tests.

2. **Synthetic data and calculation layer**
   - Build the dev-only generator.
   - Implement sessions, observations, derived views/functions, and hand-checked calculation tests.
   - Add visible data-completeness handling.

3. **Design system and app shell**
   - Implement tokens, responsive shell, navigation, authentication UI, season/session selectors, loading, empty, error, and compact states.
   - Do not create page-specific one-off colors or spacing.

4. **Import foundation**
   - Obtain one redacted fixture from TeamBuildr, PlayerData, and Perch.
   - Implement source adapters, identity/session resolution, preview, server-side validation, atomic commit, S3 storage, and Import History.
   - Finish this before relying on manually seeded production-shaped data.

5. **Coach-facing modules**
   - Overview.
   - Monitoring.
   - Data Trends.
   - Performance.
   - Reuse shared graph/table/filter components where the interaction is genuinely the same.

6. **Administration**
   - KPI Settings.
   - Positions.
   - Data Management.
   - Saved views.
   - Availability gate administration.

7. **Hardening and launch**
   - Complete §9 tests.
   - Create production resources from the same infrastructure definitions and migrations.
   - Verify backups, budgets, alarms, MFA, auth scopes, and environment guards.
   - Complete institutional IT/privacy review.
   - Import real data only after production sign-off.

## Open Decisions and Required Inputs

The primary architecture is resolved in §2. The following are implementation inputs, not invitations for an agent to guess:

- One representative redacted TeamBuildr CSV.
- One representative redacted PlayerData CSV.
- One representative redacted Perch CSV.
- The program's actual brand color and logo asset.
- Coach-approved display thresholds and wording for load flags/recommendations.
- The desired personal-best window for the speed flag, with a recommended v1 default of the active season plus the immediately previous season.
- The institution owner who will approve storage and access to real athlete data.

Until the three sample exports are provided, build only the import framework and synthetic fixtures. Do not invent production column names or aggregation rules.

**Resolved:**

- Position groups are editable records, not a hardcoded enum.
- “Send Report” is out of v1 scope.
- Hosting is AWS Amplify.
- Authentication is Cognito with individual staff accounts and required TOTP MFA in production.
- The primary relational backend is Aurora PostgreSQL Serverless v2 with the RDS Data API and AppSync.
- The Availability portal is a narrowly scoped passcode exception, not an alternate route into the dashboard.
- Development uses synthetic data only; production contains only approved real imports.

## 11. Hosting Target — AWS Amplify

Deploy the React frontend through AWS Amplify Hosting from the git repository. Use the same infrastructure code and migrations for both AWS environments.

### 11.1 Branch and environment model

- `dev` branch → dev Amplify environment, dev Cognito, dev AppSync, dev Aurora, dev S3, synthetic data only.
- `main` branch → production Amplify environment, production Cognito, production AppSync, production Aurora, production S3, real approved data only.
- Pull requests may use frontend-only previews with mocked/synthetic data, but must never receive production credentials or data.

Each deployment receives generated/public frontend configuration for its own Cognito and AppSync resources. The production build includes hard checks that reject dev identifiers and mock authentication.

### 11.2 Deployment behavior

- Build on every push.
- Run type-check, unit tests, migration validation, and the production configuration guard before deploy.
- Apply production migrations as an explicit controlled step; do not let a frontend build silently improvise schema changes.
- Serve HTTPS only.
- Add a custom domain only when needed.
- Keep the application private through authentication and authorization, not through an obscure URL.

### 11.3 Operations

- Create AWS Budget alerts from a real pricing estimate.
- Configure CloudWatch alarms for repeated API errors, failed imports, and authentication anomalies.
- Enable production backups and point-in-time recovery.
- Define a simple restore test and perform it before launch.
- Define a retention period for original CSV files and import audit rows based on institutional policy.
- Document account ownership, billing contact, recovery contact, and who can create staff users.

## 12. Design System (cosmetic spec — implement as tokens, not ad hoc styling)

Build every value below as CSS custom properties / a Tailwind theme config at project start (a single `tokens` file), not hardcoded per-component. The Penn brand palette is defined once here so no component contains one-off brand colors.

### 12.1 Overall direction

Dark-mode-first, data-dense, flat UI (minimal shadows, no skeuomorphism) — same visual family as the reference screenshots, tuned for long monitoring sessions (low glare, high contrast on the numbers that matter, everything else recedes). Architect the tokens so a light mode _could_ be added later (i.e., don't hardcode `#000`/`#fff` inline anywhere — always reference a token), but only ship dark mode for v1.

### 12.2 Penn Athletics color palette

Use the official Penn Athletics colors from the supplied mini style guide as the brand foundation:

| Color        |                 Digital value | Print reference                | Primary dashboard use                                          |
| ------------ | ----------------------------: | ------------------------------ | -------------------------------------------------------------- |
| Penn Crimson |     `#980000` / RGB 152, 0, 0 | PMS 201; CMYK 24, 100, 100, 25 | Primary actions, selected tabs, active indicators, focus rings |
| Penn Navy    |     `#011F5B` / RGB 1, 31, 91 | PMS 289; CMYK 100, 93, 32, 32  | Sidebar branding, navigation emphasis, branded headers         |
| Penn Silver  | `#8A8D8F` / RGB 138, 141, 143 | PMS 877; CMYK 36, 28, 27, 0    | Secondary brand detail, dividers, neutral branded accents      |
| White        |                     `#FFFFFF` | —                              | Logo treatment and text placed on Penn Crimson or Penn Navy    |

The Nike uniform references in the style guide — Crimson (Nike 613), Scarlet (Nike 658), and Navy (Nike 420) — are apparel references. Do not invent digital hex values for them. The dashboard should use the Penn-specific RGB/PMS colors above.

```css
/* Penn Athletics master brand colors */
--penn-crimson: #980000;
--penn-navy: #011f5b;
--penn-silver: #8a8d8f;
--penn-white: #ffffff;

/* Dark application surfaces */
--bg-base: #0b0d10;
--bg-surface: #14171c;
--bg-surface-2: #1b1f26;
--border-subtle: #262b33;
--border-strong: #3b424d;

/* Text */
--text-primary: #f5f6f7;
--text-secondary: #a7adb8;
--text-muted: #808896;
--text-on-brand: #ffffff;

/* Brand interaction tokens */
--accent: var(--penn-crimson);
--accent-hover: #b82020; /* UI-derived tint, not a new master brand color */
--accent-active: #750000; /* UI-derived shade */
--accent-contrast: #ffffff;
--brand-nav: var(--penn-navy);
--brand-neutral: var(--penn-silver);
--focus-ring: #e05252; /* lighter crimson for visibility on dark surfaces */

/* Semantic status colors remain separate from brand colors */
--status-good: #34d399;
--status-warning: #fbbf24;
--status-danger: #ef4444;
--status-neutral: #808896;

/* Dark-background chart palette.
   Series 1–3 are Penn-derived; 4–6 extend the palette for clear differentiation. */
--chart-series-1: #e05252; /* Penn Crimson tint */
--chart-series-2: #6688d4; /* Penn Navy tint */
--chart-series-3: #b8bcc0; /* Penn Silver tint */
--chart-series-4: #f3c969;
--chart-series-5: #50c2b0;
--chart-series-6: #b78ae6;
```

#### Brand application rules

- Use **Penn Crimson** for the primary button, active tab underline, selected filter, key call-to-action, and small active-state accents.
- Use **Penn Navy** for the sidebar brand block, top-level navigation emphasis, branded modal/header areas, and selected navigation backgrounds.
- Use **Penn Silver** sparingly for secondary brand details. Standard body copy should continue using the dedicated text tokens.
- Use the full-color Penn shield or split-P logo only on approved clear backgrounds. Provide the black-and-white mark where contrast or reproduction requires it.
- Do not turn every card red or navy. The interface remains primarily dark and neutral so the data stays dominant.
- Do not use Penn Crimson as the semantic “danger” color merely because it is red. `--status-danger` remains a separate token and must always be paired with text or an icon.
- Never communicate meaning through color alone. Statuses require a label, icon, pattern, or signed value in addition to color.
- Assign each KPI to a chart-series token through one central registry so that the same KPI keeps the same color throughout the application.
- Verify every final text/background and essential graphical-object pairing against WCAG AA. Official colors may be used as backgrounds with white text; lighter derived chart/focus colors are used where the original navy or crimson would be too dark against the dashboard surfaces.

### 12.3 Typography

- Font: **Inter** (or system-ui stack as fallback: `-apple-system, "Segoe UI", Roboto, sans-serif`) — clean, tabular-friendly, free.
- All numeric KPI values use `font-variant-numeric: tabular-nums` so columns of numbers align vertically — this matters a lot in leaderboards/tables.
- Scale (px, with use-case):
  - 12 — tiny labels, table headers, chip text
  - 14 — body text, table cell values, form inputs (this is the floor — nothing smaller anywhere)
  - 16 — section sub-headers, card titles
  - 20 — card/widget headers
  - 24 — page titles
  - 32–40 — the "big number" on a KPI tile (e.g. the "47.2" player-load number) — bold weight, tabular-nums
- Weights: 400 body, 500 emphasis/labels, 600–700 headings and big KPI numbers. Avoid anything below 400 (thin weights hurt readability at small sizes on dark backgrounds).
- Line-height: 1.4 for body/paragraph text, 1.2 for headings and single-line numeric displays.

### 12.4 Spacing & layout

- Base unit **4px**; scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 — every margin/padding/gap value in the app should be one of these, no arbitrary values.
- Card padding: 20px. Gap between cards in a grid: 16–20px. Gap between major page sections: 32px.
- Sidebar: 240px wide expanded, 64px collapsed (icon-only, per §5). Top bar: 64px tall, fixed.
- Card corner radius: 10px. Chips/pills/badges: fully rounded (999px). Buttons/inputs: 8px.
- Borders: 1px, `--border-subtle` by default, `--border-strong` on hover/focus/active states. Shadows kept minimal — `0 1px 2px rgba(0,0,0,0.4)` only on floating elements (dropdowns, modals, tooltips); flat cards get a border, not a shadow.
- Responsive breakpoints: **<768px** — sidebar becomes an off-canvas drawer, all grids collapse to a single column. **768–1199px** — 2-column card grids. **≥1200px** — full multi-column layout as designed.

### 12.5 Components

- **Buttons:** 36px height, 8px radius, 14px medium-weight text. Primary = `--accent` background; Secondary = outline only (`--border-strong`, transparent background); Ghost = text-only, no border, background appears only on hover (`--bg-surface-2`).
- **Inputs/selects/date pickers:** `--bg-surface-2` background, `--border-subtle` border, `--accent` border on focus with a visible 2px focus ring (accessibility — see 12.6).
- **Chips/tags** (KPI category, position filter, flag labels): 12px text, background = the relevant semantic/category color at ~15% opacity, text/border at full opacity of that same color — keeps them readable without being visually loud.
- **Tables:** 40px row height minimum (comfortable click/read target), sticky header row, sticky first column (name) on horizontal scroll — already validated in V1, carry it forward. No zebra striping (flat dark rows); use a 1px `--border-subtle` divider between rows and a `--bg-surface-2` hover highlight instead.
- **Condensed widget state:** collapses to a single ~48px row — icon + title + the one most important number — never fully hidden. Expand/collapse transitions at 200ms ease-out.
- **Charts:** gridlines at ~8–10% white opacity (barely-there, not competing with data). Tooltips styled like a small card (`--bg-surface`, `--border-subtle`, 8px radius). Series colors always pulled from the fixed `--chart-series-*` palette in a consistent per-KPI order (12.2).
- **Flags/alerts** (Athlete Flags, Readiness/A:C flags, Trends & Recommendations alerts): a colored left-border accent (4px, semantic color) on an otherwise `--bg-surface` card, icon + headline + the specific number, never just a bare colored dot.
- **Empty states:** icon + one-line message + a clear next action (e.g. "No sessions in this range — try Import Data" as a button), never a blank card.
- **Loading states:** skeleton placeholders shaped like the eventual content (card outlines, table row bars), not spinners — spinners read as "broken" on a data-dense dashboard that's supposed to feel instant.

### 12.6 Accessibility

- WCAG AA contrast minimum everywhere (12.2).
- Visible focus ring (2px, `--accent`, offset 2px) on every interactive element — required for keyboard navigation, not just a nice-to-have.
- Minimum interactive target size 40×40px for any icon-only button.
- Respect `prefers-reduced-motion`: disable non-essential transitions (condense/expand can keep a fast fade instead of a slide) when set.

### 12.7 Motion

- 120–150ms ease for hover/small state changes (button hover, row highlight).
- 200–250ms ease-out for panel/widget expand-collapse and page-section transitions.
- No motion on data updates themselves (a refreshed number should just update, not animate/count up) — keeps the dashboard feeling immediate rather than gimmicky.

### 12.8 Iconography

- **Lucide** icon set (already used elsewhere in this toolchain, MIT-licensed, consistent stroke style).
- 16px inline with text, 20px standalone in buttons/nav, stroke-width 1.75–2.
- Icons always paired with a text label in navigation (never icon-only nav items, for both accessibility and because a new user won't know what an unlabeled icon means).

### 12.9 Branding note

The Penn Athletics palette is now locked for v1: Penn Crimson `#980000`, Penn Navy `#011F5B`, and Penn Silver `#8A8D8F`. Place the approved Penn Athletics logo asset in the sidebar header and login screen, using the full-color or black-and-white treatment appropriate to the background. Do not redraw, recolor, stretch, crop, or recreate the mark from text.

All brand and UI colors must come from the central token file. A future rebrand should require token and asset replacement, not component-by-component edits.

---

## Environments — Confirmed

There are **two separate AWS environments** and one local execution mode:

### Local

- Synthetic data only.
- Mock authentication may be used.
- No AWS production resources or real exports.
- Safe to wipe at any time.

### Dev/testing AWS

- Separate Aurora cluster, Cognito User Pool, AppSync API, S3 bucket, and Amplify environment.
- Synthetic or redacted test data only.
- Real Cognito test accounts and real authorization behavior.
- Safe to wipe and reseed.

### Production AWS

- Separate Aurora cluster, Cognito User Pool, AppSync API, S3 bucket, and Amplify environment.
- Empty at creation.
- Populated only by approved real imports.
- Seed commands and mock authentication are blocked.
- Backups, alarms, budgets, MFA, and the Availability gate are enabled before data import.

Practical rules:

- Schema and infrastructure definitions are written once and deployed to dev and production.
- Resource names and configuration are environment-specific.
- Production data and secrets are never copied to local or dev.
- A deployment must clearly display its environment.
- Any destructive admin action requires an explicit environment confirmation in production.

## 13. Functional Requirements — Build Against This Checklist

### Platform and data

- [ ] Staff can sign in with an individual Cognito account and required MFA in production.
- [ ] Staff pages reject unauthenticated API requests.
- [ ] The app supports an active-season context and multiple sessions on the same date.
- [ ] Coach can upload TeamBuildr, PlayerData, or Perch CSV files, preview mapped/normalized rows, resolve athletes and sessions, acknowledge warnings, and atomically commit.
- [ ] Exact duplicate files are detected by hash.
- [ ] Athlete source identities are remembered for future imports.
- [ ] A fuzzy athlete match can never create or commit an athlete without confirmation.
- [ ] Import History shows every row's Insert/Update/Skip/Error result and before/after values for replacements.
- [ ] Original import files are stored privately and available only to authenticated staff.
- [ ] The deterministic synthetic generator creates canonical data plus source-style TeamBuildr, PlayerData, and Perch fixtures.
- [ ] The default demo season is loaded through the same preview/validation/commit pipeline used for real imports.
- [ ] A generated quality report verifies the realism and invariants defined in §8.

### Overview

- [ ] **Team Dashboard:** Availability, Last Session GPS, Load Health, S&C % Change, and Athlete Flags.
- [ ] Each persistent dashboard tile has a meaningful compact state.
- [ ] **Athletes:** select a date/session and see every athlete's key metrics.
- [ ] Missing or incomplete source data is visibly distinguished from zero.

### Monitoring

- [ ] **Availability:** Full Go/Limited/Out, filterable by position.
- [ ] **Readiness:** Team Trend and Individuals.
- [ ] **GPS → Session Overview:** major GPS metrics for one selected session.
- [ ] **GPS → Session Compare:** overlay two or more sessions.
- [ ] **GPS → Trends & Recommendations:** 7/14/28/60/90-day ranges, ACWR, monotony, strain, data completeness, transparent load flags, and operational recommendations.
- [ ] Alerts use observation language such as “load spike” and do not claim to diagnose or predict injury.

### Data Trends

- [ ] **Performance:** graph + table for S&C metrics, Group or Individual.
- [ ] **GPS:** graph + table for GPS/load metrics, Group or Individual.
- [ ] The two tabs share the same interaction component and differ only by KPI catalog.
- [ ] Views can be saved and restored server-side.

### Performance

- [ ] **Overview:** tiles for all selected key S&C KPIs.
- [ ] **Leaderboards:** any eligible S&C metric with prior-week, prior-session, or rolling-average comparison.
- [ ] **Athlete Profile:** direction-aware percentile radar chart from eligible KPIs plus raw-value metric comparison, with no combined score and no percentile when fewer than five valid comparison athletes exist.
- [ ] KPI interpretation supports higher, lower, target-range, and neutral behavior.

### Administration

- [ ] Coach can edit KPI display name, source, display unit, interpretation, aggregation, valid range, visibility flags, decimal precision, and source mappings.
- [ ] Canonical units cannot be casually changed through the UI.
- [ ] Changing display unit updates every display without rewriting stored values.
- [ ] Coach can manage positions without deleting history.
- [ ] Coach can reorder primary sections/sub-tabs and show/hide optional widgets, persisted server-side.
- [ ] Staff can manage the Availability passcode hash without viewing the existing passcode.
- [ ] The Availability portal requires the passcode, returns only a short-lived limited token, and cannot access any dashboard data.

## 14. Non-Functional Requirements

- [ ] No infinity, NaN, divide-by-zero, misleading zero, or null-looking artifact renders.
- [ ] No points or composite athlete score exists in the UI, schema, or calculations.
- [ ] Production staff API access requires a valid Cognito JWT.
- [ ] The only non-Cognito production access is the limited Availability portal scope in §7.2.
- [ ] No database master credential, IAM key, passcode hash, JWT, refresh token, or server secret is committed to git or shipped to the client.
- [ ] Passcodes are salted and hashed with Argon2id or bcrypt, submitted only over HTTPS, and excluded from logs and browser persistence.
- [ ] Dev and production use separate Aurora, Cognito, AppSync, S3, and Amplify resources.
- [ ] Production builds cannot enable mock auth or seed data.
- [ ] Synthetic generation is deterministic by seed and versioned configuration.
- [ ] The seed/reset commands hard-fail against production.
- [ ] Synthetic identities and measurements are entirely fictional and cannot be traced to real athletes.
- [ ] Schema and infrastructure changes are versioned and applied consistently.
- [ ] CSV files are validated server-side before any database commit.
- [ ] Import commits are transactional and leave no partial state.
- [ ] Raw imports and row-level audit records are traceable without exposing them publicly.
- [ ] Unique constraints protect against duplicate metric observations.
- [ ] Missing data is distinguished from confirmed zero/no-session data.
- [ ] Canonical storage units never change when display units change.
- [ ] WCAG AA contrast, keyboard navigation, visible focus, reduced motion, and minimum target sizes are met.
- [ ] Responsive layout remains usable at single-column mobile width.
- [ ] Queries use bounded season/date/session filters and do not fetch full history by default.
- [ ] Production backups, point-in-time recovery, budget alerts, and error alarms are enabled.
- [ ] No detailed medical diagnoses or treatment notes are collected in Availability.
- [ ] Real athlete data is not imported until institutional IT/privacy approval is documented.
- [ ] Git history, tests, ADRs, and migrations replace manual dated file backups.

## 15. Multi-Model Orchestration Strategy

Use role-based orchestration so architectural work cannot be silently changed by an implementation agent.

### Roles

- **Fable 5 — orchestrator:** owns the build sequence, tracks checklist completion, reviews agent output, and maintains `docs/build-status.md`.
- **Opus — architect/reviewer:** approves architecture-sensitive work before implementation.
- **Sonnet — implementation agent:** writes code only from an approved task specification.

If a named model is unavailable, preserve the role split: strongest available reasoning model for architecture review, execution model for scoped implementation, and a top-level orchestrator that controls merges.

### Architecture-sensitive files

A Sonnet agent may not create or modify any of the following without a fresh Opus review:

- database migrations or schema;
- database roles, grants, or RLS policies;
- AppSync schemas/resolvers or API authorization;
- Cognito settings;
- Availability passcode/token flow;
- import normalization, aggregation, duplicate, or transaction logic;
- ACWR, monotony, strain, percent-change, or speed-baseline formulas;
- canonical-unit conversion logic;
- production environment guards.

Protect these paths in the orchestration instructions and, where practical, in repository CODEOWNERS or CI checks.

### Required workflow for each milestone

1. Fable writes a scoped task brief with acceptance criteria and affected files.
2. Opus produces or updates a short ADR/design note for architecture-sensitive work.
3. Fable confirms the design matches this specification.
4. Sonnet implements one bounded task.
5. Tests run.
6. Opus reviews any architecture-sensitive diff.
7. Fable updates the functional/non-functional checklist and commits.

### Required early ADRs

- `001-backend-path.md` — Aurora/Data API/AppSync verification.
- `002-schema-and-observation-model.md`.
- `003-import-transaction-and-audit.md`.
- `004-auth-and-availability-scope.md`.
- `005-load-calculations-and-missing-data.md`.
- `006-unit-storage-and-display.md`.

### Stop conditions

The orchestrator must stop implementation and request architectural review when:

- a source export does not match the documented fixture;
- a new table or KPI storage pattern is proposed;
- an import would require an undocumented aggregation;
- a calculation changes its window, denominator, or missing-data behavior;
- a frontend request appears to require broader Availability permissions;
- a production resource points to dev configuration;
- a test reveals partial imports, unauthorized access, or precision loss.

The safeguard is the enforced review process, not the model name alone.
