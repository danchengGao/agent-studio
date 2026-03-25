/**
 * Markdown 预处理工具
 *
 * @description
 * 预处理 Markdown 内容，移除 citation 和 inference 标记，同时维护偏移量映射关系
 * 用于 BlockNote 编辑器显示与原始内容的对应
 *
 * 处理的格式：
 * - Citation: [[35]](url) -> (移除)
 * - Inference: [文本](#inference:0) -> 保留文本
 * - 普通链接: [文本](url) -> 保留（不处理）
 */

export interface PreprocessResult {
  /** 预处理后的内容（移除 citation 和 inference 标记） */
  cleaned: string
  /** 偏移量映射：cleanedIndex -> originalIndex */
  offsetMap: number[]
  /** 块位置信息 */
  blockOffsets: BlockOffset[]
}

export interface BlockOffset {
  /** 在 cleanedContent 中的起始位置 */
  cleanedStart: number
  /** 在 cleanedContent 中的结束位置 */
  cleanedEnd: number
  /** 在 rawContent 中的起始位置 */
  originalStart: number
  /** 在 rawContent 中的结束位置 */
  originalEnd: number
}

// Citation 格式: [[35]](url) - 双括号数字链接
const CITATION_PATTERN = /^\[\[(\d+)\]\]\([^)]+\)/

// Inference 格式: [文本](#inference:0) - 带 #inference: 的链接
// 需要捕获文本部分以便保留
const INFERENCE_PATTERN = /^\[([^\]]*)\]\(#inference:\d+\)/

export function preprocessMarkdown(markdown: string): PreprocessResult {
  const offsetMap: number[] = []
  const result: string[] = []
  let i = 0

  while (i < markdown.length) {
    const citationMatch = markdown.slice(i).match(CITATION_PATTERN)
    const inferenceMatch = markdown.slice(i).match(INFERENCE_PATTERN)

    if (citationMatch) {
      // Citation 完全移除
      i += citationMatch[0].length
    } else if (inferenceMatch) {
      // Inference 保留文本，只移除链接语法
      // inferenceMatch[0] = "[文本](#inference:0)"
      // inferenceMatch[1] = "文本"
      const text = inferenceMatch[1] || ''
      const fullMatch = inferenceMatch[0]

      // 记录 inference 范围
      const inferenceStart = i  // '[' 的位置
      const inferenceEnd = i + fullMatch.length  // 整个标记后的位置

      // 保留文本部分
      // 第一个字符映射到 '[' 的位置，最后一个字符映射到 ')' 之前的位置
      // 这样 mapCleanedOffsetToOriginal 时，范围会包含完整的 inference 标记
      const isSingleChar = text.length === 1
      for (let j = 0; j < text.length; j++) {
        if (j === 0) {
          // 第一个字符映射到 '[' 的位置
          offsetMap.push(inferenceStart)
        } else if (j === text.length - 1 && !isSingleChar) {
          // 最后一个字符（非单字符情况）映射到 ')' 之前的位置
          // 这样 +1 后就是 inferenceEnd
          offsetMap.push(inferenceEnd - 1)
        } else {
          // 中间字符映射到实际位置（跳过 '['）
          offsetMap.push(inferenceStart + 1 + j)
        }
        result.push(text[j])
      }

      // 跳过整个 inference 标记 `[文本](#inference:id)`
      i = inferenceEnd
    } else {
      offsetMap.push(i)
      result.push(markdown[i])
      i++
    }
  }

  const cleaned = result.join('')

  const blockOffsets = computeBlockOffsets(cleaned, offsetMap)

  return {
    cleaned,
    offsetMap,
    blockOffsets,
  }
}

function computeBlockOffsets(cleaned: string, offsetMap: number[]): BlockOffset[] {
  const blockOffsets: BlockOffset[] = []

  const lines = cleaned.split('\n')
  let currentPos = 0
  let blockStart = 0
  let inBlock = false

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    const lineLength = line.length

    if (line.trim().length > 0) {
      if (!inBlock) {
        blockStart = currentPos
        inBlock = true
      }
    } else {
      if (inBlock) {
        const blockEnd = currentPos
        if (blockEnd > blockStart) {
          blockOffsets.push({
            cleanedStart: blockStart,
            cleanedEnd: blockEnd,
            originalStart: offsetMap[blockStart] ?? blockStart,
            originalEnd: (offsetMap[blockEnd - 1] ?? blockEnd - 1) + 1,
          })
        }
        inBlock = false
      }
    }

    currentPos += lineLength + 1
  }

  if (inBlock && blockStart < cleaned.length) {
    blockOffsets.push({
      cleanedStart: blockStart,
      cleanedEnd: cleaned.length,
      originalStart: offsetMap[blockStart] ?? blockStart,
      originalEnd: (offsetMap[cleaned.length - 1] ?? cleaned.length - 1) + 1,
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
  const originalEnd = originalLastCharIndex + 1

  return { originalStart, originalEnd }
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
