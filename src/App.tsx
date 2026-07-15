/**
 * Temporary token-verification screen. The real app shell (sidebar, top bar,
 * navigation, auth) is Build Order step 3 and replaces this file — this exists
 * so the design tokens are visually verifiable from day one.
 */
function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block size-3 rounded-full"
          style={{ backgroundColor: 'var(--accent)' }}
        />
        <h1 className="text-title font-bold">FH Performance Dashboard</h1>
      </header>

      <section className="rounded-card border border-subtle bg-surface p-5">
        <h2 className="text-widget font-semibold">Build in progress</h2>
        <p className="mt-2 text-body text-secondary">
          Foundation phase: schema, calculations, and synthetic data are being laid down before any
          dashboard page ships. Track progress in <code>docs/build-status.md</code>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-label">
          <span className="rounded-full border border-good/40 bg-good/15 px-3 py-1 text-good">
            Schema tested
          </span>
          <span className="rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-warning">
            AWS spike pending
          </span>
          <span className="rounded-full border border-strong bg-surface-2 px-3 py-1 text-secondary">
            Local-only mode
          </span>
        </div>
        <p className="tabular mt-4 text-kpi font-bold">25</p>
        <p className="text-label text-muted">athletes (token check: tabular KPI number)</p>
      </section>
    </main>
  )
}

export default App
