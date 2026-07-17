import { Table2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

/**
 * Chart container with a built-in accessible tabular representation: every
 * chart in the app ships with a "show table" toggle so the data is readable
 * without interpreting pixels (Step-5 chart rules).
 */
export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  table,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  table: { columns: string[]; rows: (string | number)[][] }
}) {
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()

  return (
    <section className="rounded-card border border-subtle bg-surface p-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h3 className="text-subhead font-semibold">{title}</h3>
          {subtitle && <p className="text-label text-muted">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            aria-controls={tableId}
            className="inline-flex h-9 items-center gap-2 rounded-control px-3 text-label font-medium text-secondary hover:bg-surface-2 hover:text-primary"
          >
            <Table2 aria-hidden className="size-4" />
            {showTable ? 'Hide table' : 'Show table'}
          </button>
        </div>
      </header>
      <div className="mt-4">{children}</div>
      {showTable && (
        <div id={tableId} className="mt-4 overflow-x-auto rounded-control border border-subtle">
          <table className="w-full min-w-max text-body">
            <thead>
              <tr className="border-b border-subtle text-left text-label text-muted">
                {table.columns.map((c) => (
                  <th key={c} className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-b border-subtle last:border-b-0">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`tabular px-3 py-1.5 ${j === 0 ? '' : 'text-secondary'}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
