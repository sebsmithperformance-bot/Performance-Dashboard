import { useState } from 'react'
import { CalendarRange, ExternalLink, FileSpreadsheet, Link2, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { InfoHint } from '../../components/ui/InfoHint.tsx'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { CONTROL_CLASS } from '../../components/controls/controls.tsx'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'

const FUTURE_NOTE =
  'Future versions may display annual-plan weeks and sessions directly in the dashboard.'

/** Only http(s) links are allowed for a safe new-tab open (§11). */
function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function deriveName(url: string): string {
  try {
    const path = new URL(url).pathname
    const last = decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '')
    return last || 'Annual plan workbook'
  } catch {
    return 'Annual plan workbook'
  }
}

/** Link form used for both the initial connect and Replace Link (§11). */
function LinkForm({
  initialUrl = '',
  initialName = '',
  submitLabel,
  onCancel,
  onSave,
}: {
  initialUrl?: string
  initialName?: string
  submitLabel: string
  onCancel?: () => void
  onSave: (url: string, name: string) => void
}) {
  const [url, setUrl] = useState(initialUrl)
  const [name, setName] = useState(initialName)
  const valid = isValidUrl(url.trim())
  const touched = url.trim().length > 0

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave(url.trim(), name.trim() || deriveName(url.trim()))
      }}
    >
      <label className="flex flex-col gap-1 text-label text-muted">
        Excel workbook link (https)
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/annual-plan.xlsx"
          className={`${CONTROL_CLASS} max-w-xl`}
          aria-invalid={touched && !valid}
        />
      </label>
      {touched && !valid && (
        <p className="text-label text-danger">Enter a valid http(s) link.</p>
      )}
      <label className="flex flex-col gap-1 text-label text-muted">
        Display name (optional)
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="2026 Annual Plan"
          className={`${CONTROL_CLASS} max-w-xl`}
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!valid}>
          <Link2 aria-hidden className="size-4" />
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

/** Annual Plan (§11): store and open one Excel workbook link. Initial
 *  integration only — no sheet parsing, editing, or sync. */
export function AnnualPlanPage() {
  const { settings, setAnnualPlan } = useSettings()
  const plan = settings.annualPlan
  const connected = plan.fileUrl !== null
  const [editing, setEditing] = useState(false)

  const save = (url: string, name: string) => {
    setAnnualPlan({ fileUrl: url, fileName: name, lastUpdated: new Date().toISOString().slice(0, 10) })
    setEditing(false)
  }
  const remove = () => {
    if (window.confirm('Remove the linked Annual Plan workbook?')) {
      setAnnualPlan({ fileUrl: null, fileName: null, lastUpdated: null })
      setEditing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Annual Plan"
        description="Initial integration — link one Excel workbook."
        actions={<InfoHint label="About Annual Plan">{FUTURE_NOTE}</InfoHint>}
      />

      {!connected || editing ? (
        <section className="rounded-card border border-subtle bg-surface p-6">
          {!connected && !editing && (
            <div className="mb-4">
              <CalendarRange aria-hidden className="size-8 text-muted" strokeWidth={1.75} />
              <h2 className="mt-2 section-label text-subhead text-primary">No annual plan connected</h2>
              <p className="mt-1 max-w-md text-body text-secondary">
                Link the current Excel workbook to open it from the dashboard.
              </p>
            </div>
          )}
          <LinkForm
            initialUrl={editing ? (plan.fileUrl ?? '') : ''}
            initialName={editing ? (plan.fileName ?? '') : ''}
            submitLabel={editing ? 'Replace link' : 'Link Excel Plan'}
            onCancel={editing ? () => setEditing(false) : undefined}
            onSave={save}
          />
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-card border border-subtle bg-surface p-6">
          <div className="flex items-start gap-3">
            <FileSpreadsheet aria-hidden className="size-8 shrink-0 text-[var(--status-good)]" strokeWidth={1.5} />
            <div className="min-w-0">
              <h2 className="truncate text-widget font-semibold">{plan.fileName}</h2>
              <p className="text-label text-muted">
                Excel workbook
                {plan.lastUpdated && ` · last updated ${plan.lastUpdated}`}
              </p>
              <p className="mt-1 truncate text-label text-muted" title={plan.fileUrl ?? ''}>
                {plan.fileUrl}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={plan.fileUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-control bg-accent px-3 text-label font-semibold text-on-brand hover:opacity-90"
            >
              <ExternalLink aria-hidden className="size-4" />
              Open Plan
            </a>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Link2 aria-hidden className="size-4" />
              Replace Link
            </Button>
            <Button variant="ghost" onClick={remove}>
              <Trash2 aria-hidden className="size-4" />
              Remove Link
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
