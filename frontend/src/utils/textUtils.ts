/**
 * Normalize line endings and whitespace in text.
 * - Converts CRLF and CR to LF
 * - Converts non-breaking spaces (U+00A0) to regular spaces
 */
export const normalizeText = (text: string): string =>
  text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00A0/g, ' ')

/**
 * Normalize whitespace: collapse consecutive whitespace to single space and trim.
 */
export const normalizeWhitespace = (text: string): string =>
  normalizeText(text).replace(/\s+/g, ' ').trim()

/**
 * Truncate text with ellipsis for preview display.
 */
export const getTextPreview = (text: string, maxLength = 120): string => {
  const escaped = normalizeText(text).replace(/\n/g, '\\n')
  return escaped.length > maxLength ? `${escaped.slice(0, maxLength)}...` : escaped
}
