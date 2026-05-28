import type { CanonicalDocument } from './canonical'

export function resolveEditorBootstrapCanonical(params: {
  existingBootstrap: CanonicalDocument | null
  incomingCanonical: CanonicalDocument | null | undefined
  buildFallback: () => CanonicalDocument
}): CanonicalDocument {
  if (params.existingBootstrap) {
    return params.existingBootstrap
  }

  if (params.incomingCanonical) {
    return params.incomingCanonical
  }

  return params.buildFallback()
}
