export type RewriteDiffRange = {
  start: number
  end: number
}

export function buildRewriteDiffEmphasis(input: {
  previousText: string
  nextText: string
}): RewriteDiffRange[] {
  const { previousText, nextText } = input

  if (previousText === nextText) {
    return []
  }

  let start = 0
  while (
    start < previousText.length &&
    start < nextText.length &&
    previousText[start] === nextText[start]
  ) {
    start += 1
  }

  let previousEnd = previousText.length
  let nextEnd = nextText.length
  while (
    previousEnd > start &&
    nextEnd > start &&
    previousText[previousEnd - 1] === nextText[nextEnd - 1]
  ) {
    previousEnd -= 1
    nextEnd -= 1
  }

  return [{ start, end: Math.min(nextText.length, nextEnd + 1) }]
}

export function shouldFallbackToParagraphEmphasis(ranges: RewriteDiffRange[]): boolean {
  return ranges.length >= 3
}
