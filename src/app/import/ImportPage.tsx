/**
 * Import Data (§4.2): select source + file → resolve mappings/athletes/
 * sessions → preview with filters → acknowledge warnings → transactional
 * commit → history. Locally this runs against the PGlite backend behind the
 * ImportBackend seam; the AWS backend replaces that seam after the §2.1
 * spike. Sample files come from the generated synthetic season (§13: the
 * demo season enters through the real pipeline).
 */
import { DatabaseZap, FileWarning, UploadCloud } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { SqlExecutor } from '../../../db/migration-core.ts'
import { Badge } from '../../components/ui/Badge.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useAuth } from '../../lib/auth/AuthContext.tsx'
import { detectSource } from '../../lib/import/adapters/index.ts'
import {
  findCommittedImportByHash,
  runPreview,
  type ImportSummary,
  type PreviewBundle,
} from '../../lib/import/backend.ts'
import { commitImport, type CommitResult } from '../../lib/import/commit.ts'
import { parseCsv } from '../../lib/import/csv.ts'
import { sha256Hex } from '../../lib/import/hash.ts'
import { getLocalDb, resetLocalDb } from '../../lib/import/local/local-backend.ts'
import { normalizeKey } from '../../lib/import/normalize.ts'
import type { AthleteDecision } from '../../lib/import/resolve-athletes.ts'
import type { SessionDecision } from '../../lib/import/resolve-sessions.ts'
import type { ConflictPolicy } from '../../lib/import/validate.ts'
import type { Source } from '../../lib/import/types.ts'
import { HistoryView } from './HistoryView.tsx'
import { PreviewTable } from './PreviewTable.tsx'
import { AthletePanel, MappingPanel, SessionPanel } from './ResolutionPanels.tsx'

const APP_ENV: string = import.meta.env.VITE_APP_ENV ?? 'local'
const SOURCES: Source[] = ['TeamBuildr', 'PlayerData', 'Perch']

interface LoadedFile {
  name: string
  text: string
  sha256: string
}

function useLocalDb() {
  const [db, setDb] = useState<SqlExecutor | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (APP_ENV !== 'local') return // never pull the local WASM database outside local mode
    let cancelled = false
    getLocalDb()
      .then((d) => {
        if (!cancelled) setDb(d)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])
  return { db, error }
}

