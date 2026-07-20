/**
 * Multi-series SVG line chart — token-pure, no entrance animation (§12.7).
 * Null values break the line into gaps (missing ≠ zero, §6.7); an optional
 * shaded y-band makes threshold ranges visible on the chart itself (§6.9).
 * Optional monotone smoothing is visual interpolation only — it never moves a
 * plotted point or overshoots the data. A lightweight hover tooltip reads out
 * each series at the nearest x. Always render inside a ChartCard so the
 * accessible table alternative exists.
 */
import { useId, useRef, useState } from 'react'

export interface LineChartSeries {
  key: string
  label: string
  /** CSS color token, e.g. 'var(--chart-series-1)' */
  color: string
  /** aligned to xLabels; null = missing (gap), never zero */
  values: (number | null)[]
}

export interface YBand {
  from: number
  to: number
  label: string
  /** zone fill; defaults to the "good" token when omitted */
  color?: string
}

const W = 720
const PAD_L = 46
const PAD_R = 12
const PAD_T = 10
const PAD_B = 24

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) || 1
    min -= pad / 2
    max += pad / 2
  }
  const span = max - min
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step / 1e6; v += step) ticks.push(Number(v.toPrecision(12)))
  return ticks
}

/** Monotone cubic (Fritsch–Carlson) path through points — no overshoot. */
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n < 3) return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = pts[i + 1]!.x - pts[i]!.x
    slope[i] = (pts[i + 1]!.y - pts[i]!.y) / dx[i]!
  }
  const t: number[] = [slope[0]!]
  for (let i = 1; i < n - 1; i += 1) {
    if (slope[i - 1]! * slope[i]! <= 0) t[i] = 0
    else t[i] = (slope[i - 1]! + slope[i]!) / 2
  }
  t[n - 1] = slope[n - 2]!
  // clamp tangents to keep the curve monotone (no overshoot past the points)
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
    } else {
      const a = t[i]! / slope[i]!
      const b = t[i + 1]! / slope[i]!
      const h = Math.hypot(a, b)
      if (h > 3) {
        t[i] = ((3 / h) * a) * slope[i]!
        t[i + 1] = ((3 / h) * b) * slope[i]!
      }
    }
  }
  let d = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = pts[i]!.x + dx[i]! / 3
    const c1y = pts[i]!.y + (t[i]! * dx[i]!) / 3
    const c2x = pts[i + 1]!.x - dx[i]! / 3
    const c2y = pts[i + 1]!.y - (t[i + 1]! * dx[i]!) / 3
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[i + 1]!.x.toFixed(1)},${pts[i + 1]!.y.toFixed(1)}`
  }
  return d
}

export function LineChart({
  xLabels,
  series,
  height = 240,
  yBand = null,
  yBands,
  pointColors,
  onPointClick,
  selectedIndex = null,
  zeroBased = false,
  smooth = false,
  connectGaps = false,
  formatX = (label) => label,
  formatY = (v) => String(v),
  /** tooltip header per x-index; defaults to the x label */
  tooltipHeaders,
  /** override the tooltip value text for a series at an x-index (e.g. absolute
   *  units when the plotted axis is indexed); return null to show "—" */
  tooltipValueFor,
  ariaLabel,
}: {
  xLabels: string[]
  series: LineChartSeries[]
  height?: number
  yBand?: YBand | null
  /** multiple semantic y zones (e.g. ACWR grey/green/yellow/red) */
  yBands?: YBand[]
  /** per-point marker colour for the first series, aligned to xLabels */
  pointColors?: (string | null)[]
  /** makes each point clickable (a coach can inspect one day) */
  onPointClick?: (index: number) => void
  selectedIndex?: number | null
  zeroBased?: boolean
  smooth?: boolean
  /** bridge missing intervals with a dashed connector so the line reads as one
   *  continuous trend (still no zero-fill; the gap stays visually distinct) */
  connectGaps?: boolean
  formatX?: (label: string, index: number) => string
  formatY?: (value: number) => string
  tooltipHeaders?: string[]
  tooltipValueFor?: (seriesIndex: number, xIndex: number) => string | null
  ariaLabel: string
}) {
  const clipId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v !== null)
  if (allValues.length === 0 || xLabels.length === 0) {
    return <p className="py-8 text-center text-label text-muted">no plottable data in this range</p>
  }

  const zones = yBands ?? (yBand ? [yBand] : [])
  let yMin = Math.min(...allValues)
  let yMax = Math.max(...allValues)
  for (const z of zones) {
    if (Number.isFinite(z.from)) yMin = Math.min(yMin, z.from)
    if (Number.isFinite(z.to)) yMax = Math.max(yMax, z.to)
  }
  if (zeroBased) yMin = Math.min(0, yMin)
  const spanPad = (yMax - yMin || Math.abs(yMax) || 1) * 0.06
  yMin -= zeroBased && yMin === 0 ? 0 : spanPad
  yMax += spanPad

  const innerW = W - PAD_L - PAD_R
  const innerH = height - PAD_T - PAD_B
  const x = (i: number) =>
    PAD_L + (xLabels.length === 1 ? innerW / 2 : (i / (xLabels.length - 1)) * innerW)
  const y = (v: number) => PAD_T + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  const ticks = niceTicks(yMin, yMax)

  // ~6 x tick labels max, always including first and last
  const stepX = Math.max(1, Math.ceil(xLabels.length / 6))
  const xTickIdx = xLabels.map((_, i) => i).filter((i) => i % stepX === 0 || i === xLabels.length - 1)

  // build per-series path segments. Missing values (null) break the solid line
  // into runs of consecutive observations — never zero-filled (§6.7). When
  // connectGaps is set, a dashed connector bridges each missing interval so the
  // series still reads as ONE continuous trend, while the gap stays visible as a
  // distinct style (the underlying data and its missing metadata are untouched).
  const seriesPaths = series.map((s) => {
    const runs: { x: number; y: number }[][] = []
    let current: { x: number; y: number }[] = []
    const flush = () => {
      if (current.length > 0) runs.push(current)
      current = []
    }
    s.values.forEach((v, i) => {
      if (v === null) {
        flush()
        return
      }
      current.push({ x: x(i), y: y(v) })
    })
    flush()
    const runPath = (run: { x: number; y: number }[]) =>
      smooth
        ? monotonePath(run)
        : run.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const d = runs.map(runPath).join(' ')
    // straight dashed bridge from the end of each run to the start of the next
    const bridge = connectGaps
      ? runs
          .slice(1)
          .map((run, k) => {
            const a = runs[k]![runs[k]!.length - 1]!
            const b = run[0]!
            return `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`
          })
          .join(' ')
      : ''
    // a solitary observation (no neighbours) is invisible as a bare path; when
    // connectGaps bridges to it on at least one side it no longer needs a dot
    const lonePoints = s.values
      .map((v, i) => ({ v, i }))
      .filter(
        ({ v, i }) =>
          v !== null &&
          s.values[i - 1] == null &&
          s.values[i + 1] == null &&
          !(connectGaps && runs.length > 1),
      )
    return { series: s, d, bridge, lonePoints }
  })

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * W
    // nearest x index
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < xLabels.length; i += 1) {
      const d = Math.abs(x(i) - vx)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    setHover(best)
  }

  const hoverX = hover === null ? null : x(hover)
  const tooltipRight = hoverX !== null && hoverX > PAD_L + innerW * 0.6

  return (
    <div className="relative flex flex-col gap-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <clipPath id={clipId}>
          <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} />
        </clipPath>

        {zones.map((z, i) => {
          const top = y(Math.min(z.to, yMax))
          const bottom = y(Math.max(z.from, yMin))
          return (
            <rect
              key={`${z.label}-${i}`}
              x={PAD_L}
              y={top}
              width={innerW}
              height={Math.max(0, bottom - top)}
              fill={z.color ?? 'var(--status-good)'}
              opacity={0.1}
            />
          )
        })}

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border-subtle)"
              strokeWidth={1}
              opacity={0.6}
            />
            <text x={PAD_L - 6} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {formatY(t)}
            </text>
          </g>
        ))}
        {zones.map((z, i) => (
          <text
            key={`lbl-${z.label}-${i}`}
            x={W - PAD_R - 4}
            y={Math.max(PAD_T + 10, y(Math.min(z.to, yMax)) + 11)}
            textAnchor="end"
            fontSize={10}
            fill="var(--text-muted)"
          >
            {z.label}
          </text>
        ))}

        {xTickIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            fontSize={11}
            fill="var(--text-muted)"
          >
            {formatX(xLabels[i]!, i)}
          </text>
        ))}

        {/* hover guide line */}
        {hoverX !== null && (
          <line
            x1={hoverX}
            x2={hoverX}
            y1={PAD_T}
            y2={PAD_T + innerH}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
        )}

        <g clipPath={`url(#${clipId})`}>
          {seriesPaths.map(({ series: s, d, bridge, lonePoints }, si) => (
            <g key={s.key}>
              {bridge && (
                <path
                  d={bridge}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.25}
                  strokeDasharray="5 4"
                  opacity={0.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {d && (
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {/* isolated observations would be invisible as bare paths */}
              {lonePoints.map(({ v, i }) => (
                <circle key={i} cx={x(i)} cy={y(v!)} r={2.5} fill={s.color} />
              ))}
              {/* per-point semantic markers (e.g. ACWR band colours) */}
              {si === 0 &&
                pointColors &&
                s.values.map((v, i) =>
                  v === null ? null : (
                    <circle
                      key={`pt-${i}`}
                      cx={x(i)}
                      cy={y(v)}
                      r={selectedIndex === i ? 5 : 3.5}
                      fill={pointColors[i] ?? s.color}
                      stroke="var(--bg-surface)"
                      strokeWidth={selectedIndex === i ? 2 : 1}
                    />
                  ),
                )}
              {/* emphasize the hovered point */}
              {hover !== null && s.values[hover] != null && (
                <circle cx={x(hover)} cy={y(s.values[hover]!)} r={3.5} fill={s.color} stroke="var(--surface)" strokeWidth={1.5} />
              )}
            </g>
          ))}
        </g>

        {/* click targets — a coach can inspect any single day */}
        {onPointClick &&
          xLabels.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={x(i) - Math.max(6, innerW / xLabels.length / 2)}
              y={PAD_T}
              width={Math.max(12, innerW / xLabels.length)}
              height={innerH}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onPointClick(i)}
            />
          ))}
      </svg>

      {hover !== null && (
        <div
          className={`pointer-events-none absolute top-2 z-20 w-max max-w-[16rem] rounded-card border border-subtle bg-surface p-2 text-label shadow-lg ${
            tooltipRight ? 'right-2' : 'left-12'
          }`}
        >
          <p className="mb-1 font-medium text-secondary">
            {tooltipHeaders?.[hover] ?? formatX(xLabels[hover]!, hover)}
          </p>
          <ul className="flex flex-col gap-0.5">
            {series.map((s, si) => {
              const raw = s.values[hover]
              const text =
                tooltipValueFor?.(si, hover) ?? (raw == null ? '—' : formatY(raw))
              return (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-secondary">{s.label}</span>
                  <span className="tabular ml-auto pl-3 font-medium">{text}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-label text-secondary">
              <span
                aria-hidden
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
