/**
 * 录制模块 - 类型定义导出
 */

// 事件类型
export type {
  SSEEventType,
  SSEData,
  RecordedEvent,
  InteractionKind,
  InteractionEvent,
  RewriteAction,
  RewriteRequest,
  RewriteEvent,
} from './events'

// 通用类型
export type {
  RecordingMeta,
  RecordingSession,
  RecordingModuleConfig,
  PlaybackState,
  PlaybackProgress,
  RecordingConfig,
  PlaybackOptions,
} from './common'

// 错误类型
export { RecordingError } from './errors'
export type { RecordingErrorCode } from './errors'
