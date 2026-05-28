import type { RewriteMotionPhase } from './rewriteMotionState'

export type RewriteSnapshotOverlay = {
  blockId: string
  text: string
  rect: {
    top: number
    left: number
    width: number
    height: number
  }
}

export function buildRewriteSnapshotOverlay(input: {
  blockId: string
  text: string
  top: number
  left: number
  width: number
  height: number
}): RewriteSnapshotOverlay {
  return {
    blockId: input.blockId,
    text: input.text,
    rect: {
      top: input.top,
      left: input.left,
      width: input.width,
      height: input.height,
    },
  }
}

export function shouldRenderSnapshotOverlay(phase: RewriteMotionPhase): boolean {
  return phase === 'writing' || phase === 'morphing'
}
