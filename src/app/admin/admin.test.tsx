// @vitest-environment jsdom
/**
 * Admin customization round-trip: edits made in KPI Settings and Data
 * Management flow through the settings seam into the coach-facing pages
 * (same repository instance, like one browser session).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { DashboardDataProviderBoundary } from '../../lib/dashboard/DashboardDataContext.tsx'
import { dashboardFixture } from '../../lib/dashboard/test-fixture.ts'
import { createMemorySettingsRepository } from '../../lib/settings/local-settings.ts'
import { SettingsProvider } from '../../lib/settings/SettingsContext.tsx'
import type { SettingsRepository } from '../../lib/settings/types.ts'
import type { DashboardDataProvider as DataProvider } from '../../lib/dashboard/types.ts'
import { TeamDashboardPage } from '../overview/TeamDashboardPage.tsx'
import { DataManagementPage } from './DataManagementPage.tsx'
import { KpiSettingsPage } from './KpiSettingsPage.tsx'

const provider: DataProvider = {
  load: () => Promise.resolve(dashboardFixture()),
  savedViews: { list: () => [], save: () => undefined, remove: () => undefined },
  availability: { loadOverrides: () => [], saveOverride: () => undefined },
}

function renderWith(repo: SettingsRepository, ui: React.ReactNode) {
  return render(
    <SettingsProvider repository={repo}>
      <DashboardDataProviderBoundary provider={provider}>{ui}</DashboardDataProviderBoundary>
    </SettingsProvider>,
  )
}

afterEach(cleanup)

it('KPI Settings edits flow into the effective registry', async () => {
  const repo = createMemorySettingsRepository()
  renderWith(repo, <KpiSettingsPage />)

  // open the editor for total_distance and rename it
  fireEvent.click(await screen.findByText('total_distance'))
  const drawer = await screen.findByRole('dialog')
  fireEvent.change(within(drawer).getByLabelText('Display name'), {
    target: { value: 'Distance Covered' },
  })
  fireEvent.change(within(drawer).getByLabelText('Display unit'), { target: { value: 'm' } })
  fireEvent.click(within(drawer).getByRole('button', { name: 'Save KPI settings' }))

  // the registry table now shows the effective values + customized badge
  expect(await screen.findByText('Distance Covered')).toBeTruthy()
  expect(screen.getByText('customized')).toBeTruthy()
  // persisted through the repository (survives reload)
  expect(repo.load().kpi['total_distance']).toMatchObject({
    displayName: 'Distance Covered',
    displayUnit: 'm',
  })
})

it('Data Management hides a widget and the Team Dashboard honors it', async () => {
  const repo = createMemorySettingsRepository()
  const dm = renderWith(repo, <DataManagementPage />)
  const widgetsPanel = (await dm.findByText('Overview widgets')).closest('section')!
  const availabilityToggle = within(widgetsPanel as HTMLElement)
    .getByText('Availability')
    .closest('label')!
    .querySelector('input')!
  fireEvent.click(availabilityToggle)
  expect(repo.load().layout.hiddenWidgets).toContain('availability')
  dm.unmount()

  renderWith(repo, <TeamDashboardPage />)
  await screen.findByText('Athlete Flags')
  expect(screen.queryByText('Availability')).toBeNull()
  expect(screen.getByText('Load Health')).toBeTruthy()
})
