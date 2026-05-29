import { utf16IndexToCodePointIndex } from '@/utils/textOffset'
import type { ReportRewriteParams } from '@/pages/Apps/types'

export type ReportSyncStatus = 'synced' | 'pending' | 'syncing' | 'error'

export type BuildReportSyncRequestInput = {
  markdown: string
  conversationId: string
}

export function buildReportSyncRequest(input: BuildReportSyncRequestInput): ReportRewriteParams {
  return {
    action: 'sync',
    rewrite_scope: 'selected_only',
    selectedText: input.markdown,
    startOffset: 0,
    endOffset: utf16IndexToCodePointIndex(input.markdown, input.markdown.length),
    userInstruction: '',
    conversationId: input.conversationId,
    silent: true,
  }
}

export type ReportSyncSchedulerOptions = {
  initialMarkdown: string
  debounceMs: number
  sync: (markdown: string) => Promise<void>
  onStatusChange?: (status: ReportSyncStatus) => void
}

export type ReportSyncScheduler = {
  markChanged: (markdown: string) => void
  flush: () => Promise<void>
  forceFlush: (markdown?: string) => Promise<void>
  markSyncing: () => void
  dispose: () => void
  getStatus: () => ReportSyncStatus
  getLatestMarkdown: () => string
}

export type FlushLatestReportDraftInput = {
  scheduler: ReportSyncScheduler | null
  getCurrentMarkdown?: (() => Promise<string>) | null
}

export function createReportSyncScheduler(options: ReportSyncSchedulerOptions): ReportSyncScheduler {
  let latestMarkdown = options.initialMarkdown
  let lastSyncedMarkdown = options.initialMarkdown
  let status: ReportSyncStatus = 'synced'
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null

  const setStatus = (nextStatus: ReportSyncStatus) => {
    status = nextStatus
    options.onStatusChange?.(nextStatus)
  }

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const runSync = async (runOptions?: { force?: boolean; markdown?: string }) => {
    clearTimer()
    if (typeof runOptions?.markdown === 'string') {
      latestMarkdown = runOptions.markdown
    }

    if (!runOptions?.force && latestMarkdown === lastSyncedMarkdown) {
      if (status !== 'synced') {
        setStatus('synced')
      }
      return
    }

    if (inFlight) {
      await inFlight.catch(() => undefined)
      if (latestMarkdown !== lastSyncedMarkdown || runOptions?.force) {
        await runSync(runOptions)
      }
      return
    }

    const markdownToSync = latestMarkdown
    setStatus('syncing')
    inFlight = options.sync(markdownToSync)

    try {
      await inFlight
      lastSyncedMarkdown = markdownToSync
      setStatus(latestMarkdown === lastSyncedMarkdown ? 'synced' : 'pending')
    } catch {
      setStatus('error')
      throw new Error('report sync failed')
    } finally {
      inFlight = null
    }
  }

  const schedule = () => {
    clearTimer()
    timer = setTimeout(() => {
      void runSync().catch(() => undefined)
    }, options.debounceMs)
  }

  return {
    markChanged(markdown: string) {
      latestMarkdown = markdown
      if (markdown === lastSyncedMarkdown) {
        clearTimer()
        if (!inFlight) {
          setStatus('synced')
        }
        return
      }

      if (status !== 'pending') {
        setStatus('pending')
      }
      schedule()
    },
    flush() {
      return runSync()
    },
    forceFlush(markdown?: string) {
      return runSync({ force: true, markdown })
    },
    markSyncing() {
      setStatus('syncing')
    },
    dispose() {
      clearTimer()
    },
    getStatus() {
      return status
    },
    getLatestMarkdown() {
      return latestMarkdown
    },
  }
}

export async function flushLatestReportDraft({
  scheduler,
  getCurrentMarkdown,
}: FlushLatestReportDraftInput) {
  if (!scheduler) {
    return
  }

  scheduler.markSyncing()

  if (getCurrentMarkdown) {
    try {
      await scheduler.forceFlush(await getCurrentMarkdown())
      return
    } catch (error) {
      console.error('[ReportSync] 读取当前编辑器内容失败，回退到已有草稿:', error)
    }
  }

  await scheduler.forceFlush()
}
