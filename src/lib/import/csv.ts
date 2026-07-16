/**
 * Minimal RFC-4180 CSV parser for import ingestion. Hand-rolled to keep the
 * dependency surface small and the behavior fully tested: quoted fields,
 * escaped quotes, CR/LF and LF endings, and a BOM strip. Preserves raw cell
 * text — no trimming or type coercion here (§4.3: blank ≠ 0 ≠ N/A).
 */

export interface ParsedCsv {
  headers: string[]
  /** One record per data row, keyed by header; missing cells are ''. */
  rows: Record<string, string>[]
  /** 1-based source row number for each data row (header row is 1). */
  rowNumbers: number[]
}

export class CsvParseError extends Error {
  readonly line: number

  constructor(message: string, line: number) {
    super(`CSV parse error at line ${line}: ${message}`)
    this.line = line
  }
}

function splitRecords(text: string): { fields: string[]; line: number }[] {
  const records: { fields: string[]; line: number }[] = []
  let fields: string[] = []
  let cell = ''
  let inQuotes = false
  let line = 1
  let recordStartLine = 1

  const pushCell = () => {
    fields.push(cell)
    cell = ''
  }
  const pushRecord = () => {
    pushCell()
    records.push({ fields, line: recordStartLine })
    fields = []
    recordStartLine = line
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        if (ch === '\n') line += 1
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      if (cell.length > 0) throw new CsvParseError('quote inside unquoted field', line)
      inQuotes = true
    } else if (ch === ',') {
      pushCell()
    } else if (ch === '\n') {
      line += 1
      pushRecord()
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') continue // handled by \n
      line += 1
      pushRecord()
    } else {
      cell += ch
    }
  }
  if (inQuotes) throw new CsvParseError('unterminated quoted field', recordStartLine)
  if (cell.length > 0 || fields.length > 0) pushRecord()
  return records
}

export function parseCsv(text: string): ParsedCsv {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const records = splitRecords(clean).filter(
    (r) => !(r.fields.length === 1 && r.fields[0] === ''), // ignore blank lines
  )
  if (records.length === 0) throw new CsvParseError('file is empty', 1)

  const headerRecord = records[0]!
  const headers = headerRecord.fields.map((h) => h.trim())
  if (headers.some((h) => h === '')) {
    throw new CsvParseError('empty header cell', headerRecord.line)
  }
  const dupe = headers.find((h, i) => headers.indexOf(h) !== i)
  if (dupe !== undefined) {
    throw new CsvParseError(`duplicate header "${dupe}"`, headerRecord.line)
  }

  const rows: Record<string, string>[] = []
  const rowNumbers: number[] = []
  for (const record of records.slice(1)) {
    if (record.fields.length > headers.length) {
      throw new CsvParseError(
        `row has ${record.fields.length} cells but the header has ${headers.length}`,
        record.line,
      )
    }
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = record.fields[i] ?? ''
    })
    rows.push(row)
    rowNumbers.push(record.line)
  }
  return { headers, rows, rowNumbers }
}
