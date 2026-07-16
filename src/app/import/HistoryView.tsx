import { History } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { SqlExecutor } from '../../../db/migration-core.ts'
import { Badge } from '../../components/ui/Badge.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import {
  getImportRows,
  listImports,
  type ImportRowDetail,
  type ImportSummary,
} from '../../lib/import/backend.ts'

const STATUS_TONE = { committed: 'good', failed: 'danger', rolled_back: 'danger' } as const

function ts(value: string | null): string {
  return value ? value.slice(0, 16).replace('T', ' ') : '—'
}

/** Import History (§4.2 step 10): every import, drill-in to row-level audit. */
export function HistoryView({ db }: { db: SqlExecutor }) {
  const [imports, setImports] = useState<ImportSummary[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRowDetail[] | null>(null)

  const refresh = useCallback(() => {
    listImports(db).then(setImports).catch(console.error)
  }, [db])
  useEffect(refresh, [refresh])

  useEffect(() => {
    if (openId === null) {
      setRows(null)
      return
    }
    let cancelled = false
    getImportRows(db, openId).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [db, openId])

  if (imports === null) return <Skeleton className="h-40 w-full" />
  if (imports.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No imports yet"
        message="Committed imports appear here with row-level audit detail."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card border border-subtle">
        <table className="w-full min-w-[900px] text-body">
          <thead>
            <tr className="border-b border-subtle bg-surface text-left text-label text-muted">
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">File</th>
              <th className="px-3 py-2 font-medium">SHA-256</th>
              <th className="px-3 py-2 font-medium">Uploaded</th>
              <th className="px-3 py-2 font-medium">Committed</th>
              <th className="px-3 py-2 text-right font-medium">Rows</th>
              <th className="px-3 py-2 text-right font-medium">Ins</th>
              <th className="px-3 py-2 text-right font-medium">Upd</th>
              <th className="px-3 py-2 text-right font-medium">Skip</th>
              <th className="px-3 py-2 text-right font-medium">Warn</th>
              <th className="px-3 py-2 text-right font-medium">Err</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {imports.map((imp) => (
              <tr
                key={imp.id}
                className="border-b border-subtle last:border-b-0 hover:bg-surface-2"
              >
                <td className="px-3 py-2">{imp.source}</td>
                <td className="max-w-[220px] truncate px-3 py-2" title={imp.filename}>
                  {imp.filename}
                </td>
                <td className="tabular px-3 py-2 text-label text-muted" title={imp.fileSha256}>
                  {imp.fileSha256.slice(0, 10)}…
                </td>
                <td className="tabular px-3 py-2 text-label">{ts(imp.uploadedAt)}</td>
                <td className="tabular px-3 py-2 text-label">{ts(imp.committedAt)}</td>
                <td className="tabular px-3 py-2 text-right">{imp.rowCount}</td>
                <td className="tabular px-3 py-2 text-right text-good">{imp.inserted}</td>
                <td className="tabular px-3 py-2 text-right text-warning">{imp.updated}</td>
                <td className="tabular px-3 py-2 text-right">{imp.skipped}</td>
                <td className="tabular px-3 py-2 text-right">{imp.warnings}</td>
                <td className="tabular px-3 py-2 text-right">{imp.errors}</td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[imp.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                    {imp.status}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Button
                    variant="ghost"
                    onClick={() => setOpenId(openId === imp.id ? null : imp.id)}
                  >
                    {openId === imp.id ? 'Close' : 'Rows'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId !== null && (
        <div className="overflow-x-auto rounded-card border border-subtle">
          <h3 className="border-b border-subtle bg-surface px-3 py-2 text-subhead font-semibold">
            Row-level audit
          </h3>
          {rows === null ? (
            <Skeleton className="m-3 h-24" />
          ) : (
            <table className="w-full min-w-[760px] text-body">
              <thead>
                <tr className="border-b border-subtle text-left text-label text-muted">
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Raw</th>
                  <th className="px-3 py-2 font-medium">Before → After</th>
                  <th className="px-3 py-2 font-medium">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.sourceRowNumber}
                    className="border-b border-subtle last:border-b-0 align-top"
                  >
                    <td className="tabular px-3 py-2 text-muted">{row.sourceRowNumber}</td>
                    <td className="px-3 py-2">
                      <Badge
                        tone={
                          row.action === 'insert'
                            ? 'good'
                            : row.action === 'update'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {row.action}
                      </Badge>
                    </td>
                    <td className="max-w-[300px] px-3 py-2 text-label text-secondary">
                      {Object.entries(row.raw)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </td>
                    <td className="tabular px-3 py-2 text-label">
                      {row.before || row.after
                        ? Object.keys({ ...(row.before ?? {}), ...(row.after ?? {}) })
                            .map(
                              (k) => `${k}: ${row.before?.[k] ?? '∅'} → ${row.after?.[k] ?? '∅'}`,
                            )
                            .join(' · ')
                        : '—'}
                    </td>
                    <td className="max-w-[280px] px-3 py-2 text-label text-secondary">
                      {row.warnings.join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
