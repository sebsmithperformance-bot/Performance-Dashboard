-- 0001_initial_schema.sql
-- Full §3 schema (docs/spec/build-prompt.md). ADR-002 records the model decisions.
-- Conventions: UUID PKs via gen_random_uuid() (PG13+ built-in), timestamptz in UTC,
-- CHECK-constrained enums (not PG enum types), soft-retire via status/active flags,
-- unique constraints as the final duplicate barrier.
--
-- Database roles (least-privileged fh_app_staff, §2.2) are provisioned per-environment
-- by db/roles/, not by migrations: role auth config (password/IAM) differs per env and
-- must never be embedded in versioned SQL.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------
create table seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'planned'
              check (status in ('planned', 'active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (start_date <= end_date)
);

create trigger seasons_updated_at before update on seasons
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- positions — editable list; retiring never deletes historical records
-- ---------------------------------------------------------------------------
create table positions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index positions_name_unique on positions (lower(btrim(name)));

create trigger positions_updated_at before update on positions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- athletes — minimum necessary personal data; no DOB (§3, §6.11)
-- ---------------------------------------------------------------------------
create table athletes (
  id                   uuid primary key default gen_random_uuid(),
  first_name           text not null check (length(btrim(first_name)) > 0),
  last_name            text not null check (length(btrim(last_name)) > 0),
  current_position_id  uuid references positions (id),
  jersey_number        integer check (jersey_number between 0 and 99),
  height_in            numeric(4, 1) check (height_in between 36 and 90),
  weight_lb            numeric(5, 1) check (weight_lb between 60 and 400),
  years_on_team        integer check (years_on_team between 0 and 10),
  status               text not null default 'active'
                       check (status in ('active', 'inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index athletes_position_idx on athletes (current_position_id);

create trigger athletes_updated_at before update on athletes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- athlete_source_identity — stable source-to-athlete mapping (§3, §4.2 step 4)
-- ---------------------------------------------------------------------------
create table athlete_source_identity (
  id                   uuid primary key default gen_random_uuid(),
  athlete_id           uuid not null references athletes (id),
  source               text not null
                       check (source in ('TeamBuildr', 'PlayerData', 'Perch')),
  external_id          text check (external_id is null or length(btrim(external_id)) > 0),
  raw_name             text not null check (length(btrim(raw_name)) > 0),
  raw_name_normalized  text not null generated always as
                       (lower(btrim(regexp_replace(raw_name, '\s+', ' ', 'g')))) stored,
  created_at           timestamptz not null default now()
);

-- Prefer external_id when present; normalized name is the fallback identity.
create unique index athlete_source_identity_external_unique
  on athlete_source_identity (source, external_id)
  where external_id is not null;

create unique index athlete_source_identity_name_unique
  on athlete_source_identity (source, raw_name_normalized)
  where external_id is null;

create index athlete_source_identity_athlete_idx
  on athlete_source_identity (athlete_id);

-- ---------------------------------------------------------------------------
-- sessions — multiple sessions per date are expected; athlete+date is never a key
-- ---------------------------------------------------------------------------
create table sessions (
  id                  uuid primary key default gen_random_uuid(),
  season_id           uuid not null references seasons (id),
  session_date        date not null,
  start_time          time,
  label               text not null check (length(btrim(label)) > 0),
  type                text not null
                      check (type in ('practice', 'lift', 'game', 'recovery', 'testing', 'other')),
  source              text not null
                      check (source in ('TeamBuildr', 'PlayerData', 'Perch', 'staff')),
  source_external_id  text check (source_external_id is null
                                  or length(btrim(source_external_id)) > 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index sessions_source_external_unique
  on sessions (source, source_external_id)
  where source_external_id is not null;

create index sessions_season_date_idx on sessions (season_id, session_date);

create trigger sessions_updated_at before update on sessions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- availability_entries — one status per athlete per day (§3, §7.2)
-- operational_note is short and operational; never a diagnosis (§6.8, §8.6)
-- ---------------------------------------------------------------------------
create table availability_entries (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references athletes (id),
  effective_date    date not null,
  status            text not null
                    check (status in ('full_go', 'limited', 'out')),
  operational_note  text check (operational_note is null
                                or length(operational_note) between 1 and 200),
  entry_channel     text not null
                    check (entry_channel in ('staff_app', 'availability_portal')),
  updated_by_sub    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (athlete_id, effective_date)
);

create index availability_entries_date_idx on availability_entries (effective_date);

create trigger availability_entries_updated_at before update on availability_entries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- kpi_registry — KPI configuration is data, not code (§3, ADR-006)
-- canonical_unit is immutable by policy; the UI never edits it (§6.3)
-- ---------------------------------------------------------------------------
create table kpi_registry (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique
                      check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  display_name        text not null check (length(btrim(display_name)) > 0),
  primary_source      text not null
                      check (primary_source in ('TeamBuildr', 'PlayerData', 'Perch', 'Derived')),
  category            text not null
                      check (category in ('Strength', 'Power', 'GPS', 'Load')),
  canonical_unit      text not null check (length(btrim(canonical_unit)) > 0),
  display_unit        text not null check (length(btrim(display_unit)) > 0),
  interpretation      text not null
                      check (interpretation in
                             ('higher_is_better', 'lower_is_better', 'target_range', 'neutral')),
  aggregation_method  text not null
                      check (aggregation_method in
                             ('max', 'mean', 'sum', 'last', 'best_set', 'source_value')),
  valid_min           numeric,
  valid_max           numeric,
  decimal_places      integer not null default 1 check (decimal_places between 0 and 4),
  in_leaderboards     boolean not null default false,
  in_monitoring       boolean not null default false,
  in_profile          boolean not null default false,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (valid_min is null or valid_max is null or valid_min < valid_max)
);

create trigger kpi_registry_updated_at before update on kpi_registry
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- kpi_source_mapping — raw source headers → KPI keys (§3, §4.2 step 5)
-- ---------------------------------------------------------------------------
create table kpi_source_mapping (
  id                     uuid primary key default gen_random_uuid(),
  kpi_key                text not null references kpi_registry (key),
  source                 text not null
                         check (source in ('TeamBuildr', 'PlayerData', 'Perch')),
  raw_header             text not null check (length(btrim(raw_header)) > 0),
  raw_header_normalized  text not null generated always as
                         (lower(btrim(regexp_replace(raw_header, '\s+', ' ', 'g')))) stored,
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);

create unique index kpi_source_mapping_unique
  on kpi_source_mapping (source, raw_header_normalized);

-- ---------------------------------------------------------------------------
-- imports — one row per uploaded file (§3, §4)
-- ---------------------------------------------------------------------------
create table imports (
  id                 uuid primary key default gen_random_uuid(),
  source             text not null
                     check (source in ('TeamBuildr', 'PlayerData', 'Perch')),
  original_filename  text not null check (length(btrim(original_filename)) > 0),
  s3_object_key      text not null check (length(btrim(s3_object_key)) > 0),
  file_sha256        text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by_sub    text not null,
  uploaded_at        timestamptz not null default now(),
  committed_at       timestamptz,
  row_count          integer not null default 0 check (row_count >= 0),
  inserted_count     integer not null default 0 check (inserted_count >= 0),
  updated_count      integer not null default 0 check (updated_count >= 0),
  skipped_count      integer not null default 0 check (skipped_count >= 0),
  warning_count      integer not null default 0 check (warning_count >= 0),
  error_count        integer not null default 0 check (error_count >= 0),
  status             text not null default 'uploaded'
                     check (status in ('uploaded', 'previewed', 'committed', 'failed', 'rolled_back'))
);

-- Exact-duplicate detection is app-level (reprocessing is a deliberate choice, §4.2
-- step 1), so this is a lookup index, not a unique constraint.
create index imports_sha256_idx on imports (file_sha256);
create index imports_uploaded_at_idx on imports (uploaded_at desc);

-- ---------------------------------------------------------------------------
-- import_rows — row-level traceability for every import (§3, §4.2 step 10)
-- ---------------------------------------------------------------------------
create table import_rows (
  id                 uuid primary key default gen_random_uuid(),
  import_id          uuid not null references imports (id),
  source_row_number  integer not null check (source_row_number >= 1),
  raw_data           jsonb not null,
  normalized_data    jsonb,
  action             text not null
                     check (action in ('insert', 'update', 'skip', 'error')),
  before_data        jsonb,
  after_data         jsonb,
  warnings           jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

create index import_rows_import_idx on import_rows (import_id, source_row_number);

-- ---------------------------------------------------------------------------
-- metric_observations — the one normalized value per athlete/session/KPI (§3)
-- ---------------------------------------------------------------------------
create table metric_observations (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references athletes (id),
  session_id        uuid not null references sessions (id),
  kpi_key           text not null references kpi_registry (key),
  value_canonical   numeric not null,
  source_import_id  uuid not null references imports (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (athlete_id, session_id, kpi_key),
  -- Global sanity bound: rejects NaN/Infinity (numeric NaN sorts above all values and
  -- fails BETWEEN) and absurd magnitudes. Per-KPI valid_min/valid_max is enforced by
  -- import validation; this is the last-resort barrier (§6.5).
  check (value_canonical between -1e12 and 1e12)
);

create index metric_observations_athlete_kpi_idx
  on metric_observations (athlete_id, kpi_key);
create index metric_observations_session_idx
  on metric_observations (session_id);
create index metric_observations_import_idx
  on metric_observations (source_import_id);

create trigger metric_observations_updated_at before update on metric_observations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- saved_views — named, reloadable analysis configurations (§3, §6.4)
-- ---------------------------------------------------------------------------
create table saved_views (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 1 and 80),
  owner_user_sub  text not null,
  page            text not null check (length(btrim(page)) > 0),
  config          jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_user_sub, page, name)
);

create trigger saved_views_updated_at before update on saved_views
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- dashboard_layout — server-persisted structural layout (§5.5)
-- ---------------------------------------------------------------------------
create table dashboard_layout (
  id              uuid primary key default gen_random_uuid(),
  owner_scope     text not null unique default 'team_default'
                  check (owner_scope in ('team_default')),
  config          jsonb not null,
  updated_by_sub  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger dashboard_layout_updated_at before update on dashboard_layout
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- availability_gate — exactly one row; passcode hash only, never plaintext (§7.2)
-- ---------------------------------------------------------------------------
create table availability_gate (
  id              smallint primary key check (id = 1),
  passcode_hash   text not null check (length(passcode_hash) > 0),
  hash_algorithm  text not null
                  check (hash_algorithm in ('argon2id', 'bcrypt')),
  updated_at      timestamptz not null default now(),
  updated_by_sub  text
);

create trigger availability_gate_updated_at before update on availability_gate
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- app_settings — non-secret configuration only (§3)
-- ---------------------------------------------------------------------------
create table app_settings (
  key             text primary key check (length(btrim(key)) > 0),
  value           jsonb not null,
  updated_at      timestamptz not null default now(),
  updated_by_sub  text
);

create trigger app_settings_updated_at before update on app_settings
  for each row execute function set_updated_at();
