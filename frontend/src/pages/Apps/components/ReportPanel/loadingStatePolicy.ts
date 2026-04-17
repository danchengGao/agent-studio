export type ReportPanelSettledLoadingState = 'loaded' | 'empty'

export function planReportEditLoadingTransition(params: {
  previousReportId: string | null
  nextReportId: string
  hasContent: boolean
}): {
  shouldEnterLoading: boolean
  settledState: ReportPanelSettledLoadingState
} {
  const { previousReportId, hasContent } = params

  return {
    shouldEnterLoading: previousReportId === null,
    settledState: hasContent ? 'loaded' : 'empty',
  }
}
