import type {
  RewriteMockDiagnostic,
  RewriteRequest,
  RewriteRequestMismatchReason,
} from '../types'

const normalizeText = (value: string | undefined): string => (value ?? '').trim()

export const isSameRewriteRequest = (
  source: RewriteRequest,
  target: RewriteRequest
): boolean => (
  source.action === target.action &&
  normalizeText(source.selectedText) === normalizeText(target.selectedText) &&
  source.startOffset === target.startOffset &&
  source.endOffset === target.endOffset &&
  normalizeText(source.userInstruction) === normalizeText(target.userInstruction)
)

export const isRelaxedRewriteRequestMatch = (
  source: RewriteRequest,
  target: RewriteRequest
): boolean => (
  source.action === target.action &&
  normalizeText(source.selectedText) === normalizeText(target.selectedText) &&
  normalizeText(source.userInstruction) === normalizeText(target.userInstruction)
)

export const isFuzzyRewriteRequestMatch = (
  source: RewriteRequest,
  target: RewriteRequest
): boolean => {
  if (source.action !== target.action) return false

  const sourceText = normalizeText(source.selectedText)
  const targetText = normalizeText(target.selectedText)
  if (!sourceText || !targetText) return false

  return sourceText.includes(targetText) || targetText.includes(sourceText)
}

const getMismatchReasons = (
  source: RewriteRequest,
  target: RewriteRequest
): RewriteRequestMismatchReason[] => {
  const mismatches: RewriteRequestMismatchReason[] = []

  if (source.action !== target.action) {
    mismatches.push('action')
  }

  if (normalizeText(source.selectedText) !== normalizeText(target.selectedText)) {
    mismatches.push('selectedText')
  }

  if (source.startOffset !== target.startOffset || source.endOffset !== target.endOffset) {
    mismatches.push('offset')
  }

  if (normalizeText(source.userInstruction) !== normalizeText(target.userInstruction)) {
    mismatches.push('userInstruction')
  }

  return mismatches
}

export const getRewriteMockDiagnostic = (
  sourceRequests: RewriteRequest[],
  target: RewriteRequest
): RewriteMockDiagnostic | null => {
  if (sourceRequests.length === 0) {
    return null
  }

  let bestCandidate: RewriteRequest | null = null
  let bestMismatches: RewriteRequestMismatchReason[] | null = null

  for (const source of sourceRequests) {
    const mismatches = getMismatchReasons(source, target)

    if (
      !bestMismatches ||
      mismatches.length < bestMismatches.length ||
      (
        mismatches.length === bestMismatches.length &&
        mismatches.filter((reason) => reason !== 'offset').length <
          bestMismatches.filter((reason) => reason !== 'offset').length
      )
    ) {
      bestCandidate = source
      bestMismatches = mismatches
    }
  }

  if (!bestCandidate || !bestMismatches) {
    return null
  }

  return {
    closestRequest: { ...bestCandidate },
    mismatchReasons: bestMismatches,
  }
}
