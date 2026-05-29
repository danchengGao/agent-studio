import { describe, expect, it } from 'vitest'
import { planReportEditLoadingTransition } from '../../../loadingStatePolicy'

describe('planReportEditLoadingTransition', () => {
  it('does not re-enter page loading when the same report updates its content after a rewrite', () => {
    expect(
      planReportEditLoadingTransition({
        previousReportId: 'report-1',
        nextReportId: 'report-1',
        hasContent: true,
      }),
    ).toEqual({
      shouldEnterLoading: false,
      settledState: 'loaded',
    })
  })

  it('uses page loading only on the initial mount of the edit view', () => {
    expect(
      planReportEditLoadingTransition({
        previousReportId: null,
        nextReportId: 'report-1',
        hasContent: true,
      }),
    ).toEqual({
      shouldEnterLoading: true,
      settledState: 'loaded',
    })
  })

  it('does not re-enter page loading when a rewrite promotes a new report version id', () => {
    expect(
      planReportEditLoadingTransition({
        previousReportId: 'report-1',
        nextReportId: 'report-2',
        hasContent: true,
      }),
    ).toEqual({
      shouldEnterLoading: false,
      settledState: 'loaded',
    })
  })

  it('settles to empty without forcing a loading remount for same-report empty updates', () => {
    expect(
      planReportEditLoadingTransition({
        previousReportId: 'report-1',
        nextReportId: 'report-1',
        hasContent: false,
      }),
    ).toEqual({
      shouldEnterLoading: false,
      settledState: 'empty',
    })
  })
})
