/**
 * Horizontal stacked distribution with legend and counts. Segments can be
 * clickable (reveal-in-place lists). Meaning is carried by labels and counts,
 * never color alone (§12.2); colors come from tokens via the caller.
 */
export interface DistributionSegment {
  key: string
  label: string
  count: number
  /** CSS color token, e.g. 'var(--status-good)' */
  color: string
}

export function DistributionBar({
  segments,
  selectedKey,
  onSelect,
}: {
  segments: DistributionSegment[]
  selectedKey?: string | null
  onSelect?: (key: string | null) => void
}) {
  const total = segments.reduce((a, s) => a + s.count, 0)

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(', ')}
      >
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.key}
                style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
                className={selectedKey && selectedKey !== s.key ? 'opacity-40' : ''}
              />
            ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => {
          const content = (
            <>
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.label}</span>
              <span className="tabular font-semibold">{s.count}</span>
            </>
          )
          return onSelect ? (
            <button
              key={s.key}
              type="button"
              aria-pressed={selectedKey === s.key}
              onClick={() => onSelect(selectedKey === s.key ? null : s.key)}
              className={`inline-flex items-center gap-1.5 rounded-control px-1.5 py-0.5 text-label hover:bg-surface-2 ${
                selectedKey === s.key ? 'bg-surface-2 text-primary' : 'text-secondary'
              }`}
            >
              {content}
            </button>
          ) : (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-label text-secondary"
            >
              {content}
            </span>
          )
        })}
      </div>
    </div>
  )
}