export function ImportPage() {
  const { identity } = useAuth()
  const { db, error: dbError } = useLocalDb()
  const [tab, setTab] = useState<'new' | 'history'>('new')

  // ---- flow state ----
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [detected, setDetected] = useState<{ source: Source; confidence: number } | null>(null)
  const [fallbackDate, setFallbackDate] = useState('')
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>('skip_existing')
  const [athleteDecisions, setAthleteDecisions] = useState(new Map<string, AthleteDecision>())
  const [sessionDecisions, setSessionDecisions] = useState(new Map<string, SessionDecision>())
  const [extraMappings, setExtraMappings] = useState(new Map<string, string>())
  const [ignoredHeaders, setIgnoredHeaders] = useState(new Set<string>())
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)
  const [reprocessConfirmed, setReprocessConfirmed] = useState(false)
  const [bundle, setBundle] = useState<PreviewBundle | null>(null)
  const [duplicateOf, setDuplicateOf] = useState<ImportSummary | null>(null)
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<CommitResult | null>(null)
  const [samples, setSamples] = useState<string[]>([])

  useEffect(() => {
    fetch('/dev-data/fixtures.json')
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
      .then(setSamples)
      .catch(() => setSamples([]))
  }, [])

  const resetFlow = useCallback(() => {
    setAthleteDecisions(new Map())
    setSessionDecisions(new Map())
    setExtraMappings(new Map())
    setIgnoredHeaders(new Set())
    setWarningsAcknowledged(false)
    setReprocessConfirmed(false)
    setBundle(null)
    setDuplicateOf(null)
    setResult(null)
  }, [])

  const loadText = useCallback(
    async (name: string, text: string) => {
      resetFlow()
      const sha256 = await sha256Hex(text)
      setFile({ name, text, sha256 })
      try {
        const suggestion = detectSource(parseCsv(text).headers)
        setDetected(suggestion)
        setSource(suggestion?.source ?? null) // suggestion pre-fills; coach can override
      } catch {
        setDetected(null)
        setSource(null)
      }
    },
    [resetFlow],
  )

  // ---- preview (re-runs on any input change; commit re-validates in-tx) ----
  useEffect(() => {
    if (!db || !file || !source) {
      setBundle(null)
      return
    }
    let cancelled = false
    runPreview(db, {
      source,
      text: file.text,
      filename: file.name,
      athleteDecisions,
      sessionDecisions,
      extraMappings,
      ignoredHeaders,
      conflictPolicy,
      ...(fallbackDate !== '' ? { fallbackDate } : {}),
    })
      .then((b) => {
        if (!cancelled) setBundle(b)
      })
      .catch(console.error)
    findCommittedImportByHash(db, file.sha256)
      .then((dup) => {
        if (!cancelled) setDuplicateOf(dup)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [
    db,
    file,
    source,
    athleteDecisions,
    sessionDecisions,
    extraMappings,
    ignoredHeaders,
    conflictPolicy,
    fallbackDate,
  ])

  const warnings = bundle?.preview.summary.warnings ?? 0
  const commitBlocked =
    !bundle ||
    !bundle.preview.canCommit ||
    (warnings > 0 && !warningsAcknowledged) ||
    (duplicateOf !== null && !reprocessConfirmed)

  const doCommit = useCallback(async () => {
    if (!db || !file || !source || !bundle) return
    setCommitting(true)
    try {
      const commitResult = await commitImport(db, {
        source,
        filename: file.name,
        fileSha256: file.sha256,
        uploadedBySub: identity?.sub ?? 'unknown',
        seasonId: bundle.context.seasonId,
        conflictPolicy,
        reprocessConfirmed,
        athleteItems: bundle.athleteItems,
        sessionItems: bundle.sessionItems,
        rows: bundle.preview.rows,
        fileRowCount: bundle.preview.summary.fileRows,
        newMappings: [...extraMappings.entries()].map(([rawHeader, kpiKey]) => ({
          rawHeader,
          kpiKey,
        })),
      })
      setResult(commitResult)
      if (commitResult.ok) {
        setFile(null)
        setSource(null)
        setBundle(null)
        setDuplicateOf(null)
      }
    } finally {
      setCommitting(false)
    }
  }, [db, file, source, bundle, identity, conflictPolicy, reprocessConfirmed, extraMappings])

  if (APP_ENV !== 'local') {
    return (
      <EmptyState
        icon={DatabaseZap}
        title="Import backend pending"
        message="The AWS import backend arrives with the §2.1 spike; imports run locally until then."
      />
    )
  }
  if (dbError) {
    return <EmptyState icon={FileWarning} title="Local database unavailable" message={dbError} />
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Import views" className="flex gap-1 border-b border-subtle">
        {(['new', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px flex h-10 items-center border-b-2 px-4 text-body font-medium ${
              tab === t
                ? 'border-accent text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {t === 'new' ? 'New Import' : 'Import History'}
          </button>
        ))}
      </nav>

      {db === null ? (
        <Skeleton className="h-40 w-full" />
      ) : tab === 'history' ? (
        <>
          <HistoryView db={db} onNewImport={() => setTab('new')} />
          <div>
            <Button
              variant="ghost"
              onClick={async () => {
                if (window.confirm('Reset the LOCAL synthetic database? All imports are wiped.')) {
                  await resetLocalDb()
                  window.location.reload()
                }
              }}
            >
              Reset local data (synthetic only)
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {/* --- step 1: file & source --- */}
          <section className="rounded-card border border-subtle bg-surface p-4">
            <h2 className="text-subhead font-semibold">1 · File and source</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="sr-only">CSV file</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  data-testid="file-input"
                  onChange={async (e) => {
                    const picked = e.target.files?.[0]
                    if (picked) await loadText(picked.name, await picked.text())
                  }}
                  className="text-body text-secondary file:mr-3 file:h-9 file:cursor-pointer file:rounded-control file:border file:border-strong file:bg-transparent file:px-4 file:text-body file:font-medium file:text-primary hover:file:bg-surface-2"
                />
              </label>
              {samples.length > 0 && (
                <label className="flex items-center gap-2 text-label text-secondary">
                  or sample:
                  <select
                    defaultValue=""
                    onChange={async (e) => {
                      const name = e.target.value
                      if (name === '') return
                      const text = await (
                        await fetch(`/dev-data/fixtures/${encodeURIComponent(name)}`)
                      ).text()
                      await loadText(name, text)
                    }}
                    className="h-9 max-w-72 rounded-control border border-subtle bg-surface-2 px-2 text-body text-primary"
                  >
                    <option value="">Generated sample file…</option>
                    {samples.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {file && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Badge tone="neutral">{file.name}</Badge>
                <span className="tabular text-label text-muted">
                  sha256 {file.sha256.slice(0, 12)}…
                </span>
                <fieldset className="flex items-center gap-2">
                  <legend className="sr-only">Source</legend>
                  {SOURCES.map((s) => (
                    <label
                      key={s}
                      className={`flex h-9 cursor-pointer items-center gap-2 rounded-control border px-3 text-body ${
                        source === s ? 'border-accent text-primary' : 'border-subtle text-secondary'
                      }`}
                    >
                      <input
                        type="radio"
                        name="source"
                        value={s}
                        checked={source === s}
                        onChange={() => setSource(s)}
                        className="accent-(--accent)"
                      />
                      {s}
                      {detected?.source === s && (
                        <Badge tone="brand">
                          suggested {Math.round(detected.confidence * 100)}%
                        </Badge>
                      )}
                    </label>
                  ))}
                </fieldset>
                {source === 'PlayerData' && (
                  <label className="flex items-center gap-2 text-label text-secondary">
                    session date (date-less files):
                    <input
                      type="date"
                      value={fallbackDate}
                      onChange={(e) => setFallbackDate(e.target.value)}
                      className="h-9 rounded-control border border-subtle bg-surface-2 px-2 text-body text-primary"
                    />
                  </label>
                )}
              </div>
            )}

            {duplicateOf && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-control border border-warning/40 bg-warning/10 p-3 text-body">
                <FileWarning aria-hidden className="size-4 text-warning" />
                <span>
                  An identical file was already committed as “{duplicateOf.filename}” on{' '}
                  {duplicateOf.committedAt?.slice(0, 10)}.
                </span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reprocessConfirmed}
                    onChange={(e) => setReprocessConfirmed(e.target.checked)}
                    className="accent-(--accent)"
                  />
                  Reprocess it anyway
                </label>
              </div>
            )}
          </section>

          {/* --- step 2: resolution --- */}
          {bundle && (
            <>
              <MappingPanel
                bundle={bundle}
                onMap={(header, kpiKey) =>
                  setExtraMappings((m) => new Map(m).set(normalizeKey(header), kpiKey))
                }
                onIgnore={(header) =>
                  setIgnoredHeaders((s) => new Set(s).add(normalizeKey(header)))
                }
              />
              <AthletePanel
                bundle={bundle}
                onDecide={(refKey, decision) =>
                  setAthleteDecisions((m) => {
                    const next = new Map(m)
                    if (decision === null) next.delete(refKey)
                    else next.set(refKey, decision)
                    return next
                  })
                }
              />
              <SessionPanel
                bundle={bundle}
                onDecide={(refKey, decision) =>
                  setSessionDecisions((m) => {
                    const next = new Map(m)
                    if (decision === null) next.delete(refKey)
                    else next.set(refKey, decision)
                    return next
                  })
                }
              />

              {/* --- step 3: preview --- */}
              <section className="rounded-card border border-subtle bg-surface p-4">
                <h2 className="text-subhead font-semibold">2 · Preview</h2>
                <p className="tabular mt-1 text-label text-secondary">
                  {bundle.preview.summary.fileRows} file rows · {bundle.preview.summary.rows.insert}{' '}
                  insert / {bundle.preview.summary.rows.update} update /{' '}
                  {bundle.preview.summary.rows.skip} skip / {bundle.preview.summary.rows.error}{' '}
                  error rows ·{' '}
                  {bundle.preview.summary.observations.insert +
                    bundle.preview.summary.observations.update}{' '}
                  observations to write
                </p>
                <div className="mt-3">
                  <PreviewTable preview={bundle.preview} />
                </div>
              </section>

              {/* --- step 4: commit --- */}
              <section className="rounded-card border border-subtle bg-surface p-4">
                <h2 className="text-subhead font-semibold">3 · Commit</h2>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <fieldset className="flex items-center gap-3">
                    <legend className="sr-only">Existing observation policy</legend>
                    {(
                      [
                        ['skip_existing', 'Skip existing'],
                        ['replace_existing', 'Replace existing'],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-body">
                        <input
                          type="radio"
                          name="conflict"
                          checked={conflictPolicy === value}
                          onChange={() => setConflictPolicy(value)}
                          className="accent-(--accent)"
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  {warnings > 0 && (
                    <label className="flex items-center gap-2 text-body text-warning">
                      <input
                        type="checkbox"
                        checked={warningsAcknowledged}
                        onChange={(e) => setWarningsAcknowledged(e.target.checked)}
                        className="accent-(--status-warning)"
                      />
                      I reviewed the {warnings} warning{warnings === 1 ? '' : 's'}
                    </label>
                  )}
                  <Button onClick={doCommit} disabled={commitBlocked || committing}>
                    <UploadCloud aria-hidden className="size-4" />
                    {committing ? 'Committing…' : 'Commit import'}
                  </Button>
                </div>
                {bundle.preview.blockReasons.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-label text-danger">
                    {bundle.preview.blockReasons.map((reason) => (
                      <li key={reason}>✗ {reason}</li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {result && (
            <section
              role="status"
              className={`rounded-card border p-4 text-body ${
                result.ok ? 'border-good/40 bg-good/10' : 'border-danger/40 bg-danger/10'
              }`}
            >
              {result.ok ? (
                <>
                  <span className="font-semibold text-good">Import committed.</span>{' '}
                  <span className="tabular">
                    {result.counts.inserted} inserted · {result.counts.updated} updated ·{' '}
                    {result.counts.skipped} skipped · {result.counts.warnings} warnings
                  </span>{' '}
                  <Button variant="ghost" onClick={() => setTab('history')}>
                    View history
                  </Button>
                </>
              ) : (
                <span className="text-danger">{result.reason}</span>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
