import { describe, expect, it } from 'vitest'
import {
  MIN_REWRITE_TRANSITION_MS,
  REWRITE_SUCCESS_FLASH_MS,
  REWRITE_SUCCESS_SETTLE_MS,
  getRewriteCompletionCleanupPlan,
  getNextRewriteRunId,
  getIncomingAnimationBlockId,
  getRewriteEndStrategy,
  getRewritePreflightFailureCleanupPlan,
  resolveDisplayedRewriteStatus,
  shouldQueueIncomingRewriteSnapshot,
  shouldLockRewriteInteractions,
  shouldReleaseRewriteLockBeforeVisualSettle,
  getRewriteSuccessCleanupDelayMs,
  getRewriteSuccessSettleDelayMs,
  getRewriteTransitionDelayMs,
  resolveRewriteMotionProfile,
  shouldRunScheduledRewriteEffect,
  shouldApplyRemoteRewriteStatus,
} from '../../rewriteTransitionPolicy'
import type { RewriteStatus } from '../../../../pages/Apps/types'

describe('getIncomingAnimationBlockId', () => {
  it('prefers the actual inserted block id returned by BlockNote replaceBlocks', () => {
    expect(
      getIncomingAnimationBlockId({
        insertedBlockIds: ['paragraph-inserted'],
        replacementBlockIds: ['paragraph-replacement'],
        nextEditorBlockIds: ['heading-1', 'paragraph-after-replace', 'paragraph-2'],
        changedIndex: 1,
      }),
    ).toBe('paragraph-inserted')
  })

  it('prefers the replacement block id produced by the parser when available', () => {
    expect(
      getIncomingAnimationBlockId({
        insertedBlockIds: [],
        replacementBlockIds: ['paragraph-replacement'],
        nextEditorBlockIds: ['heading-1', 'paragraph-old', 'paragraph-2'],
        changedIndex: 1,
      }),
    ).toBe('paragraph-replacement')
  })

  it('targets the new editor block id after a single-block replacement', () => {
    expect(
      getIncomingAnimationBlockId({
        insertedBlockIds: [],
        replacementBlockIds: [],
        nextEditorBlockIds: ['heading-1', 'paragraph-new', 'paragraph-2'],
        changedIndex: 1,
      }),
    ).toBe('paragraph-new')
  })

  it('returns null when the changed index is unavailable', () => {
    expect(
      getIncomingAnimationBlockId({
        insertedBlockIds: [],
        replacementBlockIds: [],
        nextEditorBlockIds: ['heading-1'],
        changedIndex: 2,
      }),
    ).toBeNull()
  })
})

describe('getRewriteTransitionDelayMs', () => {
  it('keeps a minimum visible transition window after the first delta', () => {
    expect(
      getRewriteTransitionDelayMs({
        firstDeltaAt: 1000,
        now: 1080,
      }),
    ).toBe(MIN_REWRITE_TRANSITION_MS - 80)
  })

  it('does not add delay when the minimum window already elapsed', () => {
    expect(
      getRewriteTransitionDelayMs({
        firstDeltaAt: 1000,
        now: 1700,
      }),
    ).toBe(0)
  })

  it('does not add delay when no delta was received', () => {
    expect(
      getRewriteTransitionDelayMs({
        firstDeltaAt: null,
        now: 1400,
      }),
    ).toBe(0)
  })
})

describe('shouldApplyRemoteRewriteStatus', () => {
  it('ignores remote idle because local onEnd owns the settle timing', () => {
    expect(shouldApplyRemoteRewriteStatus('idle')).toBe(false)
  })

  it.each(['thinking', 'writing', 'error'] satisfies RewriteStatus[])(
    'keeps actionable remote status %s',
    (status) => {
      expect(shouldApplyRemoteRewriteStatus(status)).toBe(true)
    },
  )
})

describe('rewrite completion timing', () => {
  it('keeps a visible settle window before switching from fade-in to success', () => {
    expect(getRewriteSuccessSettleDelayMs()).toBe(REWRITE_SUCCESS_SETTLE_MS)
    expect(REWRITE_SUCCESS_SETTLE_MS).toBeGreaterThanOrEqual(900)
  })

  it('keeps the success flash mounted long enough to be noticeable', () => {
    expect(getRewriteSuccessCleanupDelayMs()).toBe(REWRITE_SUCCESS_FLASH_MS)
    expect(REWRITE_SUCCESS_FLASH_MS).toBeGreaterThanOrEqual(1500)
  })
})

describe('rewrite end strategy', () => {
  it('treats stream end without any applied snapshot as a missing-result error', () => {
    expect(
      getRewriteEndStrategy({
        hasAppliedSnapshot: false,
        hasPendingIncomingProps: false,
      }),
    ).toBe('missing-result')
  })

  it('allows local settle only after a snapshot is available to apply', () => {
    expect(
      getRewriteEndStrategy({
        hasAppliedSnapshot: true,
        hasPendingIncomingProps: false,
      }),
    ).toBe('apply')

    expect(
      getRewriteEndStrategy({
        hasAppliedSnapshot: false,
        hasPendingIncomingProps: true,
      }),
    ).toBe('apply')
  })
})

