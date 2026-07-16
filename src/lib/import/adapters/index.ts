import type { Source, SourceAdapter } from '../types.ts'
import { perchAdapter } from './perch.ts'
import { playerDataAdapter } from './playerdata.ts'
import { teamBuildrAdapter } from './teambuildr.ts'

export const ADAPTERS: Record<Source, SourceAdapter> = {
  TeamBuildr: teamBuildrAdapter,
  PlayerData: playerDataAdapter,
  Perch: perchAdapter,
}

/**
 * Suggests a source from headers (§4.2 step 1). A suggestion only — the coach
 * always chooses; auto-detection never silently overrides.
 */
export function detectSource(headers: string[]): { source: Source; confidence: number } | null {
  let best: { source: Source; confidence: number } | null = null
  for (const adapter of Object.values(ADAPTERS)) {
    const confidence = adapter.detect(headers)
    if (confidence >= 0.6 && (best === null || confidence > best.confidence)) {
      best = { source: adapter.source, confidence }
    }
  }
  return best
}
