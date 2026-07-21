import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import { CONTROL_CLASS, LabeledControl } from '../../components/controls/controls.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { ComparisonBasis } from '../../lib/dashboard/types.ts'
import type { DashboardLayoutConfig } from '../../lib/settings/types.ts'
import { NAV_AREAS } from '../nav.ts'
import { orderedAreas, orderedCategories, orderedPages, visibleNavTree } from '../nav-layout.ts'
import { OVERVIEW_WIDGETS } from '../overview/widgets.ts'

const BASES: { value: ComparisonBasis; label: string }[] = [
  { value: 'prior_week', label: 'Prior week' },
  { value: 'prior_session', label: 'Prior session' },
  { value: 'rolling_average', label: 'Rolling average' },
]

/** Pages that expose optional widgets/panels in the Layout tree. */
const PAGE_WIDGETS: Record<string, { id: string; label: string }[]> = {
  '/overview/team-snapshot': OVERVIEW_WIDGETS,
}

function moveInList(ids: string[], id: string, delta: number): string[] {
  const index = ids.indexOf(id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= ids.length) return ids
  const next = [...ids]
  next.splice(index, 1)
  next.splice(target, 0, id)
  return next
}

function Reorder({
  label,
  onUp,
  onDown,
  isFirst,
  isLast,
}: {
  label: string
  onUp: () => void
  onDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={isFirst}
        onClick={onUp}
        className="flex size-7 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-primary disabled:opacity-30"
      >
        <ArrowUp aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={isLast}
        onClick={onDown}
        className="flex size-7 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-primary disabled:opacity-30"
      >
        <ArrowDown aria-hidden className="size-4" />
      </button>
    </span>
  )
}

/** Admin → Layout & Navigation: show/hide and reorder every product area,
 *  category, page, and optional page widget. Structural customization only —
 *  never a page builder, never deletes data. */
