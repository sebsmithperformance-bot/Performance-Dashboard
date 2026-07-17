import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

export interface Column<Row> {
  key: string
  header: string
  align?: 'left' | 'right'
  /** value used for sorting; omit to make the column unsortable */
  sortValue?: (row: Row) => number | string | null
  render: (row: Row) => ReactNode
}

/**
 * Shared data table (§12.5): sticky header, sticky first column, 40px rows,
 * hover highlight, sortable columns, horizontal scroll inside its own
 * container. Null sort values sink to the bottom in either direction.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  maxHeightClass = 'max-h-[560px]',
}: {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  onRowClick?: (row: Row) => void
  maxHeightClass?: string
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return rows
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = column.sortValue!(a)
      const vb = column.sortValue!(b)
      if (va === null && vb === null) return 0
      if (va === null) return 1 // nulls last regardless of direction
      if (vb === null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
      return String(va).localeCompare(String(vb)) * factor
    })
  }, [rows, sort, columns])

  const toggleSort = (key: string) => {
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    )
  }

  return (
    <div className={`overflow-auto rounded-card border border-subtle ${maxHeightClass}`}>
      <table className="w-full min-w-max border-separate border-spacing-0 text-body">
        <thead>
          <tr>
            {columns.map((column, i) => (
              <th
                key={column.key}
                className={`sticky top-0 z-10 border-b border-subtle bg-surface px-3 py-2 text-label font-medium whitespace-nowrap text-muted ${
                  column.align === 'right' ? 'text-right' : 'text-left'
                } ${i === 0 ? 'left-0 z-20' : ''}`}
              >
                {column.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    aria-label={`Sort by ${column.header}`}
                    className={`inline-flex items-center gap-1 hover:text-primary ${
                      sort?.key === column.key ? 'text-primary' : ''
                    }`}
                  >
                    {column.header}
                    {sort?.key === column.key &&
                      (sort.dir === 'asc' ? (
                        <ChevronUp aria-hidden className="size-3" />
                      ) : (
                        <ChevronDown aria-hidden className="size-3" />
                      ))}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`group ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((column, i) => (
                <td
                  key={column.key}
                  className={`h-10 border-b border-subtle px-3 py-1.5 whitespace-nowrap group-hover:bg-surface-2 ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  } ${i === 0 ? 'sticky left-0 z-[5] bg-base group-hover:bg-surface-2' : ''}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-3 py-4 text-body text-secondary">No rows for this selection.</p>
      )}
    </div>
  )
}
