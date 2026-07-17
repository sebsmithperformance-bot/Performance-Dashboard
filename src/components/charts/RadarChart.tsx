/**
 * Percentile radar (§5.4): spokes are 0–100 direction-aware percentile ranks.
 * Spokes without a valid percentile are drawn as "n/a" and excluded from the
 * polygon — never plotted as zero (§6.7). No combined score exists anywhere.
 */
export interface RadarAxis {
  key: string
  label: string
  /** 0–100 percentile, or null when not computable */
  value: number | null
}

const SIZE = 340
const CX = SIZE / 2
const CY = SIZE / 2
const R = 118
const RINGS = [25, 50, 75, 100]

function polar(angle: number, radius: number): [number, number] {
  return [CX + radius * Math.sin(angle), CY - radius * Math.cos(angle)]
}

export function RadarChart({ axes, ariaLabel }: { axes: RadarAxis[]; ariaLabel: string }) {
  if (axes.length < 3) {
    return (
      <p className="py-8 text-center text-label text-muted">
        needs at least three metrics to draw a radar
      </p>
    )
  }
  const angleOf = (i: number) => (i / axes.length) * Math.PI * 2

  const valid = axes
    .map((axis, i) => ({ axis, i }))
    .filter((entry): entry is { axis: RadarAxis & { value: number }; i: number } =>
      entry.axis.value !== null,
    )
  const polygon =
    valid.length >= 3
      ? valid
          .map(({ axis, i }) => polar(angleOf(i), (axis.value / 100) * R).join(','))
          .join(' ')
      : null

  return (
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
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              fontSize={10}
              fill={axis.value === null ? 'var(--text-muted)' : 'var(--text-secondary)'}
            >
              <tspan x={lx} dy={-2}>
                {axis.label}
              </tspan>
              <tspan x={lx} dy={11} fontSize={9} fill="var(--text-muted)">
                {axis.value === null ? 'n/a' : `P${Math.round(axis.value)}`}
              </tspan>
            </text>
          </g>
        )
      })}
      <text x={CX} y={CY - R * 0.5 + 3} textAnchor="middle" fontSize={8} fill="var(--text-muted)">
        P50
      </text>
      {polygon && (
        <>
          <polygon
            points={polygon}
            fill="var(--chart-series-1)"
            opacity={0.18}
          />
          <polygon
            points={polygon}
            fill="none"
            stroke="var(--chart-series-1)"
            strokeWidth={1.75}
            strokeLinejoin="round"
          />
          {valid.map(({ axis, i }) => {
            const [px, py] = polar(angleOf(i), (axis.value / 100) * R)
            return <circle key={axis.key} cx={px} cy={py} r={2.5} fill="var(--chart-series-1)" />
          })}
        </>
      )}
    </svg>
  )
}
