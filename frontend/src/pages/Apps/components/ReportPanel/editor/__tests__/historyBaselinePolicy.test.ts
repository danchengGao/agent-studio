import { describe, expect, it } from 'vitest'
import { shouldApplyExternalSnapshot } from '@/pages/Apps/components/ReportPanel/editor/historyBaselinePolicy'

describe('shouldApplyExternalSnapshot', () => {
  it('skips reapplying an identical snapshot after the editor baseline has been initialized', () => {
    expect(
      shouldApplyExternalSnapshot({
        previousRawContent: '# report',
        nextRawContent: '# report',
        changedCanonicalBlockIdsCount: 0,
        hasCurrentViewModel: true,
      }),
    ).toBe(false)
  })

  it('allows bootstrap when no editor view model exists yet', () => {
    expect(
      shouldApplyExternalSnapshot({
        previousRawContent: '# report',
        nextRawContent: '# report',
        changedCanonicalBlockIdsCount: 0,
        hasCurrentViewModel: false,
      }),
    ).toBe(true)
  })

  it('applies the snapshot when canonical blocks changed under the same markdown', () => {
    expect(
      shouldApplyExternalSnapshot({
        previousRawContent: '# report',
        nextRawContent: '# report',
        changedCanonicalBlockIdsCount: 1,
        hasCurrentViewModel: true,
      }),
    ).toBe(true)
  })

  it('applies the snapshot when markdown changed', () => {
    expect(
      shouldApplyExternalSnapshot({
        previousRawContent: '# report',
        nextRawContent: '# updated report',
        changedCanonicalBlockIdsCount: 0,
        hasCurrentViewModel: true,
      }),
    ).toBe(true)
  })
})
