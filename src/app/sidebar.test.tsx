// @vitest-environment jsdom
/**
 * §1–2 sidebar: three product areas, accordion that auto-expands only the
 * active category (one open at a time), a clearly-marked selected page, and
 * pages hidden via the layout config disappearing from navigation.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { createMemorySettingsRepository } from '../lib/settings/local-settings.ts'
import { defaultSettings } from '../lib/settings/defaults.ts'
import { SettingsProvider } from '../lib/settings/SettingsContext.tsx'
import type { DashboardSettings } from '../lib/settings/types.ts'
import { Sidebar } from './Sidebar.tsx'

afterEach(cleanup)

function renderSidebar(path: string, settings?: DashboardSettings) {
  const repo = createMemorySettingsRepository(settings)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SettingsProvider repository={repo}>
        <Sidebar collapsed={false} onToggleCollapsed={() => {}} drawerOpen={false} onCloseDrawer={() => {}} />
      </SettingsProvider>
    </MemoryRouter>,
  )
}

it('shows three top-level product areas', () => {
  renderSidebar('/performance/athlete-profile')
  expect(screen.getByText('Performance Dashboard')).toBeTruthy()
  expect(screen.getByText('Competition')).toBeTruthy()
  expect(screen.getByText('Annual Plan')).toBeTruthy()
})

it('auto-expands only the active category; the selected page is current', () => {
  renderSidebar('/performance/athlete-profile')
  // active category (Performance) is expanded → its page link is present + current
  const active = screen.getByRole('link', { name: 'Athlete Profile' })
  expect(active.getAttribute('aria-current')).toBe('page')
  // an inactive category (Monitoring) is collapsed → its pages are not rendered
  expect(screen.queryByRole('link', { name: 'Availability' })).toBeNull()
})

it('opens one category at a time when toggled', () => {
  renderSidebar('/performance/athlete-profile')
  expect(screen.getByRole('link', { name: 'Athlete Profile' })).toBeTruthy()

  // expand Monitoring → Performance collapses (one open at a time)
  fireEvent.click(screen.getByRole('button', { name: /Monitoring/ }))
  expect(screen.getByRole('link', { name: 'Availability' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Athlete Profile' })).toBeNull()
})

it('hides pages configured hidden in the layout', () => {
  const settings = defaultSettings()
  settings.layout.hiddenPages = ['/performance/leaderboards']
  renderSidebar('/performance/athlete-profile', settings)
  expect(screen.getByRole('link', { name: 'Athlete Profile' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Leaderboards' })).toBeNull()
})

it('renders Competition as its own accordion, expanded on a competition route', () => {
  renderSidebar('/competition/team-standings')
  const active = screen.getByRole('link', { name: 'Team Standings' })
  expect(active.getAttribute('aria-current')).toBe('page')
  // Performance Dashboard categories stay collapsed
  expect(screen.queryByRole('link', { name: 'Athlete Profile' })).toBeNull()
})

it('renders Annual Plan as a standalone highlighted item', () => {
  renderSidebar('/annual-plan')
  const links = within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link')
  const annual = links.find((l) => l.getAttribute('href') === '/annual-plan')!
  expect(annual.getAttribute('aria-current')).toBe('page')
})
