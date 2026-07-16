import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv.ts'
import { sha256Hex } from './hash.ts'

describe('parseCsv', () => {
  it('parses simple rows with source row numbers (header = line 1)', () => {
    const parsed = parseCsv('A,B\n1,2\n3,4\n')
    expect(parsed.headers).toEqual(['A', 'B'])
    expect(parsed.rows).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
    ])
    expect(parsed.rowNumbers).toEqual([2, 3])
  })

  it('handles quoted fields, escaped quotes, embedded commas and newlines', () => {
    const parsed = parseCsv('Name,Note\n"Doe, Jane","said ""hi""\nand left"\n')
    expect(parsed.rows[0]).toEqual({ Name: 'Doe, Jane', Note: 'said "hi"\nand left' })
  })

  it('handles CRLF endings and a BOM', () => {
    const parsed = parseCsv('﻿A,B\r\n1,2\r\n')
    expect(parsed.headers).toEqual(['A', 'B'])
    expect(parsed.rows).toEqual([{ A: '1', B: '2' }])
  })

  it('pads short rows with empty strings — blank stays blank, never zero (§4.3)', () => {
    const parsed = parseCsv('A,B,C\n1,2\n')
    expect(parsed.rows[0]).toEqual({ A: '1', B: '2', C: '' })
  })

  it('rejects structural problems with line numbers', () => {
    expect(() => parseCsv('A,B\n1,2,3\n')).toThrow(/line 2.*2 cells|3 cells/)
    expect(() => parseCsv('A,A\n1,2\n')).toThrow(/duplicate header/)
    expect(() => parseCsv('A,"B\n1,2\n')).toThrow(/unterminated/)
    expect(() => parseCsv('')).toThrow(/empty/)
  })
})

describe('sha256Hex', () => {
  it('matches a known vector and is stable', async () => {
    // sha256("abc") — FIPS 180-2 test vector
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(await sha256Hex('abc')).toBe(await sha256Hex('abc'))
  })
})
