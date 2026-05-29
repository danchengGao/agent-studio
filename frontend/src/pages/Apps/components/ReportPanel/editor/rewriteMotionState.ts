export type RewriteMotionPhase =
  | 'idle'
  | 'locked'
  | 'writing'
  | 'morphing'
  | 'settling'
  | 'error'

export type RewriteMotionSession = {
  runId: number
  blockId: string
  phase: Exclude<RewriteMotionPhase, 'idle'>
}

export function createRewriteMotionSession(input: {
  runId: number
  blockId: string
}): RewriteMotionSession {
  return {
    runId: input.runId,
    blockId: input.blockId,
    phase: 'locked',
  }
}

export function advanceRewriteMotionPhase(
  session: RewriteMotionSession,
  phase: Exclude<RewriteMotionPhase, 'idle'>,
): RewriteMotionSession {
  return {
    ...session,
    phase,
  }
}

export function shouldKeepRewriteLocked(phase: RewriteMotionPhase): boolean {
  return phase !== 'idle'
}
