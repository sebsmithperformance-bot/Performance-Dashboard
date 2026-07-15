-- Least-privileged application role (spec §2.2) — executed once per environment
-- during provisioning, NOT by migrations (auth config differs per environment and
-- never lives in versioned SQL).
--
-- The application connects as a LOGIN user that inherits fh_app_staff; credentials
-- live in AWS Secrets Manager. Application code must never use the master user
-- (§2.2, tested in §9.3).
--
-- No DELETE grant anywhere: the product soft-retires records (§3.2). Rollback or
-- correction paths that truly need deletes get their own reviewed function with
-- security definer, not a blanket grant.

create role fh_app_staff nologin;

grant usage on schema public to fh_app_staff;

grant select, insert, update on
  seasons,
  positions,
  athletes,
  athlete_source_identity,
  sessions,
  availability_entries,
  kpi_registry,
  kpi_source_mapping,
  metric_observations,
  imports,
  import_rows,
  saved_views,
  dashboard_layout,
  availability_gate,
  app_settings
to fh_app_staff;

-- schema_migrations intentionally not granted: migrations run as the owner role
-- during controlled deploys only.
