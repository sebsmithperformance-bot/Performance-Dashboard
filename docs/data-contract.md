# Data Contract

The shapes coach-facing code depends on. The authoritative source is
[`src/lib/dashboard/types.ts`](../src/lib/dashboard/types.ts); this document
explains it. The rule behind the contract: **no vendor names, no source-file
concepts, and no latent generator traits ever reach the UI.** A component cannot
tell whether its data came from the local synthetic season or a future AWS
backend.

## The provider seam

```ts
interface DashboardDataProvider {
  load(): Promise<DashboardDataset>
  savedViews: SavedViewsStore
  availability: AvailabilityRepository
}
```

- **Local implementation:** `LocalDashboardDataProvider`
  (`src/lib/dashboard/local-provider.ts`) — reads `canonical.json`, persists saved
  views / availability overrides to `localStorage`.
- **Future implementation:** `AwsDashboardDataProvider` returning the same
  `DashboardDataset` from AppSync, persisting to `saved_views` / availability
  tables. Same interface, so no page changes.

## `DashboardDataset`

Loaded once; the provider also prebuilds lookup indexes so selectors stay O(1).

| Field | Meaning |
| --- | --- |
| `seasonLabel`, `seasonStart`, `seasonEnd` | Season window (ISO dates). |
| `athletes: DashAthlete[]` | Roster (id, names, `position`, jersey, years on team). |
| `positions: Position[]` | `Goalkeeper \| Defender \| Midfielder \| Forward`. |
| `sessions: DashSession[]` | Sorted by date/time. `kind: 'field' \| 'lift'` — field sessions carry GPS, lift sessions carry S&C. |
| `availability: DashAvailabilityDay[]` | Per athlete/day `full_go \| limited \| out` (+ operational note, **never medical detail**). |
| `participation: DashParticipation[]` | Per athlete/session `full \| modified \| absent` + `exposureMin`. |
| `observations: DashObservation[]` | The measurements: `athleteId × sessionId × kpiKey → value`, in **canonical units**. |
| `kpis: Map<string, DashKpi>` | The KPI registry (see below). |
| `*ById`, `*ByDate`, `*BySession`, `*ByKey` maps | Prebuilt indexes for selectors. |

### `DashKpi` — the registry entry

`key`, `displayName`, `category` (`Strength \| Power \| GPS \| Load`),
`canonicalUnit` (immutable storage unit), `unit` (display unit, coach-overridable
only when convertible), `decimalPlaces`, `interpretation`
(`higher_is_better \| lower_is_better \| target_range \| neutral`), and
`visibility` (per-surface toggles: overview / monitoring / trends / leaderboards /
profile). Optional `source` + `sourceColumns` are read-only provenance shown in
Metric Settings.

### Units

Canonical unit is how a value is stored and is never changed by settings. Display
unit defaults to canonical and can be overridden only when
`canConvert(canonicalUnit, displayUnit)` holds (`src/lib/units/`, ADR-006).

## Missing data is first-class

Calculations never silently coerce missing data to zero. A day is one of three
states (ADR-005), and this distinction is what makes load windows trustworthy:

- **observed** — participated and produced a value;
- **rest** — no team field session that day (contributes 0);
- **missing** — participated but no device data (**poisons** any window it falls
  in; the result becomes "not computable — incomplete window").

See [calculations.md](./calculations.md).

## Coach-writable data

- **Saved views** (`SavedViewsStore`) — named page configs (localStorage locally,
  `saved_views` table on AWS).
- **Availability overrides** (`AvailabilityRepository`) — coach edits layered over
  the dataset; operational notes only.
- **Settings** — see [current-architecture.md](./current-architecture.md#4-settings--customization).
  Persisted whole through `SettingsRepository`.

## Import pipeline (prototype)

`src/lib/import/**` maps the three real vendor export formats into
`DashObservation`s and commits them transactionally to PGlite. It is the only
place vendor/source concepts exist; downstream the data is source-agnostic.
Documented real formats live in `docs/import-sources/`. This is prototype
plumbing — the production path (private S3 + server-side commit) is deferred.

## Synthetic data — where the numbers come from today

`seed/**` generates a deterministic synthetic season (`npm run seed:generate`)
written to `seed/output/`. The generator has "latent traits" that shape realistic
numbers; per §8.3 those traits are **deliberately not mapped into the dataset** —
only the observable measurements cross the seam. Real athlete data never enters
the repository (enforced by `.gitignore` and the build-env guard).
</content>
