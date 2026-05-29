import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildReportSyncRequest,
  createReportSyncScheduler,
  flushLatestReportDraft,
  type ReportSyncStatus,
} from '../reportSync'

describe('buildReportSyncRequest', () => {
  it('builds a DeepSearch sync request with whole-report text and code-point offsets', () => {
    const request = buildReportSyncRequest({
      markdown: '报告🙂\n第二段',
      conversationId: 'conv-1',
    })

    expect(request).toEqual({
      action: 'sync',
      rewrite_scope: 'selected_only',
      selectedText: '报告🙂\n第二段',
      startOffset: 0,
      endOffset: 7,
      userInstruction: '',
      conversationId: 'conv-1',
      silent: true,
    })
  })
})

describe('createReportSyncScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('debounces draft changes and skips unchanged synced content', async () => {
    vi.useFakeTimers()
    const sync = vi.fn().mockResolvedValue(undefined)
    const statuses: ReportSyncStatus[] = []
    const scheduler = createReportSyncScheduler({
      initialMarkdown: 'initial',
      debounceMs: 300,
      sync,
      onStatusChange: (status) => statuses.push(status),
    })

    scheduler.markChanged('first')
    scheduler.markChanged('second')

    await vi.advanceTimersByTimeAsync(299)
    expect(sync).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenLastCalledWith('second')
    expect(statuses).toEqual(['pending', 'syncing', 'synced'])

    scheduler.markChanged('second')
    await vi.advanceTimersByTimeAsync(300)
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('flushes pending changes immediately', async () => {
    vi.useFakeTimers()
    const sync = vi.fn().mockResolvedValue(undefined)
    const scheduler = createReportSyncScheduler({
      initialMarkdown: 'initial',
      debounceMs: 300,
      sync,
    })

    scheduler.markChanged('draft')
    await scheduler.flush()

    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenLastCalledWith('draft')
  })

  it('waits for an in-flight sync and then flushes the latest draft', async () => {
    vi.useFakeTimers()
    const firstSync = {
      resolve: undefined as (() => void) | undefined,
    }
    const sync = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            firstSync.resolve = resolve
          }),
      )
      .mockResolvedValueOnce(undefined)
    const scheduler = createReportSyncScheduler({
      initialMarkdown: 'initial',
      debounceMs: 300,
      sync,
    })

    scheduler.markChanged('first')
    await vi.advanceTimersByTimeAsync(300)
    expect(sync).toHaveBeenCalledTimes(1)

    scheduler.markChanged('second')
    const flushPromise = scheduler.flush()
    expect(sync).toHaveBeenCalledTimes(1)

    const finishFirstSync = firstSync.resolve
    if (!finishFirstSync) {
      throw new Error('first sync did not start')
    }
    finishFirstSync()
    await flushPromise

    expect(sync).toHaveBeenCalledTimes(2)
    expect(sync).toHaveBeenLastCalledWith('second')
  })

  it('keeps failed drafts pending so manual retry can send the same content', async () => {
    vi.useFakeTimers()
    const sync = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)
    const statuses: ReportSyncStatus[] = []
    const scheduler = createReportSyncScheduler({
      initialMarkdown: 'initial',
      debounceMs: 300,
      sync,
      onStatusChange: (status) => statuses.push(status),
    })

    scheduler.markChanged('draft')
    await vi.advanceTimersByTimeAsync(300)
    expect(sync).toHaveBeenCalledTimes(1)
    expect(statuses).toEqual(['pending', 'syncing', 'error'])

    await scheduler.flush()
    expect(sync).toHaveBeenCalledTimes(2)
    expect(sync).toHaveBeenLastCalledWith('draft')
    expect(statuses).toEqual(['pending', 'syncing', 'error', 'syncing', 'synced'])
  })

  it('manual flush reads the latest editor markdown before syncing', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    const scheduler = createReportSyncScheduler({
      initialMarkdown: 'initial',
      debounceMs: 300,
      sync,
    })

    await flushLatestReportDraft({
      scheduler,
      getCurrentMarkdown: vi.fn().mockResolvedValue('editor draft'),
    })

    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenLastCalledWith('editor draft')
  })

  it('falls back to the pending scheduler draft when reading the editor fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sync = vi.fn().mockResolvedValue(undefined)
    const scheduler = createReportSyncScheduler({
      initialMarkdown: 'initial',
      debounceMs: 300,
      sync,
    })
    scheduler.markChanged('pending draft')

    await flushLatestReportDraft({
      scheduler,
      getCurrentMarkdown: vi.fn().mockRejectedValue(new Error('serialize failed')),
    })

    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenLastCalledWith('pending draft')
  })

  it('returns early when manual flush runs before the scheduler is ready', async () => {
    await expect(
      flushLatestReportDraft({
        scheduler: null,
        getCurrentMarkdown: vi.fn().mockResolvedValue('editor draft'),
      }),
    ).resolves.toBeUndefined()
  })

  it('manual flush forces a sync even when the latest draft matches the last synced markdown', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    const scheduler = createReportSyncScheduler({
      initialMarkdown: 'initial',
      debounceMs: 300,
      sync,
    })

    await flushLatestReportDraft({
      scheduler,
      getCurrentMarkdown: vi.fn().mockResolvedValue('initial'),
    })

    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenLastCalledWith('initial')
  })

  it('manual flush reports syncing immediately before the forced request resolves', async () => {
    const statuses: ReportSyncStatus[] = []
    let resolveSync: (() => void) | undefined
    const sync = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSync = resolve
        }),
    )
    const scheduler = createReportSyncScheduler({
      initialMarkdown: 'initial',
      debounceMs: 300,
      sync,
      onStatusChange: (status) => statuses.push(status),
    })

    const flushPromise = flushLatestReportDraft({
      scheduler,
      getCurrentMarkdown: vi.fn().mockResolvedValue('initial'),
    })

    expect(statuses).toContain('syncing')
    await Promise.resolve()

    if (!resolveSync) {
      throw new Error('forced sync did not start')
    }

    resolveSync()
    await flushPromise
    expect(statuses.at(-1)).toBe('synced')
  })
})
