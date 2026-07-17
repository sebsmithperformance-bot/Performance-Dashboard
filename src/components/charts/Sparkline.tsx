/** Minimal token-pure SVG sparkline; no animation (§12.7). */
export function Sparkline({
  values,
  color,
  width = 120,
  height = 32,
  ariaLabel,
}: {
  values: number[]
  color: string
  width?: number
  height?: number
  ariaLabel: string
}) {
  if (values.length < 2) {
    return <span className="text-label text-muted">not enough data</span>
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 2
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2)
      const y = height - pad - ((v - min) / span) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}
