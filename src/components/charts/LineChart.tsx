/**
 * Multi-series SVG line chart — token-pure, no animation (§12.7). Null values
 * break the line into gaps (missing ≠ zero, §6.7); an optional shaded y-band
 * makes threshold ranges visible on the chart itself (§6.9). Always render
 * inside a ChartCard so the accessible table alternative exists.
 */
import { useId } from 'react'

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

export function LineChart({
  xLabels,
  series,
  height = 240,
  yBand = null,
  zeroBased = false,
  formatX = (label) => label,
  formatY = (v) => String(v),
  ariaLabel,
}: {
  xLabels: string[]
  series: LineChartSeries[]
  height?: number
  yBand?: YBand | null
  /** force the y-axis to include zero (sensible for volumes/loads) */
  zeroBased?: boolean
  formatX?: (label: string, index: number) => string
  formatY?: (value: number) => string
  ariaLabel: string
}) {
  const clipId = useId()
  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v !== null)
  if (allValues.length === 0 || xLabels.length === 0) {
    return <p className="py-8 text-center text-label text-muted">no plottable data in this range</p>
  }

  let yMin = Math.min(...allValues)
  let yMax = Math.max(...allValues)
  if (yBand) {
    yMin = Math.min(yMin, yBand.from)
    yMax = Math.max(yMax, yBand.to)
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

  // build per-series path segments, breaking at nulls (gaps stay visible)
  const seriesPaths = series.map((s) => {
    const segments: string[] = []
    let current: string[] = []
    s.values.forEach((v, i) => {
      if (v === null) {
        if (current.length > 0) segments.push(current.join(' '))
        current = []
        return
      }
      current.push(`${current.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    })
    if (current.length > 0) segments.push(current.join(' '))
    const lonePoints = s.values
      .map((v, i) => ({ v, i }))
      .filter(
        ({ v, i }) => v !== null && s.values[i - 1] == null && s.values[i + 1] == null,
      )
    return { series: s, d: segments.join(' '), lonePoints }
  })

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <clipPath id={clipId}>
          <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} />
        </clipPath>

        {yBand && (
          <rect
            x={PAD_L}
            y={y(yBand.to)}
            width={innerW}
            height={Math.max(0, y(yBand.from) - y(yBand.to))}
            fill="var(--status-good)"
            opacity={0.08}
          />
        )}

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 6}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {formatY(t)}
            </text>
          </g>
        ))}
        {yBand && (
          <text
            x={W - PAD_R - 4}
            y={y(yBand.to) + 12}
            textAnchor="end"
            fontSize={10}
            fill="var(--text-muted)"
          >
            {yBand.label}
          </text>
        )}

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

        <g clipPath={`url(#${clipId})`}>
          {seriesPaths.map(({ series: s, d, lonePoints }) => (
            <g key={s.key}>
              {d && (
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {/* isolated observations would be invisible as bare paths */}
              {lonePoints.map(({ v, i }) => (
                <circle key={i} cx={x(i)} cy={y(v!)} r={2.5} fill={s.color} />
              ))}
            </g>
          ))}
        </g>
      </svg>

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
