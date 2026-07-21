/**
 * §1–3 navigation structure: three top-level product areas, and the layout
 * config (order + visibility) correctly shapes the visible tree.
 */
import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../lib/settings/defaults.ts'
import type { DashboardLayoutConfig } from '../lib/settings/types.ts'
import { NAV_AREAS } from './nav.ts'
import { firstVisiblePath, visibleNavTree } from './nav-layout.ts'

function layout(patch: Partial<DashboardLayoutConfig> = {}): DashboardLayoutConfig {
  return { ...defaultSettings().layout, ...patch }
}

describe('navigation structure', () => {
  it('has exactly three top-level product areas in order', () => {
    expect(NAV_AREAS.map((a) => a.id)).toEqual(['performance-dashboard', 'competition', 'annual-plan'])
  })

  it('keeps Competition and Annual Plan out of the Performance Dashboard area', () => {
    const pd = NAV_AREAS.find((a) => a.id === 'performance-dashboard')!
    const categoryIds = pd.categories.map((c) => c.id)
    expect(categoryIds).toEqual(['overview', 'monitoring', 'data-trends', 'performance'])
    expect(categoryIds).not.toContain('competition')
    expect(categoryIds).not.toContain('annual-plan')
  })

  it('default tree shows all three areas', () => {
    expect(visibleNavTree(layout()).map((a) => a.id)).toEqual([
      'performance-dashboard',
      'competition',
      'annual-plan',
    ])
  })

  it('hiding an area removes it from the tree', () => {
    const tree = visibleNavTree(layout({ hiddenAreas: ['competition'] }))
    expect(tree.map((a) => a.id)).toEqual(['performance-dashboard', 'annual-plan'])
  })

  it('hiding a page removes it, and an emptied category drops out', () => {
    const tree = visibleNavTree(layout({ hiddenPages: ['/annual-plan'] }))
    expect(tree.some((a) => a.id === 'annual-plan')).toBe(false)
  })

  it('area order is honored', () => {
    const tree = visibleNavTree(layout({ areaOrder: ['annual-plan', 'competition', 'performance-dashboard'] }))
    expect(tree[0]!.id).toBe('annual-plan')
  })

  it('firstVisiblePath returns the first visible page, recovery-aware', () => {
    expect(firstVisiblePath(layout())).toBe('/overview/team-snapshot')
    expect(firstVisiblePath(layout({ hiddenPages: ['/overview/team-snapshot'] }))).toBe(
      '/overview/athletes',
    )
  })
})
