/** §12.5 loading states: content-shaped placeholders, not spinners. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-surface-2 ${className}`} aria-hidden />
}
