// @vitest-environment jsdom
/**
 * UI test: the Import Data page walks a real file from upload through preview
 * to a committed import and shows it in history — against a real PGlite
 * database behind the mocked local-backend seam.
 */
import { webcrypto } from 'node:crypto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../lib/auth/AuthContext.tsx'
import { createTestDb, type TestDb } from '../../../tests/import/helpers.ts'

if (globalThis.crypto?.subtle === undefined) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}

let testDb: TestDb

vi.mock('../../lib/import/local/local-backend.ts', () => ({
  getLocalDb: () => Promise.resolve(testDb.db),
  resetLocalDb: () => Promise.resolve(),
}))

const { ImportPage } = await import('./ImportPage.tsx')

const TB_CLEAN =
  'Date,Athlete,Exercise,Top Working Weight (lb),Reps\n' +
  '2026-09-07,Avery Ashcombe,Back Squat,185,3\n' +
  '2026-09-07,Blair Birchwood,Back Squat,165,3\n'

beforeAll(async () => {
  testDb = await createTestDb([
    { firstName: 'Avery', lastName: 'Ashcombe', position: 'Forward' },
    { firstName: 'Blair', lastName: 'Birchwood', position: 'Midfielder' },
  ])
})

afterAll(async () => {
  cleanup()
  await testDb.close()
})

it('uploads, previews, commits, and shows the import in history', async () => {
  render(
    <AuthProvider>
      <ImportPage />
    </AuthProvider>,
  )

  // upload a clean TeamBuildr file
  const input = await screen.findByTestId('file-input')
  fireEvent.change(input, {
    target: { files: [new File([TB_CLEAN], 'tb_ui.csv', { type: 'text/csv' })] },
  })

  // source auto-suggested; preview renders with actionable summary
  await screen.findByText(/suggested \d+%/)
  await waitFor(() => {
    expect(screen.getByText(/2 insert \/ 0 update/)).toBeTruthy()
  })
  // preview table shows resolved athletes and canonical values
  expect(screen.getAllByText('Avery Ashcombe').length).toBeGreaterThan(0)
  expect(screen.getAllByText('185').length).toBe(2) // raw and canonical columns

  // commit
  const commitButton = screen.getByRole('button', { name: /commit import/i })
  await waitFor(() => expect(commitButton.hasAttribute('disabled')).toBe(false))
  fireEvent.click(commitButton)
  await screen.findByText(/Import committed/)
  expect(screen.getByText(/2 inserted · 0 updated/)).toBeTruthy()

  // history reflects the database
  fireEvent.click(screen.getByRole('button', { name: /import history/i }))
  await screen.findByText('tb_ui.csv')
  expect(screen.getByText('committed')).toBeTruthy()

  // drill-in shows row-level audit
  fireEvent.click(screen.getByRole('button', { name: /^rows$/i }))
  await screen.findByText(/Row-level audit/)
  expect((await screen.findAllByText('insert')).length).toBeGreaterThan(0)
})
