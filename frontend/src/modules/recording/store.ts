/**
 * Recording module - Zustand store
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { RecorderImpl } from './core/Recorder'
import { PlayerImpl } from './core/Player'
import { IndexedDBStorage } from './storage/IndexedDBStorage'
import {
  MiddlewareManagerImpl,
  RewriteMiddleware,
  RewriteMockManager,
  SSERecordingMiddleware,
} from './middleware'
import type {
  InteractionEvent,
  RecordedEvent,
  RewriteMockDiagnostic,
  RewriteEvent,
  SSEData,
  RecordingSession,
  RecordingMeta,
  PlaybackState,
  PlaybackProgress,
  RewriteRequest,
  RecordingModuleConfig,
} from './types'
import type { RecordingStorage } from './storage/types'
import { mergeConfig } from './config'
import { RECORDING_EVENTS, dispatchRecordingEvent } from './constants'

export interface RecordingState {
  // Module lifecycle.
  isInitialized: boolean
  isInitializing: boolean

  // Runtime dependencies created during init().
  recorder: RecorderImpl | null
  player: PlayerImpl | null
  storage: RecordingStorage | null
  middlewareManager: MiddlewareManagerImpl<any> | null
  rewriteMockManager: RewriteMockManager | null

  // Main-flow recording state.
  isRecording: boolean
  currentRecordingId: string | null

  // Playback state exposed to the UI.
  playbackStatus: PlaybackState
  playbackProgress: number

  // Recording list cache for side panels.
  recordings: RecordingMeta[]
  isLoadingRecordings: boolean

  init: (config?: RecordingModuleConfig) => Promise<void>
  destroy: () => void

  startRecording: (query: string, metadata?: Record<string, unknown>) => Promise<string>
  continueRecording: (query: string, metadata?: Record<string, unknown>) => Promise<string>
  recordEvent: (event: SSEData) => void
  recordInteraction: (event: Omit<InteractionEvent, 'afterEventCount' | 'timestamp'>) => void
  stopRecording: () => Promise<RecordingSession | null>

  startRewriteRecording: (request: RewriteRequest) => void
  recordRewriteEvent: (event: SSEData) => void
  stopRewriteRecording: () => Promise<void>
  canRecordRewrite: () => boolean
  isRewriteRecording: () => boolean

  setRewriteMockEnabled: (enabled: boolean) => void
  loadRewriteMockEvents: (events: RewriteEvent[]) => void
  clearRewriteMockEvents: () => void
  playRewriteMock: (
    request: RewriteRequest,
    onEvent: (event: RecordedEvent) => void
  ) => Promise<boolean>
  diagnoseRewriteMock: (request: RewriteRequest) => RewriteMockDiagnostic | null

  playRecording: (
    sessionId: string,
    onEvent: (e: SSEData) => void | Promise<void>,
    onInteraction?: (event: InteractionEvent) => void | Promise<void>
  ) => Promise<void>
  pausePlayback: () => void
  resumePlayback: () => void
  stopPlayback: () => void
  getPlaybackState: () => PlaybackState

  enableRecordingMiddleware: () => void
  disableRecordingMiddleware: () => void

  loadRecordings: (limit?: number) => Promise<void>
  getRecording: (id: string) => Promise<RecordingSession | null>
  deleteRecording: (id: string) => Promise<void>
  clearAllRecordings: () => Promise<void>
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  isInitialized: false,
  isInitializing: false,
  recorder: null,
  player: null,
  storage: null,
  middlewareManager: null,
  rewriteMockManager: null,
  isRecording: false,
  currentRecordingId: null,
  playbackStatus: 'idle',
  playbackProgress: 0,
  recordings: [],
  isLoadingRecordings: false,

  init: async (config) => {
    const state = get()
    if (state.isInitialized || state.isInitializing) return

    set({ isInitializing: true })

    try {
      // The store owns the module runtime and wires all sub-systems together.
      const mergedConfig = mergeConfig(config)
      const storage = mergedConfig.storage ?? new IndexedDBStorage()
      await storage.init()

      const recorder = new RecorderImpl({ storage })
      const player = new PlayerImpl()
      const rewriteMockManager = new RewriteMockManager()
      const rewriteMiddleware = new RewriteMiddleware({
        hasMatch: (request) => rewriteMockManager.hasMatch(request),
        play: (request, onEvent, onComplete) => rewriteMockManager.play(request, onEvent, onComplete),
      })

      const middlewareManager = new MiddlewareManagerImpl<any>()
      middlewareManager.use(new SSERecordingMiddleware({ recorder }))
      middlewareManager.use(rewriteMiddleware)

      set({
        isInitialized: true,
        isInitializing: false,
        recorder,
        player,
        storage,
        middlewareManager,
        rewriteMockManager,
      })

      console.log('[RecordingStore] Initialized')
    } catch (error) {
      set({ isInitializing: false })
      console.error('[RecordingStore] Init failed:', error)
      throw error
    }
  },

  destroy: () => {
    set({
      isInitialized: false,
      isInitializing: false,
      recorder: null,
      player: null,
      storage: null,
      middlewareManager: null,
      rewriteMockManager: null,
      isRecording: false,
      currentRecordingId: null,
      playbackStatus: 'idle',
      playbackProgress: 0,
      recordings: [],
    })
    console.log('[RecordingStore] Destroyed')
  },

  startRecording: async (query, metadata) => {
    const { recorder, middlewareManager } = get()
    if (!recorder) throw new Error('[RecordingStore] Not initialized')

    const id = await recorder.start({ query, metadata })
    set({ isRecording: true, currentRecordingId: id })

    const sseMiddleware = middlewareManager?.get('sse-recording')
    if (sseMiddleware) sseMiddleware.enabled = true

    console.log('[RecordingStore] Started recording:', id)
    return id
  },

  continueRecording: async (query, metadata) => {
    const { recorder, middlewareManager } = get()
    if (!recorder) throw new Error('[RecordingStore] Not initialized')

    const id = await recorder.continueSession({ query, metadata, continueCurrentSession: true })
    set({ isRecording: true, currentRecordingId: id })

    const sseMiddleware = middlewareManager?.get('sse-recording')
    if (sseMiddleware) sseMiddleware.enabled = true

    console.log('[RecordingStore] Continued recording:', id)
    return id
  },

  recordEvent: (event) => {
    get().recorder?.record(event)
  },

  recordInteraction: (event) => {
    get().recorder?.recordInteraction(event)
  },

  stopRecording: async () => {
    const { recorder, middlewareManager } = get()
    if (!recorder?.isRecording()) return null

    const session = await recorder.stop()
    set({ isRecording: false, currentRecordingId: null })

    const sseMiddleware = middlewareManager?.get('sse-recording')
    if (sseMiddleware) sseMiddleware.enabled = false

    dispatchRecordingEvent(RECORDING_EVENTS.SAVED, undefined)
    console.log('[RecordingStore] Stopped recording:', session?.id)
    return session
  },

  startRewriteRecording: (request) => {
    get().recorder?.startRewriteRecording(request)
  },

  recordRewriteEvent: (event) => {
    get().recorder?.recordRewriteEvent(event)
  },

  stopRewriteRecording: async () => {
    await get().recorder?.stopRewriteRecording()
    dispatchRecordingEvent(RECORDING_EVENTS.SAVED, undefined)
  },

  canRecordRewrite: () => get().recorder?.canRecordRewrite() ?? false,

  isRewriteRecording: () => get().recorder?.isRewriteRecording() ?? false,

  setRewriteMockEnabled: (enabled) => {
    // The middleware gate and the mock manager config need to stay in sync.
    const rewriteMiddleware = get().middlewareManager?.get('rewrite')
    if (rewriteMiddleware) {
      rewriteMiddleware.enabled = enabled
    }
    get().rewriteMockManager?.setConfig({ enabled })
  },

  loadRewriteMockEvents: (events) => {
    get().rewriteMockManager?.loadEvents(events)
  },

  clearRewriteMockEvents: () => {
    get().rewriteMockManager?.clear()
  },

  playRewriteMock: async (request, onEvent) => {
    const rewriteMiddleware = get().middlewareManager?.get('rewrite') as RewriteMiddleware | undefined
    if (!rewriteMiddleware) return false
    return rewriteMiddleware.playMock(request, onEvent)
  },

  diagnoseRewriteMock: (request) => {
    return get().rewriteMockManager?.diagnose(request) ?? null
  },

  playRecording: async (sessionId, onEvent, onInteraction) => {
    const { player, storage } = get()
    if (!player || !storage) throw new Error('[RecordingStore] Not initialized')

    const session = await storage.get(sessionId)
    if (!session) throw new Error(`[RecordingStore] Recording ${sessionId} not found`)

    set({ playbackStatus: 'playing', playbackProgress: 0 })

    await player.play(session, onEvent, {
      onProgress: (progress: PlaybackProgress) => set({ playbackProgress: progress.percentage }),
      onInteraction,
    })

    set({ playbackStatus: player.getState() })
  },

  pausePlayback: () => {
    const { player } = get()
    player?.pause()
    set({ playbackStatus: player?.getState() ?? 'idle' })
  },

  resumePlayback: () => {
    const { player } = get()
    player?.resume()
    set({ playbackStatus: player?.getState() ?? 'idle' })
  },

  stopPlayback: () => {
    const { player } = get()
    player?.stop()
    set({ playbackStatus: 'idle', playbackProgress: 0 })
  },

  getPlaybackState: () => get().player?.getState() ?? 'idle',

  enableRecordingMiddleware: () => {
    const sseMiddleware = get().middlewareManager?.get('sse-recording')
    if (sseMiddleware) sseMiddleware.enabled = true
  },

  disableRecordingMiddleware: () => {
    const sseMiddleware = get().middlewareManager?.get('sse-recording')
    if (sseMiddleware) sseMiddleware.enabled = false
  },

  loadRecordings: async (limit = 50) => {
    const { storage } = get()
    if (!storage) return

    set({ isLoadingRecordings: true })
    try {
      const list = await storage.list({ limit, sortBy: 'startTime', sortOrder: 'desc' })
      set({ recordings: list, isLoadingRecordings: false })
    } catch (error) {
      set({ isLoadingRecordings: false })
      console.error('[RecordingStore] Load recordings failed:', error)
    }
  },

  getRecording: async (id) => {
    return get().storage?.get(id) ?? null
  },

  deleteRecording: async (id) => {
    const { storage, recordings } = get()
    if (!storage) return

    await storage.delete(id)
    set({ recordings: recordings.filter((recording) => recording.id !== id) })

    dispatchRecordingEvent(RECORDING_EVENTS.DELETED, undefined)
  },

  clearAllRecordings: async () => {
    const { storage } = get()
    if (!storage) return

    await storage.clear()
    set({ recordings: [] })

    dispatchRecordingEvent(RECORDING_EVENTS.DELETED, undefined)
  },
}))

export function useRecordingModule() {
  const {
    recorder,
    player,
    storage,
    middlewareManager,
    rewriteMockManager,
    isInitialized,
    init,
    destroy,
    stopRewriteRecording,
    setRewriteMockEnabled,
    loadRewriteMockEvents,
    clearRewriteMockEvents,
    playRewriteMock,
    diagnoseRewriteMock,
  } = useRecordingStore(
    useShallow((state) => ({
      recorder: state.recorder,
      player: state.player,
      storage: state.storage,
      middlewareManager: state.middlewareManager,
      rewriteMockManager: state.rewriteMockManager,
      isInitialized: state.isInitialized,
      init: state.init,
      destroy: state.destroy,
      stopRewriteRecording: state.stopRewriteRecording,
      setRewriteMockEnabled: state.setRewriteMockEnabled,
      loadRewriteMockEvents: state.loadRewriteMockEvents,
      clearRewriteMockEvents: state.clearRewriteMockEvents,
      playRewriteMock: state.playRewriteMock,
      diagnoseRewriteMock: state.diagnoseRewriteMock,
    }))
  )

  // This hook intentionally exposes module-level capabilities that do not fit
  // neatly into useRecording/usePlayback/useRecordingList.
  return {
    recorder,
    player,
    storage,
    middlewareManager,
    rewriteMockManager,
    isInitialized,
    init,
    destroy,
    stopRewriteRecording,
    setRewriteMockEnabled,
    loadRewriteMockEvents,
    clearRewriteMockEvents,
    playRewriteMock,
    diagnoseRewriteMock,
  }
}
