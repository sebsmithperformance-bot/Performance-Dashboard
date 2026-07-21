// @vitest-environment jsdom
/**
 * Admin customization round-trip: edits made in Metric Settings and Layout &
 * Navigation flow through the settings seam into the coach-facing pages (same
 * repository instance, like one browser session).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { DashboardDataProviderBoundary } from '../../lib/dashboard/DashboardDataContext.tsx'
import { dashboardFixture } from '../../lib/dashboard/test-fixture.ts'
import { createMemorySettingsRepository } from '../../lib/settings/local-settings.ts'
import { SettingsProvider } from '../../lib/settings/SettingsContext.tsx'
import type { SettingsRepository } from '../../lib/settings/types.ts'
import type { DashboardDataProvider as DataProvider } from '../../lib/dashboard/types.ts'
import { TeamSnapshotPage } from '../overview/TeamSnapshotPage.tsx'
import { LayoutNavigationPage } from './LayoutNavigationPage.tsx'
import { MetricSettingsPage } from './MetricSettingsPage.tsx'

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

it('Metric Settings edits flow into the effective registry', async () => {
  const repo = createMemorySettingsRepository()
  renderWith(repo, <MetricSettingsPage />)

  // open the editor for total_distance and rename it
  fireEvent.click(await screen.findByText('total_distance'))
  const drawer = await screen.findByRole('dialog')
  fireEvent.change(within(drawer).getByLabelText('Display name'), {
    target: { value: 'Distance Covered' },
  })
  fireEvent.change(within(drawer).getByLabelText('Display unit'), { target: { value: 'm' } })
  fireEvent.click(within(drawer).getByRole('button', { name: 'Save metric settings' }))

  // the registry table now shows the effective values + customized badge
  expect(await screen.findByText('Distance Covered')).toBeTruthy()
  expect(screen.getByText('customized')).toBeTruthy()
  // persisted through the repository (survives reload)
  expect(repo.load().kpi['total_distance']).toMatchObject({
    displayName: 'Distance Covered',
    displayUnit: 'm',
  })
})

it('Add Metric validates, persists a definition, and rejects a duplicate name', async () => {
  const repo = createMemorySettingsRepository()
  renderWith(repo, <MetricSettingsPage />)

  fireEvent.click(await screen.findByRole('button', { name: /Add Metric/ }))
  const drawer = await screen.findByRole('dialog')
  const addButton = within(drawer).getByRole('button', { name: 'Add Metric' })
  // required field: disabled until a display name is entered
  expect(addButton).toHaveProperty('disabled', true)

  fireEvent.change(within(drawer).getByLabelText('Display name'), {
    target: { value: 'Repeated Sprint Efforts' },
  })
  expect(within(drawer).getByText('repeated_sprint_efforts')).toBeTruthy()
  expect(addButton).toHaveProperty('disabled', false)
  fireEvent.click(addButton)

  // persisted through the seam and injected into the effective registry
  const saved = repo.load().customKpis
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ key: 'repeated_sprint_efforts', source: 'TeamBuildr' })
  expect(await screen.findByText('Repeated Sprint Efforts')).toBeTruthy()
  expect(screen.getByText('custom')).toBeTruthy()

  // a duplicate display name is rejected (Add disabled, message shown)
  fireEvent.click(screen.getByRole('button', { name: /Add Metric/ }))
  const drawer2 = await screen.findByRole('dialog')
  fireEvent.change(within(drawer2).getByLabelText('Display name'), {
    target: { value: 'repeated sprint efforts' },
  })
  expect(within(drawer2).getByText('name already used')).toBeTruthy()
  expect(within(drawer2).getByRole('button', { name: 'Add Metric' })).toHaveProperty('disabled', true)
})

it('Layout & Navigation hides a Team Snapshot widget and the page honors it', async () => {
  const repo = createMemorySettingsRepository()
  const dm = renderWith(repo, <LayoutNavigationPage />)
  const widgetList = (await dm.findByLabelText('Team Snapshot widgets')) as HTMLElement
  const availabilityToggle = within(widgetList)
    .getByText('Availability')
    .closest('label')!
    .querySelector('input')!
  fireEvent.click(availabilityToggle)
  expect(repo.load().layout.hiddenWidgets).toContain('availability')
  dm.unmount()

  renderWith(repo, <TeamSnapshotPage />)
  await screen.findByText('Speed Flags')
  expect(screen.queryByText('Availability')).toBeNull()
  expect(screen.getByText('Load Health')).toBeTruthy()
})

it('Layout & Navigation hides a page and persists the layout order', async () => {
  const repo = createMemorySettingsRepository()
  const { unmount } = renderWith(repo, <LayoutNavigationPage />)

  // hide the Athletes page
  const athletesToggle = screen
    .getByText('Athletes')
    .closest('label')!
    .querySelector('input')!
  fireEvent.click(athletesToggle)
  expect(repo.load().layout.hiddenPages).toContain('/overview/athletes')

  // reorder Monitoring above Overview via its Move up control
  fireEvent.click(screen.getByRole('button', { name: 'Move Monitoring up' }))
  expect(repo.load().layout.categoryOrder['performance-dashboard']?.[0]).toBe('monitoring')

  // Reset to Default clears everything
  fireEvent.click(screen.getByRole('button', { name: /Reset to Default/ }))
  expect(repo.load().layout.hiddenPages).toEqual([])
  expect(repo.load().layout.categoryOrder).toEqual({})
  unmount()
})