export function LayoutNavigationPage() {
  const { settings, updateLayout, updateDisplay, resetLayout } = useSettings()
  const { dataset } = useDashboardData()
  const layout = settings.layout

  const hiddenAreas = new Set(layout.hiddenAreas)
  const hiddenCategories = new Set(layout.hiddenCategories)
  const hiddenPages = new Set(layout.hiddenPages)
  const hiddenWidgets = new Set(layout.hiddenWidgets)

  /** Apply a layout patch, but never let the whole navigation go empty
   *  (Reset to Default is the recovery option §3). */
  const safeUpdate = (patch: Partial<DashboardLayoutConfig>) => {
    const next = { ...layout, ...patch }
    if (visibleNavTree(next).length === 0) return
    updateLayout(patch)
  }

  const toggleIn = (list: string[], id: string, hide: boolean): string[] =>
    hide ? [...list, id] : list.filter((x) => x !== id)

  const areas = orderedAreas(layout)
  const scKpis = dataset
    ? [...dataset.kpis.values()].filter((k) => k.category === 'Strength' || k.category === 'Power')
    : []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Layout & Navigation"
        description="Show, hide, and reorder areas, categories, and pages."
        actions={
          <Button variant="secondary" onClick={resetLayout}>
            <RotateCcw aria-hidden className="size-4" />
            Reset to Default
          </Button>
        }
      />

      {areas.map((area, ai) => {
        const areaHidden = hiddenAreas.has(area.id)
        const categories = orderedCategories(area, layout)
        return (
          <section key={area.id} className="rounded-card border border-subtle bg-surface p-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!areaHidden}
                  onChange={(e) =>
                    safeUpdate({ hiddenAreas: toggleIn(layout.hiddenAreas, area.id, !e.target.checked) })
                  }
                  className="accent-(--accent)"
                />
                <span className={`text-subhead font-semibold ${areaHidden ? 'text-muted line-through' : ''}`}>
                  {area.label}
                </span>
              </label>
              <span className="ml-auto">
                <Reorder
                  label={area.label}
                  isFirst={ai === 0}
                  isLast={ai === areas.length - 1}
                  onUp={() => safeUpdate({ areaOrder: moveInList(areas.map((a) => a.id), area.id, -1) })}
                  onDown={() => safeUpdate({ areaOrder: moveInList(areas.map((a) => a.id), area.id, 1) })}
                />
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-3 pl-2">
              {categories.map((category, ci) => {
                const catHidden = hiddenCategories.has(category.id)
                const pages = orderedPages(category, layout)
                // a single-page area's category is the area itself — skip the
                // redundant category row, show its page directly
                const showCategoryRow = !(area.categories.length === 1 && pages.length === 1)
                return (
                  <div key={category.id} className="border-l border-subtle pl-3">
                    {showCategoryRow && (
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!catHidden}
                            onChange={(e) =>
                              safeUpdate({
                                hiddenCategories: toggleIn(
                                  layout.hiddenCategories,
                                  category.id,
                                  !e.target.checked,
                                ),
                              })
                            }
                            className="accent-(--accent)"
                          />
                          <span className={`text-body font-medium ${catHidden ? 'text-muted line-through' : ''}`}>
                            {category.label}
                          </span>
                        </label>
                        <span className="ml-auto">
                          <Reorder
                            label={category.label}
                            isFirst={ci === 0}
                            isLast={ci === categories.length - 1}
                            onUp={() =>
                              safeUpdate({
                                categoryOrder: {
                                  ...layout.categoryOrder,
                                  [area.id]: moveInList(categories.map((c) => c.id), category.id, -1),
                                },
                              })
                            }
                            onDown={() =>
                              safeUpdate({
                                categoryOrder: {
                                  ...layout.categoryOrder,
                                  [area.id]: moveInList(categories.map((c) => c.id), category.id, 1),
                                },
                              })
                            }
                          />
                        </span>
                      </div>
                    )}

                    <ul className={`flex flex-col gap-1 ${showCategoryRow ? 'mt-2 pl-5' : ''}`}>
                      {pages.map((page, pi) => {
                        const pageHidden = hiddenPages.has(page.id)
                        const widgets = PAGE_WIDGETS[page.path]
                        return (
                          <li key={page.id} className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!pageHidden}
                                  onChange={(e) =>
                                    safeUpdate({
                                      hiddenPages: toggleIn(layout.hiddenPages, page.id, !e.target.checked),
                                    })
                                  }
                                  className="accent-(--accent)"
                                />
                                <span className={`text-body ${pageHidden ? 'text-muted line-through' : ''}`}>
                                  {page.label}
                                </span>
                              </label>
                              <span className="ml-auto">
                                <Reorder
                                  label={`${category.label} ${page.label}`}
                                  isFirst={pi === 0}
                                  isLast={pi === pages.length - 1}
                                  onUp={() =>
                                    safeUpdate({
                                      pageOrder: {
                                        ...layout.pageOrder,
                                        [category.id]: moveInList(pages.map((p) => p.id), page.id, -1),
                                      },
                                    })
                                  }
                                  onDown={() =>
                                    safeUpdate({
                                      pageOrder: {
                                        ...layout.pageOrder,
                                        [category.id]: moveInList(pages.map((p) => p.id), page.id, 1),
                                      },
                                    })
                                  }
                                />
                              </span>
                            </div>
                            {widgets && (
                              <ul
                                aria-label={`${page.label} widgets`}
                                className="ml-6 flex flex-col gap-0.5 border-l border-subtle pl-3"
                              >
                                {widgets.map((w) => (
                                  <li key={w.id} className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 text-label">
                                      <input
                                        type="checkbox"
                                        checked={!hiddenWidgets.has(w.id)}
                                        onChange={(e) =>
                                          updateLayout({
                                            hiddenWidgets: toggleIn(
                                              layout.hiddenWidgets,
                                              w.id,
                                              !e.target.checked,
                                            ),
                                          })
                                        }
                                        className="accent-(--accent)"
                                      />
                                      <span
                                        className={
                                          hiddenWidgets.has(w.id) ? 'text-muted line-through' : 'text-secondary'
                                        }
                                      >
                                        {w.label}
                                      </span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <section className="rounded-card border border-subtle bg-surface p-4">
        <h2 className="mb-3 text-subhead font-semibold">Display defaults</h2>
        <div className="flex flex-wrap gap-4">
          <LabeledControl label="Default comparison basis">
            <select
              value={settings.display.defaultComparisonBasis}
              onChange={(e) =>
                updateDisplay({ defaultComparisonBasis: e.target.value as ComparisonBasis })
              }
              className={CONTROL_CLASS}
            >
              {BASES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label="Default S&C % Change metric">
            <select
              value={settings.display.defaultScChangeKpi ?? ''}
              onChange={(e) =>
                updateDisplay({ defaultScChangeKpi: e.target.value === '' ? null : e.target.value })
              }
              className={CONTROL_CLASS}
            >
              <option value="">First available</option>
              {scKpis.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.displayName}
                </option>
              ))}
            </select>
          </LabeledControl>
        </div>
      </section>
    </div>
  )
}

// re-export the canonical areas for tests/tools that assert the structure
export { NAV_AREAS }
