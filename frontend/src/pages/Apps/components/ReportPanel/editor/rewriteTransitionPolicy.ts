import type { RewriteStatus } from '@/pages/Apps/types'
import type { RewriteMotionPhase } from './rewriteMotionState'

export const MIN_REWRITE_TRANSITION_MS = 650
export const REWRITE_SUCCESS_SETTLE_MS = 950
export const REWRITE_SUCCESS_FLASH_MS = 1600

export function resolveRewriteMotionProfile(params: {
  prefersReducedMotion: boolean
}): {
  useOverlayMorph: boolean
  useBlur: boolean
  useDiffEmphasis: boolean
  settleMs: number
} {
  if (params.prefersReducedMotion) {
    return {
      useOverlayMorph: false,
      useBlur: false,
      useDiffEmphasis: true,
      settleMs: 0,
    }
  }

  return {
    useOverlayMorph: true,
    useBlur: true,
    useDiffEmphasis: true,
    settleMs: REWRITE_SUCCESS_SETTLE_MS,
  }
}

export function getIncomingAnimationBlockId(params: {
  insertedBlockIds: string[]
  replacementBlockIds: string[]
  nextEditorBlockIds: string[]
  changedIndex: number | null
}): string | null {
  const { insertedBlockIds, replacementBlockIds, nextEditorBlockIds, changedIndex } = params

  if (insertedBlockIds.length > 0) {
    return insertedBlockIds[0] ?? null
  }

  if (replacementBlockIds.length > 0) {
    return replacementBlockIds[0] ?? null
  }

  if (changedIndex === null || changedIndex < 0 || changedIndex >= nextEditorBlockIds.length) {
    return null
  }

  return nextEditorBlockIds[changedIndex] ?? null
}

export function getRewriteTransitionDelayMs(params: {
  firstDeltaAt: number | null
  now: number
}): number {
  const { firstDeltaAt, now } = params

  if (firstDeltaAt === null) {
    return 0
  }

  return Math.max(0, MIN_REWRITE_TRANSITION_MS - (now - firstDeltaAt))
}

export function shouldApplyRemoteRewriteStatus(status: RewriteStatus): boolean {
  return status !== 'idle'
}

export function getRewriteEndStrategy(params: {
  hasAppliedSnapshot: boolean
  hasPendingIncomingProps: boolean
}): 'apply' | 'missing-result' {
  return params.hasAppliedSnapshot || params.hasPendingIncomingProps ? 'apply' : 'missing-result'
}

export function resolveDisplayedRewriteStatus(params: {
  rewriteStatus: RewriteStatus
  isRewriting: boolean
  motionPhase: RewriteMotionPhase | null
}): RewriteStatus {
  const { rewriteStatus, isRewriting, motionPhase } = params

  if (rewriteStatus !== 'idle') {
    return rewriteStatus
  }

  if (motionPhase === 'error') {
    return 'error'
  }

  if (motionPhase === 'writing' || motionPhase === 'morphing' || motionPhase === 'settling') {
    return 'writing'
  }

  if (isRewriting || motionPhase === 'locked') {
    return 'thinking'
  }

  return 'idle'
}

export function shouldLockRewriteInteractions(params: {
  isRewriting: boolean
  rewriteStatus: RewriteStatus
  motionPhase: RewriteMotionPhase | null
  hasActiveTransition: boolean
  needsRecovery: boolean
}): boolean {
  const { isRewriting, rewriteStatus, motionPhase, hasActiveTransition, needsRecovery } = params

  if (needsRecovery) {
    return true
  }

  if (hasActiveTransition) {
    return true
  }

  return (
    isRewriting ||
    resolveDisplayedRewriteStatus({
      rewriteStatus,
      isRewriting,
      motionPhase,
    }) !== 'idle'
  )
}

export function shouldQueueIncomingRewriteSnapshot(params: {
  previousRawContent: string
  nextRawContent: string
  changedCanonicalBlockIdsCount: number
}): boolean {
  const { previousRawContent, nextRawContent, changedCanonicalBlockIdsCount } = params

  return previousRawContent !== nextRawContent || changedCanonicalBlockIdsCount > 0
}

export function getRewriteCompletionCleanupPlan(params: {
  incomingAnimationBlockId: string | null
}): {
  clearActiveTransitionImmediately: boolean
  needsDelayedSuccessCleanup: boolean
} {
  const { incomingAnimationBlockId } = params

  return incomingAnimationBlockId
    ? {
        clearActiveTransitionImmediately: false,
        needsDelayedSuccessCleanup: true,
      }
    : {
        clearActiveTransitionImmediately: true,
        needsDelayedSuccessCleanup: false,
      }
}

export function getRewritePreflightFailureCleanupPlan(): {
  clearActiveTransitionImmediately: boolean
  clearMotionImmediately: boolean
  clearOverlaysImmediately: boolean
  releaseRewriteLockImmediately: boolean
} {
  return {
    clearActiveTransitionImmediately: true,
    clearMotionImmediately: true,
    clearOverlaysImmediately: true,
    releaseRewriteLockImmediately: true,
  }
}

export function getRewriteSuccessSettleDelayMs(): number {
  return REWRITE_SUCCESS_SETTLE_MS
}

export function getRewriteSuccessCleanupDelayMs(): number {
  return REWRITE_SUCCESS_FLASH_MS
}

export function getNextRewriteRunId(currentRunId: number): number {
  return currentRunId + 1
}

export function shouldRunScheduledRewriteEffect(params: {
  scheduledRunId: number
  activeRunId: number
}): boolean {
  return params.scheduledRunId === params.activeRunId
}

export function shouldReleaseRewriteLockBeforeVisualSettle(): boolean {
  return false
}
