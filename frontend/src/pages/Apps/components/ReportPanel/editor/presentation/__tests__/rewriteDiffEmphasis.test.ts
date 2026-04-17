import { describe, expect, it } from 'vitest'
import {
  buildRewriteDiffEmphasis,
  shouldFallbackToParagraphEmphasis,
} from '../../rewriteDiffEmphasis'

describe('rewrite diff emphasis', () => {
  it('returns changed ranges for a simple replacement', () => {
    expect(
      buildRewriteDiffEmphasis({
        previousText: 'Revenue stayed stable.',
        nextText: 'Revenue improved modestly.',
      }),
    ).toEqual([{ start: 8, end: 26 }])
  })

  it('falls back to paragraph emphasis when the diff fragments are too noisy', () => {
    expect(
      shouldFallbackToParagraphEmphasis([
        { start: 0, end: 1 },
        { start: 2, end: 3 },
        { start: 4, end: 5 },
      ]),
    ).toBe(true)
  })
})
