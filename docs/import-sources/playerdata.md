# PlayerData Export Format — observed from real exports

Documented per spec §4.1 from two real exports found on the owner's machine
(2026-07-09/apr session, examined 2026-07-15). **Real files stay outside the repo**;
`tests/fixtures/imports/playerdata_single_session_report.csv` mirrors the structure with
fully synthetic values.

## Files examined

1. `Playerdata Export .csv` — 11 columns, no Group column, 16 data rows
2. `Single-Session Report 16 Apr 26.csv` — same + leading `Group` column

## Format

- **Encoding/delimiter:** plain UTF-8/ASCII, comma-delimited, no quoting observed,
  no BOM issues seen, Unix-style rows.
- **Header row:**
  `Group,Distance,Session Load,Workload,Sprint Distance,High Intensity Running,No. of High Intensity Events,Yards per Minute,No. of Sprints,Top Speed,Accelerations,Decelerations`
  (the `Group` column is present only in the grouped report variant).
- **Row semantics:** one row = one athlete's **already-aggregated session summary**.
  PlayerData does the session aggregation; `kpi_registry.aggregation_method` for these
  KPIs is `source_value`.
- **Units:** distances in **yards** (corroborated by `Yards per Minute`), `Top Speed` in
  **mph**, `Session Load` in AU, event columns are whole counts.
- **`Workload` is decimal**, not integer — observed 3, 3.1, 4, 4.9, 5.6. The spec's §8.7
  "integer 1–10" assumption is corrected; the generator emits one decimal place.

## Critical gaps (blockers for a committable import)

- **No athlete identifier column.** Rows are anonymous in both variants.
- **No date/time column.** The session date appears only in the *filename*
  ("Single-Session Report 16 Apr 26").

→ The import UI could ask the coach to pick the session date per file, but athlete
attribution is impossible with this export variant. **Open question for the coach:
PlayerData almost certainly offers an export including athlete names — we need one
such sample before the adapter is finalized.**

## Duplicate hazard (real, observed)

The grouped report is **sectioned**: athletes appear once under their position group
(`Forwards`) and again under the team-wide section (`Penn FH`); a `None` section also
exists (meaning unknown — ask coach). Rows 2–3 (`Forwards`) were byte-identical to rows
6–7 (`Penn FH`). Even the ungrouped variant contained the same repeated pair. Adapter
rule: never import the same athlete-session twice because it appears in multiple report
sections; section membership is not an athlete identity.

## KPI mapping (proposed `kpi_source_mapping` seeds)

| Raw header | KPI key | Canonical unit | Notes |
|---|---|---|---|
| Distance | total_distance | yd | |
| Session Load | player_load | AU | PlayerData's load metric; default load KPI (§3.1) |
| Workload | workload | scale_1_10 | decimal; PlayerData's own 1–10 scale, neutral interpretation |
| Sprint Distance | sprint_distance | yd | not in provisional spec list — real column |
| High Intensity Running | high_speed_distance | yd | device threshold definition unconfirmed |
| No. of High Intensity Events | high_intensity_events | count | not in provisional spec list |
| Yards per Minute | yards_per_minute | yd/min | derived-by-source; import as source_value |
| No. of Sprints | sprints | count | |
| Top Speed | top_speed | mph | |
| Accelerations | accelerations | count | |
| Decelerations | decelerations | count | |

## Remaining questions for the coach / PlayerData

1. Export variant with athlete names (and ideally a stable athlete ID) + session date?
2. What does Group `None` mean (unassigned athletes? staff units?)
3. Is the team-wide `Penn FH` section always a superset duplicating position sections?
4. Device thresholds behind "High Intensity Running" and "No. of Sprints"?
5. Are blank cells emitted for device failures, or are rows simply absent?
