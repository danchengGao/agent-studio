import type { RewriteStatus } from '@/pages/Apps/types'

export const STATUS_INDICATOR_EXIT_MS = 420

export type StatusIndicatorDismissPlan = {
  lingerMs: number
  exitMs: number
}

export const getStatusIndicatorDismissPlan = (
  status: RewriteStatus,
): StatusIndicatorDismissPlan | null => {
  if (status === 'error') {
    return {
      lingerMs: 2200,
      exitMs: STATUS_INDICATOR_EXIT_MS,
    }
  }

  return null
}
