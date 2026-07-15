/** Minimal CSV writer for generated fixtures — RFC-4180 quoting. */
export type CsvValue = string | number | null

export function toCsv(headers: readonly string[], rows: readonly CsvValue[][]): string {
  const cell = (v: CsvValue): string => {
    if (v === null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  return [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n') + '\n'
}

/** "2026-08-14" → "14 Aug 26" (PlayerData report filename style). */
export function playerDataDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-') as [string, string, string]
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${Number(d)} ${months[Number(m) - 1]} ${y.slice(2)}`
}
