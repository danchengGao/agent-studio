type ExternalSnapshotPolicyInput = {
  previousRawContent: string
  nextRawContent: string
  changedCanonicalBlockIdsCount: number
  hasCurrentViewModel: boolean
}

export const shouldApplyExternalSnapshot = ({
  previousRawContent,
  nextRawContent,
  changedCanonicalBlockIdsCount,
  hasCurrentViewModel,
}: ExternalSnapshotPolicyInput) => {
  if (
    hasCurrentViewModel &&
    previousRawContent === nextRawContent &&
    changedCanonicalBlockIdsCount === 0
  ) {
    return false
  }

  return true
}
