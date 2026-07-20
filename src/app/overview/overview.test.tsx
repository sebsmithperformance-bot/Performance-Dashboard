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
import { TeamSnapshotPage } from './TeamSnapshotPage.tsx'

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

it('Team Snapshot is a grid of clickable tiles only — no tables/charts on the page', async () => {
  const { container } = renderWithProvider(<TeamSnapshotPage />)

  await screen.findByText('Team Snapshot')
  // the seven tiles are present as buttons; the page itself carries no table
  for (const label of [
    'Availability',
    'Workload',
    'Load Health',
    'Speed Flags',
    'Last Session GPS',
    'S&C Change',
    'Data Completeness',
  ]) {
    const tile = screen.getByText(label).closest('button')!
    expect(tile.tagName).toBe('BUTTON')
    expect(within(tile).getByText('View details')).toBeTruthy()
  }
  expect(container.querySelector('table')).toBeNull()
})

it('clicking the Availability tile opens its drill-down drawer', async () => {
  renderWithProvider(<TeamSnapshotPage />)
  await screen.findByText('Team Snapshot')
  fireEvent.click(screen.getByText('Availability').closest('button')!)

  const drawer = await screen.findByRole('dialog')
  // roster breakdown + status filter reveal-in-place inside the drawer
  fireEvent.click(within(drawer).getByRole('button', { name: /Limited/ }))
  expect(await within(drawer).findByText('Lift only')).toBeTruthy()
})

it('Load Health and Speed Flags drawers keep observation language and transparent rules', async () => {
  renderWithProvider(<TeamSnapshotPage />)
  await screen.findByText('Team Snapshot')

  fireEvent.click(screen.getByText('Load Health').closest('button')!)
  const lhDrawer = await screen.findByRole('dialog')
  expect(within(lhDrawer).getByText(/observations, not predictions/)).toBeTruthy()
  fireEvent.keyDown(window, { key: 'Escape' })

  fireEvent.click(screen.getByText('Speed Flags').closest('button')!)
  const flagDrawer = await screen.findByRole('dialog')
  expect(within(flagDrawer).getByText(/Ada Fast — 86\.1% of baseline top speed/)).toBeTruthy()
  expect(within(flagDrawer).getByText(/exposure 58 min/)).toBeTruthy()
})

it('S&C Change drawer refuses zero baselines with a stated reason', async () => {
  renderWithProvider(<TeamSnapshotPage />)
  await screen.findByText('Team Snapshot')
  fireEvent.click(screen.getByText('S&C Change').closest('button')!)
  const drawer = await screen.findByRole('dialog')
  fireEvent.change(within(drawer).getByLabelText('KPI'), {
    target: { value: 'power_clean_top_load' },
  })
  fireEvent.change(within(drawer).getByLabelText('Basis'), { target: { value: 'prior_session' } })
  fireEvent.click(within(drawer).getByRole('button', { name: /No comparison/ }))
  expect(await within(drawer).findByText(/baseline is zero — change not calculated/)).toBeTruthy()
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
