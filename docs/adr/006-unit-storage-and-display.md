# ADR-006: Unit Storage and Display

- **Status:** Accepted
- **Date:** 2026-07-15

## Context

Sources deliver mixed units; coaches may change how a KPI displays. Historical values must
never be rewritten by a presentation choice (§6.3).

## Decision

- Every KPI has an immutable `canonical_unit` fixed at KPI creation. All
  `metric_observations.value_canonical` values are stored in it, at full precision
  (numeric, no premature rounding).
- Unit conversion happens exactly twice: **inbound** during import normalization
  (source unit → canonical), and **outbound** at render (canonical → `display_unit`,
  rounded to `decimal_places` at the last moment).
- Conversions come from one registry module (`src/lib/units/`) — pure, tested for
  round-trip precision (§9.1). No component does inline math.
- Changing `display_unit` is a registry edit affecting presentation only. Changing
  `canonical_unit` is not offered in the UI (§13 Admin); it would require a migration with
  explicit value rewrite and architect review.
- Initial canonical units: yards (distance), mph (speed), lb (load/weight), AU (Player
  Load), watts (power), count (events), minutes (duration), scale-1-10 (PlayerData
  Workload).

## Consequences

Display changes are instant and safe. The import pipeline is the only writer that
converts; everything downstream trusts canonical values. Round-trip tests guard against
precision loss.
