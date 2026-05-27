export type Occurrence = { startUtf16: number; endUtf16: number }

export function utf16IndexToCodePointIndex(s: string, utf16Index: number): number {
  let codePointIndex = 0
  let utf16Pos = 0

  for (const char of s) {
    if (utf16Pos >= utf16Index) {
      return codePointIndex
    }
    utf16Pos += char.length
    codePointIndex += 1
  }

  return codePointIndex
}

export function codePointIndexToUtf16Index(s: string, codePointIndex: number): number {
  let utf16Index = 0
  let codePointPos = 0

  for (const char of s) {
    if (codePointPos >= codePointIndex) {
      return utf16Index
    }
    utf16Index += char.length
    codePointPos += 1
  }

  return utf16Index
}

export function applyDeltaByCodePoints(
  base: string,
  startCodePoint: number,
  endCodePoint: number,
  rewrittenText: string
): string {
  const startUtf16 = codePointIndexToUtf16Index(base, startCodePoint)
  const endUtf16 = codePointIndexToUtf16Index(base, endCodePoint)

  return base.slice(0, startUtf16) + rewrittenText + base.slice(endUtf16)
}

export function findAllOccurrencesUtf16(base: string, needle: string, allowOverlap = true): Occurrence[] {
  if (!needle) {
    return []
  }

  const occurrences: Occurrence[] = []
  let searchPos = 0

  while (searchPos < base.length) {
    const foundIndex = base.indexOf(needle, searchPos)
    if (foundIndex === -1) {
      break
    }

    occurrences.push({
      startUtf16: foundIndex,
      endUtf16: foundIndex + needle.length,
    })

    searchPos = allowOverlap ? foundIndex + 1 : foundIndex + needle.length
  }

  return occurrences
}

export function buildContextSnippet(
  base: string,
  startUtf16: number,
  endUtf16: number,
  contextLen: number
): string {
  const contextStart = Math.max(0, startUtf16 - contextLen)
  const contextEnd = Math.min(base.length, endUtf16 + contextLen)

  return base.slice(contextStart, contextEnd)
}
