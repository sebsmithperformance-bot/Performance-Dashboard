import { Medal } from 'lucide-react'

export interface PodiumEntry {
  id: string
  name: string
  detail?: string
  points: number
  rank: number
}

const PLACE_STYLE = [
  'order-2 border-t-[var(--status-warning)]', // 1st (center, gold-ish via warning tone)
  'order-1 border-t-[var(--border-strong)]', // 2nd (left)
  'order-3 border-t-[var(--accent)]', // 3rd (right)
]
const PLACE_HEIGHT = ['h-32', 'h-24', 'h-20']

/** §10 podium: top three raised, with fourth place listed below. */
export function Podium({ entries, unit = 'pts' }: { entries: PodiumEntry[]; unit?: string }) {
  const top3 = entries.slice(0, 3)
  const fourth = entries[3]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 items-end gap-3">
        {top3.map((e, i) => (
          <div key={e.id} className={`flex flex-col ${PLACE_STYLE[i]}`}>
            <div className="flex flex-col items-center gap-1 pb-2 text-center">
              <Medal
                aria-hidden
                className={`size-5 ${i === 0 ? 'text-[var(--status-warning)]' : i === 1 ? 'text-[var(--text-muted)]' : 'text-[var(--accent)]'}`}
              />
              <span className="truncate text-body font-semibold">{e.name}</span>
              {e.detail && <span className="text-label text-muted">{e.detail}</span>}
              <span className="tabular text-kpi font-bold">{e.points}</span>
              <span className="text-label text-muted">{unit}</span>
            </div>
            <div
              className={`flex ${PLACE_HEIGHT[i]} items-start justify-center rounded-t-card border border-b-0 border-subtle border-t-2 bg-surface-2 pt-2`}
            >
              <span className="tabular text-widget font-bold text-secondary">{e.rank}</span>
            </div>
          </div>
        ))}
      </div>
      {fourth && (
        <div className="flex items-center gap-3 rounded-card border border-subtle bg-surface px-4 py-2">
          <span className="tabular w-6 text-center text-body font-semibold text-muted">
            {fourth.rank}
          </span>
          <span className="text-body font-medium">{fourth.name}</span>
          {fourth.detail && <span className="text-label text-muted">{fourth.detail}</span>}
          <span className="tabular ml-auto text-body font-semibold">
            {fourth.points} {unit}
          </span>
        </div>
      )}
    </div>
  )
}
