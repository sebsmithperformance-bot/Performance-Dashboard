/**
 * Applies the coach's layout config (order + visibility) to the canonical
 * NAV_AREAS tree. One implementation, shared by the sidebar (visible tree) and
 * the Layout & Navigation admin page (full tree with toggles). The config is a
 * deviation from the canonical structure — new areas/categories/pages added in
 * code appear automatically.
 */
import { orderByConfig } from '../lib/settings/defaults.ts'
import type { DashboardLayoutConfig } from '../lib/settings/types.ts'
import { NAV_AREAS, type NavArea, type NavCategory, type NavPage } from './nav.ts'

export function orderedAreas(layout: DashboardLayoutConfig): NavArea[] {
  return orderByConfig(NAV_AREAS, (a) => a.id, layout.areaOrder)
}

export function orderedCategories(area: NavArea, layout: DashboardLayoutConfig): NavCategory[] {
  return orderByConfig(area.categories, (c) => c.id, layout.categoryOrder[area.id] ?? [])
}

export function orderedPages(category: NavCategory, layout: DashboardLayoutConfig): NavPage[] {
  return orderByConfig(category.pages, (p) => p.id, layout.pageOrder[category.id] ?? [])
}

/** The navigation tree the sidebar shows: ordered, with hidden areas/categories/
 *  pages removed. Empty categories and empty areas drop out entirely. */
export function visibleNavTree(layout: DashboardLayoutConfig): NavArea[] {
  const hiddenAreas = new Set(layout.hiddenAreas)
  const hiddenCategories = new Set(layout.hiddenCategories)
  const hiddenPages = new Set(layout.hiddenPages)

  return orderedAreas(layout)
    .filter((area) => !hiddenAreas.has(area.id))
    .map((area) => ({
      ...area,
      categories: orderedCategories(area, layout)
        .filter((c) => !hiddenCategories.has(c.id))
        .map((c) => ({ ...c, pages: orderedPages(c, layout).filter((p) => !hiddenPages.has(p.id)) }))
        .filter((c) => c.pages.length > 0),
    }))
    .filter((area) => area.categories.length > 0)
}

/** First visible page path, for redirects and recovery. */
export function firstVisiblePath(layout: DashboardLayoutConfig): string {
  const tree = visibleNavTree(layout)
  return tree[0]?.categories[0]?.pages[0]?.path ?? '/overview/team-snapshot'
}

/** First visible page path within an area, for the area tabs. Falls back to
 *  the global first visible page when the area is hidden/empty. */
export function firstVisiblePathForArea(layout: DashboardLayoutConfig, areaId: string): string {
  const area = visibleNavTree(layout).find((a) => a.id === areaId)
  return area?.categories[0]?.pages[0]?.path ?? firstVisiblePath(layout)
}

/** First visible page path within a given area base (e.g. '/overview'), for
 *  area index redirects; falls back to the global first visible page. */
export function firstVisiblePathUnder(layout: DashboardLayoutConfig, prefix: string): string {
  for (const area of visibleNavTree(layout)) {
    for (const category of area.categories) {
      for (const page of category.pages) {
        if (page.path === prefix || page.path.startsWith(`${prefix}/`)) return page.path
      }
    }
  }
  return firstVisiblePath(layout)
}
