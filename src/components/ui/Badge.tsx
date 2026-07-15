import type { ReactNode } from 'react'

type Tone = 'good' | 'warning' | 'danger' | 'neutral' | 'brand'

/** §12.5 chips: 12px text, tone color at ~15% opacity background. Meaning is
 *  never carried by color alone — always pair with the text label given here. */
const TONE_CLASSES: Record<Tone, string> = {
  good: 'border-good/40 bg-good/15 text-good',
  warning: 'border-warning/40 bg-warning/15 text-warning',
  danger: 'border-danger/40 bg-danger/15 text-danger',
  neutral: 'border-strong bg-surface-2 text-secondary',
  brand: 'border-brand-neutral/40 bg-brand-neutral/15 text-secondary',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-label font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}
