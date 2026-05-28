type AnimationPhase = 'highlight' | 'fadeout' | 'fadein' | 'success' | 'error'

const buildOuterStyle = (phase: AnimationPhase) => {
  switch (phase) {
    case 'highlight':
      return `
        background-color: rgba(59, 130, 246, 0.12) !important;
        border-radius: 4px !important;
        outline: 2px dashed rgba(59, 130, 246, 0.5) !important;
        outline-offset: 2px;
        transition: all 0.3s ease;
      `
    case 'fadeout':
      return `
        outline: 2px dashed rgba(59, 130, 246, 0.4) !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08) !important;
      `
    case 'fadein':
      return `
        outline: 2px solid rgba(59, 130, 246, 0.6) !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12) !important;
      `
    case 'success':
      return `
        outline: 2px solid rgba(34, 197, 94, 0.65) !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12) !important;
      `
    case 'error':
      return `
        outline: 2px solid rgba(239, 68, 68, 0.45) !important;
        outline-offset: 2px;
      `
  }
}

const buildContentStyle = (phase: AnimationPhase) => {
  switch (phase) {
    case 'highlight':
      return `
        background-color: rgba(59, 130, 246, 0.08) !important;
        border-radius: 6px !important;
      `
    case 'fadeout':
      return `
        animation: contentFadeOut 0.42s ease-out forwards;
        background-color: rgba(59, 130, 246, 0.1) !important;
        border-radius: 6px !important;
      `
    case 'fadein':
      return `
        animation: contentFadeIn 0.9s ease-out forwards;
        background-color: rgba(59, 130, 246, 0.18) !important;
        border-radius: 6px !important;
        box-shadow:
          inset 0 0 0 1px rgba(59, 130, 246, 0.24),
          0 6px 18px rgba(59, 130, 246, 0.12);
      `
    case 'success':
      return `
        animation: successFlash 1.4s ease-out;
        background-color: rgba(34, 197, 94, 0.14) !important;
        border-radius: 6px !important;
        box-shadow:
          inset 0 0 0 1px rgba(34, 197, 94, 0.18),
          0 6px 18px rgba(34, 197, 94, 0.08);
      `
    case 'error':
      return `
        animation: errorFlash 0.6s ease-out;
        background-color: rgba(239, 68, 68, 0.08) !important;
        border-radius: 6px !important;
      `
  }
}

export function buildBlockTransitionStyleRule(params: {
  blockId: string | null
  phase: AnimationPhase
}): string {
  const { blockId, phase } = params

  if (!blockId) {
    return ''
  }

  return `
    [data-node-type="blockOuter"][data-id="${blockId}"] {
      ${buildOuterStyle(phase)}
    }

    [data-node-type="blockOuter"][data-id="${blockId}"] .bn-block-content {
      ${buildContentStyle(phase)}
    }
  `
}

export function buildRewriteDiffStyleRule(params: {
  blockId: string | null
  paragraphFallback: boolean
}): string {
  const { blockId, paragraphFallback } = params

  if (!blockId || !paragraphFallback) {
    return ''
  }

  return `
    [data-node-type="blockOuter"][data-id="${blockId}"] .bn-block-content {
      background: rgba(34, 197, 94, 0.14) !important;
      border-radius: 6px !important;
      box-shadow:
        inset 0 0 0 1px rgba(34, 197, 94, 0.18),
        0 4px 12px rgba(34, 197, 94, 0.06);
    }
  `
}
