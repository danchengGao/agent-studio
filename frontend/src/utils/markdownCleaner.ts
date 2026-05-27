/**
 * Markdown preprocessing and visible-text projection helpers.
 *
 * The report editor renders a cleaned markdown document in BlockNote, while the
 * backend still expects offsets in the original raw markdown. These helpers keep
 * the cleaned/raw offset map and also provide a "visible text" projection that
 * removes markdown syntax markers while preserving a mapping back to raw offsets.
 */

export interface PreprocessResult {
  cleaned: string
  offsetMap: number[]
  blockOffsets: BlockOffset[]
}

export interface BlockOffset {
  cleanedStart: number
  cleanedEnd: number
  originalStart: number
  originalEnd: number
}

export interface VisibleProjectionResult {
  visibleText: string
  visibleToOriginalMap: number[]
}

const CITATION_PATTERN = /^\[\[(\d+)\]\]\([^)]+\)/
const INFERENCE_PATTERN = /^\[([^\]]*)\]\(#inference:\d+\)/

const BLOCK_PREFIX_PATTERNS = [
  /^ {0,3}(?:[-+*])\s+\[[ xX]\]\s+/,
  /^ {0,3}#{1,6}\s+/,
  /^ {0,3}>\s?/,
  /^ {0,3}\d+[.)]\s+/,
  /^ {0,3}[-+*]\s+/,
]

const HORIZONTAL_RULE_PATTERN = /^ {0,3}(?:[-*_])(?:\s*[-*_]){2,}\s*$/
const INLINE_STYLE_MARKERS = ['**', '__', '~~', '`', '*', '_']

/**
 * Work around a markdown emphasis edge case in the current parser stack:
 * strong segments that end with `%` can be mis-parsed in long CJK paragraphs.
 * Converting only those risky segments to literal `<strong>` tags keeps the
 * visible output unchanged while bypassing the broken delimiter pairing.
 */
export function normalizeProblematicStrongPercentForRender(markdown: string): string {
  const parts: string[] = []
  let i = 0

  while (i < markdown.length) {
    if (markdown.startsWith('```', i)) {
      const closingFenceIndex = markdown.indexOf('\n```', i + 3)
      if (closingFenceIndex === -1) {
        parts.push(markdown.slice(i))
        break
      }

      parts.push(markdown.slice(i, closingFenceIndex + 4))
      i = closingFenceIndex + 4
      continue
    }

    if (markdown[i] === '`') {
      let closingCodeIndex = i + 1
      while (closingCodeIndex < markdown.length) {
        if (markdown[closingCodeIndex] === '\\') {
          closingCodeIndex += 2
          continue
        }

        if (markdown[closingCodeIndex] === '`') {
          break
        }

        closingCodeIndex += 1
      }

      if (closingCodeIndex >= markdown.length) {
        parts.push(markdown.slice(i))
        break
      }

      parts.push(markdown.slice(i, closingCodeIndex + 1))
      i = closingCodeIndex + 1
      continue
    }

    const marker = markdown.startsWith('**', i)
      ? '**'
      : markdown.startsWith('__', i)
        ? '__'
        : null

    if (!marker) {
      parts.push(markdown[i])
      i += 1
      continue
    }

    let closingIndex = -1
    let cursor = i + marker.length

    while (cursor < markdown.length) {
      if (markdown[cursor] === '\\') {
        cursor += 2
        continue
      }

      if (markdown.startsWith(marker, cursor)) {
        closingIndex = cursor
        break
      }

      if (markdown[cursor] === '\n') {
        break
      }

      cursor += 1
    }

    if (closingIndex === -1) {
      parts.push(markdown[i])
      i += 1
      continue
    }

    const innerContent = markdown.slice(i + marker.length, closingIndex)
    const shouldNormalize = /(^|[^\\])%$/.test(innerContent)

    if (shouldNormalize) {
      parts.push(`<strong>${innerContent}</strong>`)
    } else {
      parts.push(markdown.slice(i, closingIndex + marker.length))
    }

    i = closingIndex + marker.length
  }

  return parts.join('')
}

