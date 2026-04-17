/**
 * Recording module
 */

// Data contracts and low-level building blocks.
export * from './types'
export * from './storage'
export * from './core'
export * from './middleware'
export * from './config'
export * from './constants'
export * from './utils'
export * from './integrations'

// Store and module-level runtime access.
export {
  useRecordingStore,
  useRecordingModule,
  type RecordingState,
} from './store'

// UI-facing hooks.
export {
  useRecording,
  usePlayback,
  useRecordingList,
  type UseRecordingReturn,
  type UsePlaybackReturn,
  type UseRecordingListReturn,
} from './ui/hooks'

export const RECORDING_MODULE_VERSION = '1.0.0'
export const RECORDING_MODULE_NAME = 'recording'
