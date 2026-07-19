/**
 * Percentile radar (§5.4): spokes are 0–100 direction-aware percentile ranks.
 * Multiple series (e.g. the athlete vs the team average) share one 0–100 scale
 * and a legend. Spokes without a valid percentile for a series are skipped for
 * that series — never plotted as zero (§6.7). No combined score exists (§6.2).
 */
export interface RadarSeries {
  key: string
  label: string
  /** CSS color token, e.g. 'var(--chart-series-1)' */
  color: string
  /** 0–100 percentile per axis, aligned to `axes`; null = not computable */
  values: (number | null)[]
}

const SIZE = 340
const CX = SIZE / 2
const CY = SIZE / 2
const R = 112
const RINGS = [25, 50, 75, 100]

function polar(angle: number, radius: number): [number, number] {
  return [CX + radius * Math.sin(angle), CY - radius * Math.cos(angle)]
}

export function RadarChart({
  axes,
  series,
  ariaLabel,
}: {
  axes: { key: string; label: string }[]
  series: RadarSeries[]
  ariaLabel: string
}) {
  if (axes.length < 3) {
    return (
      <p className="py-8 text-center text-label text-muted">
        needs at least three metrics to draw a radar
      </p>
    )
  }
  const angleOf = (i: number) => (i / axes.length) * Math.PI * 2

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-sm"
        role="img"
        aria-label={ariaLabel}
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={axes.map((_, i) => polar(angleOf(i), (ring / 100) * R).join(',')).join(' ')}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={1}
          />
        ))}
        {axes.map((axis, i) => {
          const [sx, sy] = polar(angleOf(i), R)
          const [lx, ly] = polar(angleOf(i), R + 22)
          return (
            <g key={axis.key}>
              <line x1={CX} y1={CY} x2={sx} y2={sy} stroke="var(--border-subtle)" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
                {axis.label}
              </text>
            </g>
          )
        })}
        <text x={CX} y={CY - R * 0.5 + 3} textAnchor="middle" fontSize={8} fill="var(--text-muted)">
          P50
        </text>

        {series.map((s) => {
          const valid = s.values
            .map((v, i) => ({ v, i }))
            .filter((e): e is { v: number; i: number } => e.v !== null)
          const polygon =
            valid.length >= 3
              ? valid.map(({ v, i }) => polar(angleOf(i), (v / 100) * R).join(',')).join(' ')
              : null
          return (
            <g key={s.key}>
              {polygon && (
                <>
                  <polygon points={polygon} fill={s.color} opacity={0.14} />
                  <polygon
                    points={polygon}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={1.75}
                    strokeLinejoin="round"
                  />
                </>
              )}
              {valid.map(({ v, i }) => {
                const [px, py] = polar(angleOf(i), (v / 100) * R)
                return <circle key={i} cx={px} cy={py} r={2.5} fill={s.color} />
              })}
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-label text-secondary">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