export function preprocessMarkdown(markdown: string): PreprocessResult {
  const offsetMap: number[] = []
  const result: string[] = []
  let i = 0

  while (i < markdown.length) {
    const citationMatch = markdown.slice(i).match(CITATION_PATTERN)
    const inferenceMatch = markdown.slice(i).match(INFERENCE_PATTERN)

    if (citationMatch) {
      i += citationMatch[0].length
      continue
    }

    if (inferenceMatch) {
      const text = inferenceMatch[1] || ''
      const fullMatch = inferenceMatch[0]
      const inferenceStart = i
      const inferenceEnd = i + fullMatch.length
      const isSingleChar = text.length === 1

      for (let j = 0; j < text.length; j++) {
        if (j === 0) {
          offsetMap.push(inferenceStart)
        } else if (j === text.length - 1 && !isSingleChar) {
          offsetMap.push(inferenceEnd - 1)
        } else {
          offsetMap.push(inferenceStart + 1 + j)
        }
        result.push(text[j])
      }

      i = inferenceEnd
      continue
    }

    offsetMap.push(i)
    result.push(markdown[i])
    i += 1
  }

  const cleaned = result.join('')

  return {
    cleaned,
    offsetMap,
    blockOffsets: computeBlockOffsets(cleaned, offsetMap),
  }
}

function computeBlockOffsets(cleaned: string, offsetMap: number[]): BlockOffset[] {
  const blockOffsets: BlockOffset[] = []
  const lines = cleaned.split('\n')
  let currentPos = 0
  let blockStart = 0
  let inBlock = false

  for (const line of lines) {
    if (line.trim().length > 0) {
      if (!inBlock) {
        blockStart = currentPos
        inBlock = true
      }
    } else if (inBlock) {
      const blockEnd = currentPos
      if (blockEnd > blockStart) {
        blockOffsets.push({
          cleanedStart: blockStart,
          cleanedEnd: blockEnd,
          originalStart: offsetMap[blockStart] ?? blockStart,
          originalEnd: (offsetMap[blockEnd - 1] ?? (blockEnd - 1)) + 1,
        })
      }
      inBlock = false
    }

    currentPos += line.length + 1
  }

  if (inBlock && blockStart < cleaned.length) {
    blockOffsets.push({
      cleanedStart: blockStart,
      cleanedEnd: cleaned.length,
      originalStart: offsetMap[blockStart] ?? blockStart,
      originalEnd: (offsetMap[cleaned.length - 1] ?? (cleaned.length - 1)) + 1,
    })
  }

  return blockOffsets
}

export function mapCleanedOffsetToOriginal(
  cleanedStart: number,
  cleanedEnd: number,
  offsetMap: number[]
): { originalStart: number; originalEnd: number } {
  if (offsetMap.length === 0) {
    return { originalStart: cleanedStart, originalEnd: cleanedEnd }
  }

  const originalStart = offsetMap[cleanedStart] ?? cleanedStart
  if (cleanedEnd <= cleanedStart) {
    return { originalStart, originalEnd: originalStart }
  }

  const lastCharIndex = cleanedEnd - 1
  const originalLastCharIndex = offsetMap[lastCharIndex] ?? lastCharIndex

  return {
    originalStart,
    originalEnd: originalLastCharIndex + 1,
  }
}

export function findTextPositionInCleaned(
  selectedText: string,
  cleanedContent: string
): { start: number; end: number } | null {
  const index = cleanedContent.indexOf(selectedText)
  if (index === -1) {
    return null
  }

  return {
    start: index,
    end: index + selectedText.length,
  }
}

export function getOriginalTextFromCleaned(
  cleanedStart: number,
  cleanedEnd: number,
  rawContent: string,
  offsetMap: number[]
): string {
  const { originalStart, originalEnd } = mapCleanedOffsetToOriginal(
    cleanedStart,
    cleanedEnd,
    offsetMap
  )

  return rawContent.slice(originalStart, originalEnd)
}

