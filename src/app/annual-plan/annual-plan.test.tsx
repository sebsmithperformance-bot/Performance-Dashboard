// @vitest-environment jsdom
/**
 * Annual Plan (§11): empty → connected round-trip, URL validation, safe
 * new-tab attributes, and persistence through the SettingsRepository.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemorySettingsRepository } from '../../lib/settings/local-settings.ts'
import { SettingsProvider } from '../../lib/settings/SettingsContext.tsx'
import type { SettingsRepository } from '../../lib/settings/types.ts'
import { AnnualPlanPage } from './AnnualPlanPage.tsx'

afterEach(cleanup)
beforeEach(() => vi.restoreAllMocks())

function renderWith(repo: SettingsRepository) {
  return render(
    <SettingsProvider repository={repo}>
      <AnnualPlanPage />
    </SettingsProvider>,
  )
}

it('shows the empty state and links a valid workbook, persisting it', () => {
  const repo = createMemorySettingsRepository()
  renderWith(repo)
  expect(screen.getByText('No annual plan connected')).toBeTruthy()

  fireEvent.change(screen.getByLabelText(/Excel workbook link/i), {
    target: { value: 'https://example.com/2026-annual-plan.xlsx' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Link Excel Plan/i }))

  // connected state + Open Plan uses safe new-tab attributes
  const open = screen.getByRole('link', { name: /Open Plan/i })
  expect(open.getAttribute('target')).toBe('_blank')
  expect(open.getAttribute('rel')).toBe('noopener noreferrer')
  expect(open.getAttribute('href')).toBe('https://example.com/2026-annual-plan.xlsx')
  // persisted through the repository
  expect(repo.load().annualPlan.fileUrl).toBe('https://example.com/2026-annual-plan.xlsx')
})

it('rejects an invalid (non-http) URL', () => {
  const repo = createMemorySettingsRepository()
  renderWith(repo)
  fireEvent.change(screen.getByLabelText(/Excel workbook link/i), {
    target: { value: 'file:///etc/passwd' },
  })
  expect(screen.getByText(/Enter a valid http\(s\) link/i)).toBeTruthy()
  expect(screen.getByRole('button', { name: /Link Excel Plan/i })).toHaveProperty('disabled', true)
})

it('removes the link on confirmation', () => {
  const repo = createMemorySettingsRepository()
  const settings = repo.load()
  repo.save({
    ...settings,
    annualPlan: { fileUrl: 'https://x.test/plan.xlsx', fileName: 'Plan', lastUpdated: '2026-07-01' },
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderWith(repo)
  expect(screen.getByText('Plan')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Remove Link/i }))
  expect(repo.load().annualPlan.fileUrl).toBeNull()
})
