import { Bookmark, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { SavedRange } from '../../lib/settings/types.ts'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS, LabeledControl } from './controls.tsx'

export interface DateRange {
  from: string
  to: string
}

/** The saved ranges + default for a scope, and the range to initialise a page
 *  with (the scope default, else the fallback). One place, so every page's
 *  saved-range behaviour matches. */
export function useSavedRanges(scope: string) {
  const { settings } = useSettings()
  const ranges = settings.savedRanges[scope] ?? []
  const defaultId = settings.defaultRanges[scope] ?? null
  const defaultRange = ranges.find((r) => r.id === defaultId) ?? null
  return { ranges, defaultId, defaultRange }
}

function newId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * §6 shared saved-range control: enter a custom start/end, name and save it,
 * pick a saved range in one click, rename/delete it, or set it as the scope
 * default. Ranges persist through the settings repository, scoped by `scope`
 * so each product area keeps its own list; the active range lives in the
 * parent (via value/onChange) so areas stay independent.
 */
export function SavedRangeControl({
  scope,
  value,
  onChange,
}: {
  scope: string
  value: DateRange
  onChange: (range: DateRange) => void
}) {
  const { setSavedRanges, setDefaultRange } = useSettings()
  const { ranges, defaultId } = useSavedRanges(scope)
  const [name, setName] = useState('')

  // derive the selected saved range from the active value (no extra state)
  const selected = ranges.find((r) => r.from === value.from && r.to === value.to) ?? null

  const commitRanges = (next: SavedRange[]) => setSavedRanges(scope, next)

  const save = () => {
    const label = name.trim()
    if (label === '' || !value.from || !value.to) return
    const range: SavedRange = { id: newId(), label, from: value.from, to: value.to }
    commitRanges([...ranges.filter((r) => r.label !== label), range])
    setName('')
  }

  const remove = (id: string) => {
    commitRanges(ranges.filter((r) => r.id !== id))
    if (defaultId === id) setDefaultRange(scope, null)
  }

  const rename = (r: SavedRange) => {
    const label = window.prompt('Rename saved range', r.label)?.trim()
    if (!label) return
    commitRanges(ranges.map((x) => (x.id === r.id ? { ...x, label } : x)))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <LabeledControl label="Range">
        <select
          value={selected?.id ?? ''}
          onChange={(e) => {
            const r = ranges.find((x) => x.id === e.target.value)
            if (r) onChange({ from: r.from, to: r.to })
          }}
          className={CONTROL_CLASS}
        >
          <option value="">Custom…</option>
          {ranges.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id === defaultId ? '★ ' : ''}
              {r.label}
            </option>
          ))}
        </select>
      </LabeledControl>

      <LabeledControl label="From">
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ from: e.target.value, to: value.to })}
          className={CONTROL_CLASS}
        />
      </LabeledControl>
      <LabeledControl label="To">
        <input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ from: value.from, to: e.target.value })}
          className={CONTROL_CLASS}
        />
      </LabeledControl>

      {selected ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={
              defaultId === selected.id
                ? `Clear default range`
                : `Set ${selected.label} as default range`
            }
            aria-pressed={defaultId === selected.id}
            onClick={() => setDefaultRange(scope, defaultId === selected.id ? null : selected.id)}
            className={`flex size-9 items-center justify-center rounded-control hover:bg-surface-2 ${
              defaultId === selected.id ? 'text-accent' : 'text-secondary hover:text-primary'
            }`}
          >
            <Star
              aria-hidden
              className="size-4"
              fill={defaultId === selected.id ? 'currentColor' : 'none'}
            />
          </button>
          <button
            type="button"
            onClick={() => rename(selected)}
            className="rounded-control px-2 text-label text-secondary hover:text-primary"
          >
            Rename
          </button>
          <button
            type="button"
            aria-label={`Delete saved range ${selected.label}`}
            onClick={() => remove(selected.id)}
            className="flex size-9 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-danger"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="range name"
            aria-label="New range name"
            className={`${CONTROL_CLASS} w-28`}
          />
          <Button variant="secondary" disabled={name.trim() === '' || !value.from || !value.to} onClick={save}>
            <Bookmark aria-hidden className="size-4" />
            Save range
          </Button>
        </div>
      )}
    </div>
  )
}
