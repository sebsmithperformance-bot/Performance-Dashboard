/**
 * Horizontal grouped bar chart: one row per category (athlete), one bar per
 * series (session/metric). CSS-driven so rows stay readable at any count;
 * missing values render as an explicit "—", never a zero-length bar (§6.7).
 */
export interface HBarSeries {
  key: string
  label: string
  color: string
}

export interface HBarRow {
  key: string
  label: string
  sublabel?: string
  /** aligned to series; null = no observation */
  values: (number | null)[]
}

export function HBarChart({
  series,
  rows,
  formatValue = (v) => String(v),
  ariaLabel,
}: {
  series: HBarSeries[]
  rows: HBarRow[]
  formatValue?: (value: number) => string
  ariaLabel: string
}) {
  const max = Math.max(
    1e-9,
    ...rows.flatMap((r) => r.values).filter((v): v is number => v !== null),
  )

  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-3">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-label text-secondary">
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[10rem_1fr] items-center gap-3">
            <span className="truncate text-body">
              {row.label}
              {row.sublabel && <span className="ml-1.5 text-label text-muted">{row.sublabel}</span>}
            </span>
            <div className="flex flex-col gap-1">
              {row.values.map((value, i) => (
                <div key={series[i]?.key ?? i} className="flex items-center gap-2">
                  {value === null ? (
                    <span className="text-label text-muted">— no data</span>
                  ) : (
                    <>
                      <div
                        aria-hidden
                        className="h-2.5 rounded-sm"
                        style={{
                          width: `${Math.max(0.75, (value / max) * 100)}%`,
                          backgroundColor: series[i]?.color,
                        }}
                      />
                      <span className="tabular shrink-0 text-label text-secondary">
                        {formatValue(value)}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 && (
        <p className="py-4 text-center text-label text-muted">no rows for this selection</p>
      )}
    </div>
  )
}
