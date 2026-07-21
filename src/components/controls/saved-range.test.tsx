// @vitest-environment jsdom
/**
 * §6 shared saved ranges: save/select/persist, and each scope keeps its own
 * list so a Competition range never touches a Performance Dashboard range.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useState } from 'react'
import { createMemorySettingsRepository } from '../../lib/settings/local-settings.ts'
import { SettingsProvider } from '../../lib/settings/SettingsContext.tsx'
import type { SettingsRepository } from '../../lib/settings/types.ts'
import { SavedRangeControl, type DateRange } from './SavedRangeControl.tsx'

afterEach(cleanup)

function Harness({ scope, repo }: { scope: string; repo: SettingsRepository }) {
  const [range, setRange] = useState<DateRange>({ from: '2026-08-01', to: '2026-09-01' })
  return (
    <SettingsProvider repository={repo}>
      <span data-testid="active">{`${range.from}|${range.to}`}</span>
      <SavedRangeControl scope={scope} value={range} onChange={setRange} />
    </SettingsProvider>
  )
}

it('saves a named range and persists it under its scope', () => {
  const repo = createMemorySettingsRepository()
  render(<Harness scope="data-trends-performance" repo={repo} />)

  fireEvent.change(screen.getByLabelText('New range name'), { target: { value: 'Preseason' } })
  fireEvent.click(screen.getByRole('button', { name: /Save range/ }))

  const saved = repo.load().savedRanges['data-trends-performance']
  expect(saved).toHaveLength(1)
  expect(saved![0]).toMatchObject({ label: 'Preseason', from: '2026-08-01', to: '2026-09-01' })
  // no NaN/Infinity leaked into stored dates
  expect(JSON.stringify(saved)).not.toMatch(/NaN|Infinity/)
})

it('keeps scopes independent — saving in one leaves the other empty', () => {
  const repo = createMemorySettingsRepository()
  const { unmount } = render(<Harness scope="competition" repo={repo} />)
  fireEvent.change(screen.getByLabelText('New range name'), { target: { value: 'Fall block' } })
  fireEvent.click(screen.getByRole('button', { name: /Save range/ }))
  unmount()

  const settings = repo.load()
  expect(settings.savedRanges['competition']).toHaveLength(1)
  expect(settings.savedRanges['data-trends-performance']).toBeUndefined()
})

it('selecting a saved range applies its dates to the active value', () => {
  const repo = createMemorySettingsRepository()
  const base = repo.load()
  repo.save({
    ...base,
    savedRanges: {
      'data-trends-performance': [
        { id: 'r1', label: 'September', from: '2026-09-01', to: '2026-09-30' },
      ],
    },
  })
  render(<Harness scope="data-trends-performance" repo={repo} />)

  fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'r1' } })
  expect(screen.getByTestId('active').textContent).toBe('2026-09-01|2026-09-30')
})
