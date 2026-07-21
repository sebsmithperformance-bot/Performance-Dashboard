// @vitest-environment jsdom
/**
 * Top-level product-area tabs: the three areas render as horizontal tabs, the
 * active area is marked current, and each links to that area's first page.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { createMemorySettingsRepository } from '../lib/settings/local-settings.ts'
import { SettingsProvider } from '../lib/settings/SettingsContext.tsx'
import { AreaTabs } from './AreaTabs.tsx'

afterEach(cleanup)

function renderTabs(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SettingsProvider repository={createMemorySettingsRepository()}>
        <AreaTabs />
      </SettingsProvider>
    </MemoryRouter>,
  )
}

it('renders the three product areas as tabs', () => {
  renderTabs('/overview/team-snapshot')
  const nav = screen.getByRole('navigation', { name: 'Product areas' })
  expect(within(nav).getByRole('link', { name: /Performance Dashboard/ })).toBeTruthy()
  expect(within(nav).getByRole('link', { name: /Competition/ })).toBeTruthy()
  expect(within(nav).getByRole('link', { name: /Annual Plan/ })).toBeTruthy()
})

it('marks the active area and links each tab to its first page', () => {
  renderTabs('/competition/team-standings')
  const comp = screen.getByRole('link', { name: /Competition/ })
  expect(comp.getAttribute('aria-current')).toBe('page')
  expect(comp.getAttribute('href')).toBe('/competition/team-standings')

  const pd = screen.getByRole('link', { name: /Performance Dashboard/ })
  expect(pd.getAttribute('aria-current')).toBeNull()
  expect(pd.getAttribute('href')).toBe('/overview/team-snapshot')

  const annual = screen.getByRole('link', { name: /Annual Plan/ })
  expect(annual.getAttribute('href')).toBe('/annual-plan')
})
