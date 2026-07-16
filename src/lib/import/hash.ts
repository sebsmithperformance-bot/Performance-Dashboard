/**
 * File hashing for duplicate-import detection (§4.2 step 1). WebCrypto is
 * available in both browsers and Node ≥ 20, so one implementation serves the
 * UI, the local backend, and tests.
 */

export async function sha256Hex(content: string | Uint8Array): Promise<string> {
  const bytes =
    typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content)
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
