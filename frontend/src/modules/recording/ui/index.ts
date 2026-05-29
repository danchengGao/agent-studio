/**
 * 录制模块 - UI 层导出
 *
 * 使用 Zustand store，无需 Provider
 */

// Store
export {
  useRecordingStore,
  useRecordingModule,
  type RecordingState,
} from '../store'

// Hooks
export * from './hooks'