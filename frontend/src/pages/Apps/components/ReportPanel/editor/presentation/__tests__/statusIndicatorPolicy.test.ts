import { describe, expect, it } from 'vitest'
import {
  getStatusIndicatorDismissPlan,
  STATUS_INDICATOR_EXIT_MS,
} from '@/pages/Apps/components/ReportPanel/editor/sideMenu/statusIndicatorPolicy'

describe('getStatusIndicatorDismissPlan', () => {
  it('uses a two-stage dismiss plan for error status', () => {
    expect(getStatusIndicatorDismissPlan('error')).toEqual({
      lingerMs: 2200,
      exitMs: STATUS_INDICATOR_EXIT_MS,
    })
  })

  it('does not auto hide active rewrite statuses', () => {
    expect(getStatusIndicatorDismissPlan('thinking')).toBeNull()
    expect(getStatusIndicatorDismissPlan('writing')).toBeNull()
    expect(getStatusIndicatorDismissPlan('idle')).toBeNull()
  })
})
