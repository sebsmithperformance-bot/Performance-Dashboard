import { ArrowDown, ArrowUp, Lock, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CONTROL_CLASS, LabeledControl } from '../../components/controls/controls.tsx'
import { Badge } from '../../components/ui/Badge.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { Drawer } from '../../components/ui/Drawer.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Panel } from '../../components/ui/Panel.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { makeKpiKey, useSettings } from '../../lib/settings/SettingsContext.tsx'
import type {
  CustomKpiDef,
  KpiThreshold,
  PositionGroup,
  ThresholdSettings,
} from '../../lib/settings/types.ts'
import { canConvert, type Unit } from '../../lib/units/index.ts'
import type { DashKpi, KpiInterpretation, KpiVisibility } from '../../lib/dashboard/types.ts'

const SOURCES = ['TeamBuildr', 'PlayerData', 'Perch', 'Derived']
const AGGREGATIONS: { value: CustomKpiDef['aggregation']; label: string }[] = [
  { value: 'mean', label: 'Average per athlete' },
  { value: 'sum', label: 'Team total' },
  { value: 'max', label: 'Maximum' },
  { value: 'latest', label: 'Latest value' },
]
const THRESHOLD_STATES: { value: KpiThreshold['state']; label: string; tone: 'good' | 'warning' | 'danger' | 'neutral' }[] = [
  { value: 'good', label: 'Good', tone: 'good' },
  { value: 'warning', label: 'Watch', tone: 'warning' },
  { value: 'danger', label: 'Flag', tone: 'danger' },
  { value: 'neutral', label: 'Neutral', tone: 'neutral' },
]

const ALL_UNITS: Unit[] = [
  'yd',
  'm',
  'mph',
  'km_h',
  'lb',
  'kg',
  'AU',
  'W',
  'count',
  'min',
  'yd_per_min',
  'm_per_min',
  'scale_1_10',
]

const INTERPRETATIONS: { value: KpiInterpretation; label: string }[] = [
  { value: 'higher_is_better', label: 'Higher is better' },
  { value: 'lower_is_better', label: 'Lower is better' },
  { value: 'target_range', label: 'Target range' },
  { value: 'neutral', label: 'Neutral' },
]

const SURFACES: { key: keyof KpiVisibility; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'trends', label: 'Data Trends' },
  { key: 'leaderboards', label: 'Leaderboards' },
  { key: 'profile', label: 'Athlete Profile' },
]

/** Admin → KPI Settings (§5.5): registry display config, operational
 *  thresholds, and position groups. Canonical units and calculation formulas
 *  are visibly locked — never editable here. */
export function KpiSettingsPage() {
  const { status, error, dataset } = useDashboardData()

  return (
    <div className="flex flex-col gap-4">
      {status === 'loading' ? (
        <Skeleton className="h-96 w-full" />
      ) : status === 'error' || !dataset ? (
        <ErrorState
          title="Dashboard data unavailable"
          message={error ?? 'No dataset loaded — run npm run seed:generate and reload.'}
        />
      ) : (
        <>
          <KpiRegistry kpis={[...dataset.kpis.values()]} />
          <ThresholdsEditor />
          <PositionsManager />
        </>
      )}
    </div>
  )
}

