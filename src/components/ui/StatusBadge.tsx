import { Badge } from './Badge.tsx'
import type { AvailabilityStatus } from '../../lib/dashboard/types.ts'

const AVAILABILITY: Record<
  AvailabilityStatus,
  { label: string; tone: 'good' | 'warning' | 'danger' }
> = {
  full_go: { label: 'Full Go', tone: 'good' },
  limited: { label: 'Limited', tone: 'warning' },
  out: { label: 'Out', tone: 'danger' },
}

/** Availability status chip — label always present, color never alone (§12.2). */
export function AvailabilityBadge({ status }: { status: AvailabilityStatus | null }) {
  if (status === null) return <Badge tone="neutral">no entry</Badge>
  const { label, tone } = AVAILABILITY[status]
  return <Badge tone={tone}>{label}</Badge>
}