const pushVisibleChar = (
  ch: string,
  cleanedIndex: number,
  visibleText: string[],
  visibleToOriginalMap: number[],
  offsetMap: number[]
) => {
  visibleText.push(ch)
  visibleToOriginalMap.push(offsetMap[cleanedIndex] ?? cleanedIndex)
}

const findMatchingParen = (content: string, openParenIndex: number) => {
  let depth = 0

  for (let i = openParenIndex; i < content.length; i++) {
    const ch = content[i]

    if (ch === '\\') {
      i += 1
      continue
    }

    if (ch === '(') {
      depth += 1
      continue
    }

    if (ch === ')') {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

const parseMarkdownLink = (content: string, startIndex: number) => {
  const isImage = content[startIndex] === '!' && content[startIndex + 1] === '['
  const labelStart = isImage ? startIndex + 2 : startIndex + 1

  if (content[labelStart - 1] !== '[') {
    return null
  }

  let labelEnd = -1
  for (let i = labelStart; i < content.length; i++) {
    const ch = content[i]
    if (ch === '\\') {
      i += 1
      continue
    }
    if (ch === ']') {
      labelEnd = i
      break
    }
  }

  if (labelEnd === -1 || content[labelEnd + 1] !== '(') {
    return null
  }

  const urlEnd = findMatchingParen(content, labelEnd + 1)
  if (urlEnd === -1) {
    return null
  }

  return {
    labelStart,
    labelEnd,
    urlEnd,
  }
}

export function buildVisibleProjection(
  cleanedContent: string,
  offsetMap: number[]
): VisibleProjectionResult {
  const visibleText: string[] = []
  const visibleToOriginalMap: number[] = []
  let i = 0
  let lineStart = true

  while (i < cleanedContent.length) {
    const ch = cleanedContent[i]

    if (ch === '\r') {
      i += 1
      continue
    }

    if (ch === '\n') {
      pushVisibleChar('\n', i, visibleText, visibleToOriginalMap, offsetMap)
      i += 1
      lineStart = true
      continue
    }

    if (lineStart) {
      const lineEnd = cleanedContent.indexOf('\n', i)
      const currentLine = cleanedContent.slice(i, lineEnd === -1 ? cleanedContent.length : lineEnd)

      if (currentLine.startsWith('```')) {
        i += currentLine.length
        lineStart = false
        continue
      }

      if (HORIZONTAL_RULE_PATTERN.test(currentLine)) {
        i += currentLine.length
        lineStart = false
        continue
      }

      let skippedPrefix = false

      for (const pattern of BLOCK_PREFIX_PATTERNS) {
        const match = currentLine.match(pattern)
        if (match) {
          i += match[0].length
          skippedPrefix = true
          break
        }
      }

      if (skippedPrefix) {
        lineStart = false
        continue
      }
    }

    if (ch === '\\' && i + 1 < cleanedContent.length) {
      pushVisibleChar(cleanedContent[i + 1], i + 1, visibleText, visibleToOriginalMap, offsetMap)
      i += 2
      lineStart = false
      continue
    }

    const link = ch === '[' || (ch === '!' && cleanedContent[i + 1] === '[')
      ? parseMarkdownLink(cleanedContent, i)
      : null

    if (link) {
      for (let j = link.labelStart; j < link.labelEnd; j++) {
        const labelChar = cleanedContent[j]
        if (labelChar === '\\' && j + 1 < link.labelEnd) {
          j += 1
          pushVisibleChar(cleanedContent[j], j, visibleText, visibleToOriginalMap, offsetMap)
        } else {
          pushVisibleChar(labelChar, j, visibleText, visibleToOriginalMap, offsetMap)
        }
      }

      i = link.urlEnd + 1
      lineStart = false
      continue
    }

    const inlineMarker = INLINE_STYLE_MARKERS.find(marker => cleanedContent.startsWith(marker, i))
    if (inlineMarker) {
      i += inlineMarker.length
      lineStart = false
      continue
    }

    pushVisibleChar(ch, i, visibleText, visibleToOriginalMap, offsetMap)
    i += 1
    lineStart = false
  }

  return {
    visibleText: visibleText.join(''),
    visibleToOriginalMap,
  }
}