function KpiRegistry({ kpis }: { kpis: DashKpi[] }) {
  const { settings, updateKpi, setCustomKpis } = useSettings()
  const [editing, setEditing] = useState<DashKpi | null>(null)
  const [adding, setAdding] = useState(false)

  const customKeys = useMemo(
    () => new Set(settings.customKpis.map((c) => c.key)),
    [settings.customKpis],
  )
  const retiredCustom = settings.customKpis.filter((c) => c.retired)

  const columns = useMemo<Column<DashKpi>[]>(
    () => [
      {
        key: 'name',
        header: 'Display name',
        sortValue: (k) => k.displayName,
        render: (k) => (
          <span className="font-medium">
            {k.displayName}
            {customKeys.has(k.key) && (
              <span className="ml-2 align-middle">
                <Badge tone="brand">custom</Badge>
              </span>
            )}
            {settings.kpi[k.key] && (
              <span className="ml-2 align-middle">
                <Badge tone="neutral">customized</Badge>
              </span>
            )}
            {(settings.kpiThresholds[k.key]?.length ?? 0) > 0 && (
              <span className="ml-2 align-middle">
                <Badge tone="neutral">
                  {settings.kpiThresholds[k.key]!.length} threshold
                  {settings.kpiThresholds[k.key]!.length === 1 ? '' : 's'}
                </Badge>
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'source',
        header: 'Source',
        sortValue: (k) => k.source ?? '',
        render: (k) => <span className="text-secondary">{k.source ?? '—'}</span>,
      },
      {
        key: 'category',
        header: 'Category',
        sortValue: (k) => k.category,
        render: (k) => <span className="text-secondary">{k.category}</span>,
      },
      {
        key: 'canonical',
        header: 'Canonical unit',
        render: (k) => (
          <span className="inline-flex items-center gap-1 text-secondary">
            <Lock aria-hidden className="size-3 text-muted" />
            {k.canonicalUnit}
          </span>
        ),
      },
      {
        key: 'display',
        header: 'Display unit',
        render: (k) => <span className="tabular">{k.unit}</span>,
      },
      {
        key: 'decimals',
        header: 'Decimals',
        align: 'right',
        render: (k) => <span className="tabular">{k.decimalPlaces}</span>,
      },
      {
        key: 'interpretation',
        header: 'Interpretation',
        render: (k) => (
          <span className="text-secondary">
            {INTERPRETATIONS.find((i) => i.value === k.interpretation)?.label}
          </span>
        ),
      },
      {
        key: 'visibility',
        header: 'Visible on',
        render: (k) => (
          <span className="text-label text-secondary">
            {SURFACES.filter((s) => k.visibility[s.key])
              .map((s) => s.label)
              .join(', ') || 'nowhere'}
          </span>
        ),
      },
    ],
    [settings.kpi, settings.kpiThresholds, customKeys],
  )

  const restore = (key: string) =>
    setCustomKpis(settings.customKpis.map((c) => (c.key === key ? { ...c, retired: false } : c)))

  return (
    <Panel icon={Settings2} title="KPI registry" keyValue={`${kpis.length} KPIs`}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="max-w-2xl text-label text-muted">
            Click a KPI to edit its display configuration and thresholds. Canonical storage units
            and calculation formulas are locked (§6.3) — changing a display unit converts values at
            render time and never rewrites stored records.
          </p>
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            Add KPI
          </Button>
        </div>
        <DataTable columns={columns} rows={kpis} rowKey={(k) => k.key} onRowClick={setEditing} />
        {retiredCustom.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-label text-muted">
            <span>Retired custom KPIs:</span>
            {retiredCustom.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => restore(c.key)}
                className="text-accent underline decoration-dotted hover:text-primary"
              >
                restore {c.displayName}
              </button>
            ))}
          </div>
        )}
      </div>
      {adding && <AddKpiDrawer existingKeys={kpis.map((k) => k.key)} onClose={() => setAdding(false)} />}
      {editing && (
        <KpiEditor
          kpi={editing}
          isCustom={customKeys.has(editing.key)}
          hasOverride={settings.kpi[editing.key] !== undefined}
          onClose={() => setEditing(null)}
          onSave={(override) => {
            updateKpi(editing.key, override)
            setEditing(null)
          }}
          onReset={() => {
            updateKpi(editing.key, null)
            setEditing(null)
          }}
        />
      )}
    </Panel>
  )
}