describe('rewrite interaction guards', () => {
  it('keeps showing thinking while a rewrite is still locally locked before any visible motion', () => {
    expect(
      resolveDisplayedRewriteStatus({
        rewriteStatus: 'idle',
        isRewriting: true,
        motionPhase: 'locked',
      }),
    ).toBe('thinking')
  })

  it('keeps showing writing while local motion is still active even if the raw status fell back to idle', () => {
    expect(
      resolveDisplayedRewriteStatus({
        rewriteStatus: 'idle',
        isRewriting: false,
        motionPhase: 'writing',
      }),
    ).toBe('writing')
  })

  it('keeps rewrite interactions locked while motion or transitions are still active', () => {
    expect(
      shouldLockRewriteInteractions({
        isRewriting: false,
        rewriteStatus: 'idle',
        motionPhase: 'writing',
        hasActiveTransition: false,
        needsRecovery: false,
      }),
    ).toBe(true)

    expect(
      shouldLockRewriteInteractions({
        isRewriting: false,
        rewriteStatus: 'idle',
        motionPhase: null,
        hasActiveTransition: true,
        needsRecovery: false,
      }),
    ).toBe(true)
  })

  it('unlocks rewrite interactions only after local status and visuals are fully idle', () => {
    expect(
      shouldLockRewriteInteractions({
        isRewriting: false,
        rewriteStatus: 'idle',
        motionPhase: null,
        hasActiveTransition: false,
        needsRecovery: false,
      }),
    ).toBe(false)
  })
})

describe('incoming rewrite snapshots', () => {
  it('does not queue incoming props during rewrite when raw content and canonical shape are unchanged', () => {
    expect(
      shouldQueueIncomingRewriteSnapshot({
        previousRawContent: 'same report',
        nextRawContent: 'same report',
        changedCanonicalBlockIdsCount: 0,
      }),
    ).toBe(false)
  })

  it('queues incoming props during rewrite when the raw report content changed', () => {
    expect(
      shouldQueueIncomingRewriteSnapshot({
        previousRawContent: 'old report',
        nextRawContent: 'new report',
        changedCanonicalBlockIdsCount: 0,
      }),
    ).toBe(true)
  })

  it('queues incoming props during rewrite when canonical block changes are detected', () => {
    expect(
      shouldQueueIncomingRewriteSnapshot({
        previousRawContent: 'same report',
        nextRawContent: 'same report',
        changedCanonicalBlockIdsCount: 1,
      }),
    ).toBe(true)
  })
})

describe('rewrite cleanup plan', () => {
  it('clears any leftover transition immediately when no incoming animation block is available', () => {
    expect(
      getRewriteCompletionCleanupPlan({
        incomingAnimationBlockId: null,
      }),
    ).toEqual({
      clearActiveTransitionImmediately: true,
      needsDelayedSuccessCleanup: false,
    })
  })

  it('keeps delayed success cleanup when an incoming animation block exists', () => {
    expect(
      getRewriteCompletionCleanupPlan({
        incomingAnimationBlockId: 'block-1',
      }),
    ).toEqual({
      clearActiveTransitionImmediately: false,
      needsDelayedSuccessCleanup: true,
    })
  })
})

describe('rewrite preflight failure cleanup', () => {
  it('clears transition and motion state immediately when rewrite is rejected before request start', () => {
    expect(getRewritePreflightFailureCleanupPlan()).toEqual({
      clearActiveTransitionImmediately: true,
      clearMotionImmediately: true,
      clearOverlaysImmediately: true,
      releaseRewriteLockImmediately: true,
    })
  })
})

describe('rewrite run guards', () => {
  it('increments the rewrite run id monotonically', () => {
    expect(getNextRewriteRunId(0)).toBe(1)
    expect(getNextRewriteRunId(4)).toBe(5)
  })

  it('only lets timers from the latest rewrite run mutate UI state', () => {
    expect(
      shouldRunScheduledRewriteEffect({
        scheduledRunId: 2,
        activeRunId: 3,
      }),
    ).toBe(false)

    expect(
      shouldRunScheduledRewriteEffect({
        scheduledRunId: 3,
        activeRunId: 3,
      }),
    ).toBe(true)
  })
})

describe('rewrite lock timing', () => {
  it('keeps the rewrite lock until local visual settle is scheduled', () => {
    expect(shouldReleaseRewriteLockBeforeVisualSettle()).toBe(false)
  })
})

describe('resolveRewriteMotionProfile', () => {
  it('disables blur and overlay morph when reduced motion is enabled', () => {
    expect(resolveRewriteMotionProfile({ prefersReducedMotion: true })).toEqual({
      useOverlayMorph: false,
      useBlur: false,
      useDiffEmphasis: true,
      settleMs: 0,
    })
  })
})
