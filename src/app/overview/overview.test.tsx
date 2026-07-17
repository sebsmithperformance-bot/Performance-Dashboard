// @vitest-environment jsdom
/**
 * Overview page tests: tiles and the Athletes table render real fixture data
 * through the dashboard seam; compact states, reveal-in-place, same-date
 * session switching, drawer, and missing-vs-zero display all behave.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { DashboardDataProviderBoundary } from '../../lib/dashboard/DashboardDataContext.tsx'
import { dashboardFixture } from '../../lib/dashboard/test-fixture.ts'
import { createMemorySettingsRepository } from '../../lib/settings/local-settings.ts'
import { SettingsProvider } from '../../lib/settings/SettingsContext.tsx'
import type { DashboardDataProvider, SavedView } from '../../lib/dashboard/types.ts'
import { AthletesPage } from './AthletesPage.tsx'
import { TeamDashboardPage } from './TeamDashboardPage.tsx'

function memoryViews(): DashboardDataProvider['savedViews'] {
  const views: SavedView[] = []
  return {
    list: (page) => views.filter((v) => v.page === page),
    save: (view) => {
      const i = views.findIndex((v) => v.page === view.page && v.name === view.name)
      if (i >= 0) views[i] = view
      else views.push(view)
    },
    remove: (page, name) => {
      const i = views.findIndex((v) => v.page === page && v.name === name)
      if (i >= 0) views.splice(i, 1)
    },
  }
}

const provider: DashboardDataProvider = {
  load: () => Promise.resolve(dashboardFixture()),
  savedViews: memoryViews(),
  availability: { loadOverrides: () => [], saveOverride: () => undefined },
}

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <SettingsProvider repository={createMemorySettingsRepository()}>
      <DashboardDataProviderBoundary provider={provider}>{ui}</DashboardDataProviderBoundary>
    </SettingsProvider>,
  )
}

afterEach(cleanup)

it('Team Dashboard renders all five tiles from the seam with correct content', async () => {
  renderWithProvider(<TeamDashboardPage />)

  // availability tile: counts + reveal-in-place
  await screen.findByText('Availability')
  fireEvent.click(screen.getByText('Limited').closest('button')!)
  expect(await screen.findByText('Lift only')).toBeTruthy()

  // last session + flags tiles both reference the latest game
  expect(screen.getByText('Last Session GPS')).toBeTruthy()
  expect(screen.getAllByText(/Game W2/).length).toBeGreaterThanOrEqual(2)

  // load health: early-season honesty — incomplete, no fabricated ACWR
  expect(screen.getByText('Load Health')).toBeTruthy()
  expect(screen.getAllByText(/Incomplete data/).length).toBeGreaterThan(0)
  expect(screen.getByText(/not injury predictions/)).toBeTruthy()

  // flags: Ada flagged with transparent rule + exposure context; Bea insufficient, separate
  expect(screen.getByText(/Ada Fast — 86\.1% of baseline top speed/)).toBeTruthy()
  expect(screen.getByText(/exposure 58 min/)).toBeTruthy()
  const insufficientToggle = screen.getByRole('button', {
    name: /1 athlete with insufficient baseline/,
  })
  fireEvent.click(insufficientToggle)
  expect(screen.getByText(/Bea Steady · Midfielder · 1\/3 baseline sessions/)).toBeTruthy()
})

it('tiles condense to their compact state and expand back', async () => {
  renderWithProvider(<TeamDashboardPage />)
  const availabilityHeader = (await screen.findByText('Availability')).closest('button')!
  expect(availabilityHeader.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(availabilityHeader)
  expect(availabilityHeader.getAttribute('aria-expanded')).toBe('false')
  expect(within(availabilityHeader).getByText(/1\/3 Full Go/)).toBeTruthy()
})

it('S&C tile refuses zero baselines with a stated reason', async () => {
  renderWithProvider(<TeamDashboardPage />)
  await screen.findByText('S&C % Change')
  fireEvent.change(screen.getByLabelText('KPI'), { target: { value: 'power_clean_top_load' } })
  fireEvent.change(screen.getByLabelText('Basis'), { target: { value: 'prior_session' } })
  fireEvent.click(screen.getByRole('button', { name: /No comparison/ }))
  expect(await screen.findByText(/baseline is zero — change not calculated/)).toBeTruthy()
})

it('Athletes page: same-date sessions stay separate; lift session swaps the KPI catalog', async () => {
  renderWithProvider(<AthletesPage />)
  await screen.findByLabelText('Date')
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-04' } })

  // three sessions that day → session select appears; switch to the lift
  const sessionSelect = await screen.findByLabelText('Session')
  fireEvent.change(sessionSelect, { target: { value: 'L3' } })
  expect((await screen.findAllByText('back_squat_top_load')).length).toBeGreaterThan(0)

  // drawer via row click shows values and the missing-vs-zero explanation
  fireEvent.click(screen.getAllByText('Ada Fast')[0]!)
  expect(await screen.findByRole('dialog')).toBeTruthy()
  expect(screen.getByText(/distinct from a true zero/)).toBeTruthy()
})

it('Athletes page marks device-missing data as “—”, never zero', async () => {
  renderWithProvider(<AthletesPage />)
  await screen.findByLabelText('Date')
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-02' } })
  await screen.findByText(/Game W1/)
  const row = screen.getAllByText('Bea Steady')[0]!.closest('tr')!
  expect(within(row).getByText('no device data')).toBeTruthy()
  expect(within(row).getAllByLabelText('no data').length).toBeGreaterThan(0)
  expect(within(row).queryByText('0')).toBeNull()
})

it('saved views round-trip through the provider store', async () => {
  renderWithProvider(<AthletesPage />)
  await screen.findByLabelText('Date')
  fireEvent.click(screen.getByRole('button', { name: /Midfielders/ }))
  fireEvent.change(screen.getByLabelText('New view name'), { target: { value: 'mids' } })
  fireEvent.click(screen.getByRole('button', { name: /Save view/ }))

  fireEvent.click(screen.getByRole('button', { name: 'All' })) // change away
  fireEvent.change(screen.getByLabelText('Saved view'), { target: { value: 'mids' } })
  const midfielderChip = screen.getByRole('button', { name: /Midfielders/ })
  expect(midfielderChip.getAttribute('aria-pressed')).toBe('true')
})