/** Add KPI form — a definition only; the KPI stays empty until data is mapped. */
function AddKpiDrawer({
  existingKeys,
  onClose,
}: {
  existingKeys: string[]
  onClose: () => void
}) {
  const { settings, setCustomKpis } = useSettings()
  const [displayName, setDisplayName] = useState('')
  const [category, setCategory] = useState<DashKpi['category']>('GPS')
  const [source, setSource] = useState('TeamBuildr')
  const [canonicalUnit, setCanonicalUnit] = useState<Unit>('count')
  const [displayUnit, setDisplayUnit] = useState<Unit>('count')
  const [decimalPlaces, setDecimalPlaces] = useState(0)
  const [interpretation, setInterpretation] = useState<KpiInterpretation>('higher_is_better')
  const [aggregation, setAggregation] = useState<CustomKpiDef['aggregation']>('mean')
  const [visibility, setVisibility] = useState<KpiVisibility>({
    overview: false,
    monitoring: true,
    trends: true,
    leaderboards: false,
    profile: false,
  })
  const [validMin, setValidMin] = useState('')
  const [validMax, setValidMax] = useState('')

  const trimmed = displayName.trim()
  const allKeys = new Set([...existingKeys, ...settings.customKpis.map((c) => c.key)])
  const previewKey = trimmed ? makeKpiKey(trimmed, allKeys) : ''
  const duplicateName =
    trimmed !== '' &&
    [...settings.customKpis].some((c) => c.displayName.toLowerCase() === trimmed.toLowerCase())
  const min = validMin.trim() === '' ? null : Number(validMin)
  const max = validMax.trim() === '' ? null : Number(validMax)
  const rangeInvalid = min !== null && max !== null && min >= max
  const unitOptions = ALL_UNITS.filter((u) => canConvert(canonicalUnit, u))
  const canSave = trimmed !== '' && !duplicateName && !rangeInvalid

  const save = () => {
    if (!canSave) return
    const def: CustomKpiDef = {
      key: makeKpiKey(trimmed, allKeys),
      displayName: trimmed,
      category,
      canonicalUnit,
      unit: canConvert(canonicalUnit, displayUnit) ? displayUnit : canonicalUnit,
      decimalPlaces,
      interpretation,
      visibility,
      source,
      aggregation,
      validMin: min !== null && Number.isFinite(min) ? min : null,
      validMax: max !== null && Number.isFinite(max) ? max : null,
      retired: false,
    }
    setCustomKpis([...settings.customKpis, def])
    onClose()
  }

  return (
    <Drawer title="Add KPI" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-control border border-subtle bg-surface-2 p-3 text-label text-secondary">
          A new KPI is a definition only — it stays empty until its source data is mapped during
          import. Calculation formulas are never authored here (§6.3).
        </div>

        <LabeledControl label="Display name">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Repeated Sprint Efforts"
            className={`${CONTROL_CLASS} w-full`}
          />
        </LabeledControl>
        {trimmed !== '' && (
          <p className="text-label text-muted">
            Internal key:{' '}
            <span className="tabular font-medium text-secondary">{previewKey}</span>
            {duplicateName && <span className="ml-2 text-danger">name already used</span>}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledControl label="Source">
            <select value={source} onChange={(e) => setSource(e.target.value)} className={CONTROL_CLASS}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DashKpi['category'])}
              className={CONTROL_CLASS}
            >
              {(['Strength', 'Power', 'GPS', 'Load'] as const).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label="Storage unit">
            <select
              value={canonicalUnit}
              onChange={(e) => {
                const u = e.target.value as Unit
                setCanonicalUnit(u)
                setDisplayUnit(u)
              }}
              className={CONTROL_CLASS}
            >
              {ALL_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label="Display unit">
            <select
              value={displayUnit}
              onChange={(e) => setDisplayUnit(e.target.value as Unit)}
              className={CONTROL_CLASS}
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label="Decimals">
            <select
              value={decimalPlaces}
              onChange={(e) => setDecimalPlaces(Number(e.target.value))}
              className={CONTROL_CLASS}
            >
              {[0, 1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label="Interpretation">
            <select
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value as KpiInterpretation)}
              className={CONTROL_CLASS}
            >
              {INTERPRETATIONS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label="Aggregation">
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as CustomKpiDef['aggregation'])}
              className={CONTROL_CLASS}
            >
              {AGGREGATIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </LabeledControl>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledControl label="Valid minimum (optional)">
            <input
              type="number"
              value={validMin}
              onChange={(e) => setValidMin(e.target.value)}
              className={CONTROL_CLASS}
            />
          </LabeledControl>
          <LabeledControl label="Valid maximum (optional)">
            <input
              type="number"
              value={validMax}
              onChange={(e) => setValidMax(e.target.value)}
              className={CONTROL_CLASS}
            />
          </LabeledControl>
        </div>
        {rangeInvalid && (
          <p className="text-label text-danger">Valid minimum must be below the maximum.</p>
        )}

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-label font-medium text-secondary">Visible on</legend>
          {SURFACES.map((surface) => (
            <label
              key={surface.key}
              className="flex items-center gap-2 rounded-control px-2 py-1 text-body hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={visibility[surface.key]}
                onChange={(e) => setVisibility((v) => ({ ...v, [surface.key]: e.target.checked }))}
                className="accent-(--accent)"
              />
              {surface.label}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!canSave}>
            Add KPI
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

function KpiEditor({
  kpi,
  isCustom,
  hasOverride,
  onClose,
  onSave,
  onReset,
}: {
  kpi: DashKpi
  isCustom: boolean
  hasOverride: boolean
  onClose: () => void
  onSave: (override: {
    displayName: string
    displayUnit: string
    decimalPlaces: number
    interpretation: KpiInterpretation
    category: DashKpi['category']
    visibility: KpiVisibility
  }) => void
  onReset: () => void
}) {
  const { settings, setCustomKpis } = useSettings()
  const [displayName, setDisplayName] = useState(kpi.displayName)
  const [displayUnit, setDisplayUnit] = useState(kpi.unit)
  const [decimalPlaces, setDecimalPlaces] = useState(kpi.decimalPlaces)
  const [interpretation, setInterpretation] = useState(kpi.interpretation)
  const [category, setCategory] = useState(kpi.category)
  const [visibility, setVisibility] = useState<KpiVisibility>({ ...kpi.visibility })

  const unitOptions = ALL_UNITS.filter((u) => canConvert(kpi.canonicalUnit as Unit, u))

  const retireCustom = () => {
    setCustomKpis(settings.customKpis.map((c) => (c.key === kpi.key ? { ...c, retired: true } : c)))
    onClose()
  }
  const deleteCustom = () => {
    setCustomKpis(settings.customKpis.filter((c) => c.key !== kpi.key))
    onClose()
  }

  return (
    <Drawer title={`${kpi.displayName} — settings`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <LabeledControl label="Display name">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={`${CONTROL_CLASS} w-full`}
          />
        </LabeledControl>

        <div className="rounded-control border border-subtle bg-surface-2 p-3">
          <p className="flex items-center gap-2 text-label text-secondary">
            <Lock aria-hidden className="size-3.5" />
            Canonical unit: <span className="tabular font-medium">{kpi.canonicalUnit}</span> —
            protected. Stored values never change (§6.3).
          </p>
        </div>

        <LabeledControl label="Display unit">
          <select
            value={displayUnit}
            onChange={(e) => setDisplayUnit(e.target.value)}
            className={CONTROL_CLASS}
          >
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
                {u === kpi.canonicalUnit ? ' (canonical)' : ''}
              </option>
            ))}
          </select>
        </LabeledControl>

        <LabeledControl label="Decimal places">
          <select
            value={decimalPlaces}
            onChange={(e) => setDecimalPlaces(Number(e.target.value))}
            className={CONTROL_CLASS}
          >
            {[0, 1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </LabeledControl>

        <LabeledControl label="Interpretation">
          <select
            value={interpretation}
            onChange={(e) => setInterpretation(e.target.value as KpiInterpretation)}
            className={CONTROL_CLASS}
          >
            {INTERPRETATIONS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </LabeledControl>

        <LabeledControl label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DashKpi['category'])}
            className={CONTROL_CLASS}
          >
            {(['Strength', 'Power', 'GPS', 'Load'] as const).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </LabeledControl>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-label font-medium text-secondary">Visible on</legend>
          {SURFACES.map((surface) => (
            <label
              key={surface.key}
              className="flex items-center gap-2 rounded-control px-2 py-1 text-body hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={visibility[surface.key]}
                onChange={(e) =>
                  setVisibility((v) => ({ ...v, [surface.key]: e.target.checked }))
                }
                className="accent-(--accent)"
              />
              {surface.label}
            </label>
          ))}
        </fieldset>

        {kpi.sourceColumns && kpi.sourceColumns.length > 0 && (
          <div className="text-label text-secondary">
            <p className="font-medium">Source column mapping ({kpi.source})</p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {kpi.sourceColumns.map((c) => (
                <li key={c}>
                  <Badge tone="neutral">{c}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-muted">
              Header mappings are managed during import (Admin → Import Data) so new vendor columns
              are confirmed against real files.
            </p>
          </div>
        )}

        <KpiThresholdsSection kpi={kpi} />

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              onSave({
                displayName: displayName.trim() || kpi.displayName,
                displayUnit,
                decimalPlaces,
                interpretation,
                category,
                visibility,
              })
            }
          >
            Save KPI settings
          </Button>
          {hasOverride && (
            <Button variant="secondary" onClick={onReset}>
              <RotateCcw aria-hidden className="size-4" />
              Reset to defaults
            </Button>
          )}
          {isCustom && (
            <>
              <Button variant="secondary" onClick={retireCustom}>
                Retire KPI
              </Button>
              <Button variant="secondary" onClick={deleteCustom}>
                <Trash2 aria-hidden className="size-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  )
}

/** Per-KPI display threshold bands (interpretation only — never stored values,
 *  never injury predictions §6.8). Lives inside the KPI editor drawer. */
function KpiThresholdsSection({ kpi }: { kpi: DashKpi }) {
  const { settings, setKpiThresholds } = useSettings()
  const thresholds = settings.kpiThresholds[kpi.key] ?? []
  const surfaces = SURFACES.filter((s) => kpi.visibility[s.key]).map((s) => s.label)

  const patch = (id: string, changes: Partial<KpiThreshold>) =>
    setKpiThresholds(
      kpi.key,
      thresholds.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    )
  const add = () =>
    setKpiThresholds(kpi.key, [
      ...thresholds,
      {
        id: `t${Date.now().toString(36)}`,
        label: 'New band',
        lower: null,
        upper: null,
        state: 'neutral',
        explanation: '',
        active: true,
      },
    ])
  const remove = (id: string) =>
    setKpiThresholds(
      kpi.key,
      thresholds.filter((t) => t.id !== id),
    )

  // flag overlapping active ranges (null bounds are open-ended)
  const overlaps = (a: KpiThreshold, b: KpiThreshold) => {
    const aLo = a.lower ?? -Infinity
    const aHi = a.upper ?? Infinity
    const bLo = b.lower ?? -Infinity
    const bHi = b.upper ?? Infinity
    return aLo < bHi && bLo < aHi
  }
  const active = thresholds.filter((t) => t.active)
  const hasOverlap = active.some((t, i) => active.slice(i + 1).some((o) => overlaps(t, o)))
  const hasInverted = thresholds.some(
    (t) => t.lower !== null && t.upper !== null && t.lower >= t.upper,
  )

  return (
    <div className="flex flex-col gap-2 rounded-control border border-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-medium text-secondary">Display thresholds</span>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-label text-accent hover:underline"
        >
          <Plus aria-hidden className="size-3.5" />
          Add band
        </button>
      </div>
      <p className="text-label text-muted">
        Bands flag values for interpretation only — they never change stored data or predict injury
        (§6.8).{' '}
        {surfaces.length > 0
          ? `Applied where this KPI shows: ${surfaces.join(', ')}.`
          : 'This KPI is hidden everywhere, so bands are not shown yet.'}
      </p>
      {thresholds.length === 0 ? (
        <p className="text-label text-muted">No thresholds defined.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {thresholds.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-control bg-surface-2 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={t.label}
                  aria-label="Band label"
                  onChange={(e) => patch(t.id, { label: e.target.value })}
                  className={`${CONTROL_CLASS} w-36`}
                />
                <select
                  value={t.state}
                  aria-label="Band state"
                  onChange={(e) => patch(t.id, { state: e.target.value as KpiThreshold['state'] })}
                  className={CONTROL_CLASS}
                >
                  {THRESHOLD_STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-label text-secondary">
                  <input
                    type="checkbox"
                    checked={t.active}
                    onChange={(e) => patch(t.id, { active: e.target.checked })}
                    className="accent-(--accent)"
                  />
                  active
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${t.label}`}
                  onClick={() => remove(t.id)}
                  className="ml-auto text-muted hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-label text-secondary">
                <label className="flex items-center gap-1">
                  lower
                  <input
                    type="number"
                    value={t.lower ?? ''}
                    onChange={(e) =>
                      patch(t.id, { lower: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    className={`${CONTROL_CLASS} w-24`}
                  />
                </label>
                <label className="flex items-center gap-1">
                  upper
                  <input
                    type="number"
                    value={t.upper ?? ''}
                    onChange={(e) =>
                      patch(t.id, { upper: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    className={`${CONTROL_CLASS} w-24`}
                  />
                </label>
                <span className="tabular text-muted">{kpi.unit}</span>
              </div>
              <input
                type="text"
                value={t.explanation}
                aria-label="Band explanation"
                placeholder="short explanation (optional)"
                onChange={(e) => patch(t.id, { explanation: e.target.value })}
                className={`${CONTROL_CLASS} w-full`}
              />
            </li>
          ))}
        </ul>
      )}
      {hasInverted && (
        <p className="text-label text-danger">
          Each band’s lower bound must be below its upper bound.
        </p>
      )}
      {hasOverlap && (
        <p className="text-label text-warning">
          Active bands overlap — a value could match more than one band.
        </p>
      )}
      {thresholds.length > 0 && (
        <button
          type="button"
          onClick={() => setKpiThresholds(kpi.key, [])}
          className="self-start text-label text-secondary underline decoration-dotted hover:text-primary"
        >
          Reset thresholds
        </button>
      )}
    </div>
  )
}

const THRESHOLD_FIELDS: {
  key: keyof ThresholdSettings
  label: string
  help: string
  step: number
  min: number
  max: number
}[] = [
  {
    key: 'speedFlagThresholdPct',
    label: 'Speed flag threshold (%)',
    help: 'flag when top speed falls below this percent of baseline best',
    step: 1,
    min: 50,
    max: 100,
  },
  {
    key: 'speedMinBaselineSamples',
    label: 'Minimum speed-baseline sessions',
    help: 'prior valid top-speed observations required before a baseline exists',
    step: 1,
    min: 1,
    max: 10,
  },
  {
    key: 'speedMinExposureMin',
    label: 'Speed exposure minimum (min)',
    help: 'sessions shorter than this do not count toward the speed baseline',
    step: 5,
    min: 0,
    max: 60,
  },
  {
    key: 'acwrBelowBand',
    label: 'ACWR lower band edge',
    help: 'below this = "below recent workload"',
    step: 0.05,
    min: 0.3,
    max: 1,
  },
  {
    key: 'acwrElevatedBand',
    label: 'ACWR elevated band edge',
    help: 'above this = "elevated acute load" (yellow)',
    step: 0.05,
    min: 1,
    max: 2.5,
  },
  {
    key: 'acwrHighBand',
    label: 'ACWR substantially-elevated edge',
    help: 'above this = "substantially elevated acute load" (red)',
    step: 0.05,
    min: 1,
    max: 3,
  },
  {
    key: 'percentChangeUnchangedBandPct',
    label: 'Unchanged band (±%)',
    help: 'percent changes inside this band classify as "unchanged"',
    step: 0.5,
    min: 0,
    max: 10,
  },
]

function ThresholdsEditor() {
  const { settings, updateThresholds, resetThresholds } = useSettings()

  return (
    <Panel icon={Settings2} title="Thresholds" keyValue="operational bands">
      <div className="flex flex-col gap-3">
        <p className="text-label text-muted">
          These tune the published bands and gates shown across the dashboard — the calculation
          formulas themselves (ACWR, monotony, strain, % change) are fixed and reviewed. Every
          page states the thresholds it uses (§6.9). No threshold creates an injury prediction
          (§6.8).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {THRESHOLD_FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-label text-secondary">
              {field.label}
              <input
                type="number"
                value={settings.thresholds[field.key]}
                step={field.step}
                min={field.min}
                max={field.max}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isFinite(value) && value >= field.min && value <= field.max) {
                    updateThresholds({ [field.key]: value })
                  }
                }}
                className={CONTROL_CLASS}
              />
              <span className="text-muted">{field.help}</span>
            </label>
          ))}
        </div>
        {(settings.thresholds.acwrBelowBand >= settings.thresholds.acwrElevatedBand ||
          settings.thresholds.acwrElevatedBand >= settings.thresholds.acwrHighBand) && (
          <p className="text-label text-danger">
            ACWR band edges must increase: below &lt; elevated &lt; substantially-elevated.
          </p>
        )}
        <div>
          <Button variant="secondary" onClick={resetThresholds}>
            <RotateCcw aria-hidden className="size-4" />
            Reset thresholds to defaults
          </Button>
        </div>
      </div>
    </Panel>
  )
}

function PositionsManager() {
  const { settings, setPositions } = useSettings()
  const [newLabel, setNewLabel] = useState('')
  const positions = settings.positions

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= positions.length) return
    const next = [...positions]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item!)
    setPositions(next)
  }

  const patch = (id: string, changes: Partial<PositionGroup>) => {
    setPositions(positions.map((p) => (p.id === id ? { ...p, ...changes } : p)))
  }

  return (
    <Panel icon={Settings2} title="Position groups" keyValue={`${positions.length} groups`}>
      <div className="flex flex-col gap-3">
        <p className="text-label text-muted">
          Rename, reorder, add, or retire groups. Retiring a group hides it from filters — it
          never deletes historical athlete data (§5.5). Athletes join custom groups through
          roster management once the backend exists.
        </p>
        <ul className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
          {positions.map((group, i) => (
            <li key={group.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${group.label} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="text-muted hover:text-primary disabled:opacity-30"
                >
                  <ArrowUp aria-hidden className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${group.label} down`}
                  disabled={i === positions.length - 1}
                  onClick={() => move(i, 1)}
                  className="text-muted hover:text-primary disabled:opacity-30"
                >
                  <ArrowDown aria-hidden className="size-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={group.label}
                aria-label={`Rename ${group.id}`}
                onChange={(e) => patch(group.id, { label: e.target.value })}
                className={`${CONTROL_CLASS} w-44 ${group.retired ? 'line-through opacity-60' : ''}`}
              />
              {group.builtin ? (
                <Badge tone="neutral">built-in</Badge>
              ) : (
                <Badge tone="brand">custom</Badge>
              )}
              {group.retired && <Badge tone="warning">retired</Badge>}
              <button
                type="button"
                onClick={() => patch(group.id, { retired: !group.retired })}
                className="ml-auto text-label text-secondary underline decoration-dotted hover:text-primary"
              >
                {group.retired ? 'restore' : 'retire'}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const label = newLabel.trim()
            if (label === '' || positions.some((p) => p.label === label)) return
            setPositions([
              ...positions,
              {
                id: `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                label,
                builtin: false,
                retired: false,
              },
            ])
            setNewLabel('')
          }}
        >
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="New group name"
            aria-label="New position group name"
            className={`${CONTROL_CLASS} w-44`}
          />
          <Button type="submit" variant="secondary" disabled={newLabel.trim() === ''}>
            Add group
          </Button>
        </form>
      </div>
    </Panel>
  )
}
