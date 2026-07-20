// @vitest-environment jsdom
/**
 * LineChart gap handling (§6): missing values stay gaps (never zero-filled),
 * and connectGaps bridges them with a distinct dashed connector so the series
 * still reads as one continuous trend. No NaN/Infinity ever reaches the path.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LineChart, type LineChartSeries } from './LineChart.tsx'

afterEach(cleanup)

const xLabels = ['d1', 'd2', 'd3', 'd4', 'd5']
const series: LineChartSeries[] = [
  { key: 'load', label: 'Daily Workload', color: 'var(--chart-series-1)', values: [5, 6, null, 8, 9] },
]

function paths(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll('path')] as SVGPathElement[]
}

it('connectGaps bridges a missing interval with a dashed connector', () => {
  const { container } = render(
    <LineChart xLabels={xLabels} series={series} connectGaps ariaLabel="daily workload" />,
  )
  const dashed = paths(container).filter((p) => p.getAttribute('stroke-dasharray'))
  expect(dashed.length).toBeGreaterThanOrEqual(1)
  // every path is finite geometry — no zero-fill, no NaN/Infinity
  for (const p of paths(container)) {
    const d = p.getAttribute('d') ?? ''
    expect(d).not.toMatch(/NaN|Infinity/)
  }
})

it('without connectGaps the line breaks at the gap (no dashed bridge)', () => {
  const { container } = render(
    <LineChart xLabels={xLabels} series={series} ariaLabel="daily workload" />,
  )
  const dashed = paths(container).filter((p) => p.getAttribute('stroke-dasharray'))
  expect(dashed.length).toBe(0)
})
