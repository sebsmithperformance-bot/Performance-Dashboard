import { Bookmark, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { SavedViewsStore } from '../../lib/dashboard/types.ts'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS, LabeledControl } from './controls.tsx'

/**
 * Savable views (§6.4): name the current page configuration, reload it later.
 * Persistence goes through the provider's SavedViewsStore (server-side once
 * the AWS provider exists).
 */
export function SaveViewControl({
  page,
  store,
  getCurrentConfig,
  onApply,
}: {
  page: string
  store: SavedViewsStore
  getCurrentConfig: () => Record<string, unknown>
  onApply: (config: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [refresh, setRefresh] = useState(0)
  const views = store.list(page)
  void refresh

  return (
    <div className="flex flex-wrap items-center gap-2">
      <LabeledControl label="Saved view">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value)
            const view = views.find((v) => v.name === e.target.value)
            if (view) onApply(view.config)
          }}
          className={CONTROL_CLASS}
        >
          <option value="">{views.length === 0 ? 'none saved' : 'choose…'}</option>
          {views.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      </LabeledControl>
      {selected !== '' && (
        <button
          type="button"
          aria-label={`Delete saved view ${selected}`}
          onClick={() => {
            store.remove(page, selected)
            setSelected('')
            setRefresh((n) => n + 1)
          }}
          className="flex size-9 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-danger"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="view name"
        aria-label="New view name"
        className={`${CONTROL_CLASS} w-32`}
      />
      <Button
        variant="secondary"
        disabled={name.trim() === ''}
        onClick={() => {
          store.save({ name: name.trim(), page, config: getCurrentConfig() })
          setSelected(name.trim())
          setName('')
          setRefresh((n) => n + 1)
        }}
      >
        <Bookmark aria-hidden className="size-4" />
        Save view
      </Button>
    </div>
  )
}
