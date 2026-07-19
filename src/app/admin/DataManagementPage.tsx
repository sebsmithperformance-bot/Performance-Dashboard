import { ArrowDown, ArrowUp, LayoutList, RotateCcw } from 'lucide-react'
import { CONTROL_CLASS, LabeledControl } from '../../components/controls/controls.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Panel } from '../../components/ui/Panel.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { orderByConfig } from '../../lib/settings/defaults.ts'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { ComparisonBasis } from '../../lib/dashboard/types.ts'
import { PRIMARY_SECTIONS } from '../nav.ts'
import { OVERVIEW_PAGE_ID, OVERVIEW_WIDGETS } from '../overview/widgets.ts'

const BASES: { value: ComparisonBasis; label: string }[] = [
  { value: 'prior_week', label: 'Prior week' },
  { value: 'prior_session', label: 'Prior session' },
  { value: 'rolling_average', label: 'Rolling average' },
]

function moveInList(ids: string[], id: string, delta: number): string[] {
  const index = ids.indexOf(id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= ids.length) return ids
  const next = [...ids]
  next.splice(index, 1)
  next.splice(target, 0, id)
  return next
}

function ReorderButtons({
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
    <span className="ml-auto inline-flex gap-1">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={isFirst}
        onClick={onUp}
        className="flex size-8 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-primary disabled:opacity-30"
      >
        <ArrowUp aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={isLast}
        onClick={onDown}
        className="flex size-8 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-primary disabled:opacity-30"
      >
        <ArrowDown aria-hidden className="size-4" />
      </button>
    </span>
  )
}

/** Admin → Data Management (§5.5): structural layout of the coach-facing
 *  frontend — reorder sections/sub-tabs, show/hide + reorder widgets, and
 *  display defaults. Never a page builder. */
export function DataManagementPage() {
  const { settings, updateLayout, updateDisplay, resetLayout } = useSettings()
  const { dataset } = useDashboardData()
  const layout = settings.layout

  const orderedSections = orderByConfig(PRIMARY_SECTIONS, (s) => s.base, layout.sectionOrder)
  const orderedWidgets = orderByConfig(
    OVERVIEW_WIDGETS,
    (w) => w.id,
    layout.widgetOrder[OVERVIEW_PAGE_ID] ?? [],
  )
  const hidden = new Set(layout.hiddenWidgets)
  const scKpis = dataset
    ? [...dataset.kpis.values()].filter((k) => k.category === 'Strength' || k.category === 'Power')
    : []

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label text-muted">
        Structural customization only — show, hide, and reorder. Saved locally on this build.
      </p>

      <Panel icon={LayoutList} title="Primary section order" keyValue="sidebar">
        <ul className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
          {orderedSections.map((section, i) => (
            <li key={section.base} className="flex items-center gap-2 px-3 py-2">
              <span className="font-medium">{section.label}</span>
              <ReorderButtons
                label={section.label}
                isFirst={i === 0}
                isLast={i === orderedSections.length - 1}
                onUp={() =>
                  updateLayout({
                    sectionOrder: moveInList(
                      orderedSections.map((s) => s.base),
                      section.base,
                      -1,
                    ),
                  })
                }
                onDown={() =>
                  updateLayout({
                    sectionOrder: moveInList(
                      orderedSections.map((s) => s.base),
                      section.base,
                      1,
                    ),
                  })
                }
              />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel icon={LayoutList} title="Sub-tab order" keyValue="per section">
        <div className="grid gap-4 md:grid-cols-2">
          {orderedSections.map((section) => {
            const tabs = orderByConfig(
              section.subTabs,
              (t) => t.path,
              layout.subTabOrder[section.base] ?? [],
            )
            return (
              <div key={section.base}>
                <p className="mb-1 text-label font-medium text-secondary">{section.label}</p>
                <ul className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
                  {tabs.map((tab, i) => (
                    <li key={tab.path} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-body">{tab.label}</span>
                      <ReorderButtons
                        label={`${section.label} ${tab.label}`}
                        isFirst={i === 0}
                        isLast={i === tabs.length - 1}
                        onUp={() =>
                          updateLayout({
                            subTabOrder: {
                              ...layout.subTabOrder,
                              [section.base]: moveInList(
                                tabs.map((t) => t.path),
                                tab.path,
                                -1,
                              ),
                            },
                          })
                        }
                        onDown={() =>
                          updateLayout({
                            subTabOrder: {
                              ...layout.subTabOrder,
                              [section.base]: moveInList(
                                tabs.map((t) => t.path),
                                tab.path,
                                1,
                              ),
                            },
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-label text-muted">
          The first sub-tab in each section is its landing view; URLs stay stable when reordering.
        </p>
      </Panel>

      <Panel icon={LayoutList} title="Overview widgets" keyValue="Team Dashboard">
        <ul className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
          {orderedWidgets.map((widget, i) => (
            <li key={widget.id} className="flex items-center gap-3 px-3 py-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!hidden.has(widget.id)}
                  onChange={(e) =>
                    updateLayout({
                      hiddenWidgets: e.target.checked
                        ? layout.hiddenWidgets.filter((id) => id !== widget.id)
                        : [...layout.hiddenWidgets, widget.id],
                    })
                  }
                  className="accent-(--accent)"
                />
                <span className={hidden.has(widget.id) ? 'text-muted line-through' : 'font-medium'}>
                  {widget.label}
                </span>
              </label>
              {widget.fullWidth && <span className="text-label text-muted">full width</span>}
              <ReorderButtons
                label={widget.label}
                isFirst={i === 0}
                isLast={i === orderedWidgets.length - 1}
                onUp={() =>
                  updateLayout({
                    widgetOrder: {
                      ...layout.widgetOrder,
                      [OVERVIEW_PAGE_ID]: moveInList(
                        orderedWidgets.map((w) => w.id),
                        widget.id,
                        -1,
                      ),
                    },
                  })
                }
                onDown={() =>
                  updateLayout({
                    widgetOrder: {
                      ...layout.widgetOrder,
                      [OVERVIEW_PAGE_ID]: moveInList(
                        orderedWidgets.map((w) => w.id),
                        widget.id,
                        1,
                      ),
                    },
                  })
                }
              />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel icon={LayoutList} title="Display defaults" keyValue="preferences">
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
      </Panel>

      <div>
        <Button variant="secondary" onClick={resetLayout}>
          <RotateCcw aria-hidden className="size-4" />
          Restore default layout
        </Button>
      </div>
    </div>
  )
}
