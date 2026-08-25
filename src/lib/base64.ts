/**
 * base64url, shared by the roster link and the encrypted roster file.
 *
 * Both need a form with no +, / or = in it: one rides in a URL that gets texted,
 * the other sits in a JSON file. Padding is dropped on the way out and not
 * required on the way in, which is what `atob` already tolerates.
 */

export function bytesToBase64Url(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = ''
  // Built one char at a time rather than by spreading into fromCharCode, which
  // blows the argument limit on large inputs.
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Null rather than a throw, because the input is usually a link somebody edited.
 *
 * The return type is pinned to a plain ArrayBuffer rather than left generic, so
 * these bytes satisfy WebCrypto's BufferSource without a cast at every call.
 */
export function base64UrlToBytes(encoded: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

export function textToBase64Url(text: string): string {
  return bytesToBase64Url(new TextEncoder().encode(text))
}

export function base64UrlToText(encoded: string): string | null {
  const bytes = base64UrlToBytes(encoded)
  return bytes === null ? null : new TextDecoder().decode(bytes)
}
