/**
 * 录制模块 - 错误类型定义
 */

/** 错误码 */
export type RecordingErrorCode =
  | 'STORAGE_INIT_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_DELETE_FAILED'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'INVALID_STATE'
  | 'RECORDING_NOT_FOUND'
  | 'PLAYBACK_FAILED'
  | 'MIDDLEWARE_ERROR'

/** 录制模块错误类 */
export class RecordingError extends Error {
  constructor(
    message: string,
    public readonly code: RecordingErrorCode,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'RecordingError'
  }

  /** 创建存储初始化错误 */
  static storageInitFailed(cause?: Error): RecordingError {
    return new RecordingError('Failed to initialize storage', 'STORAGE_INIT_FAILED', cause)
  }

  /** 创建存储写入错误 */
  static storageWriteFailed(cause?: Error): RecordingError {
    return new RecordingError('Failed to write to storage', 'STORAGE_WRITE_FAILED', cause)
  }

  /** 创建存储读取错误 */
  static storageReadFailed(cause?: Error): RecordingError {
    return new RecordingError('Failed to read from storage', 'STORAGE_READ_FAILED', cause)
  }

  /** 创建存储删除错误 */
  static storageDeleteFailed(cause?: Error): RecordingError {
    return new RecordingError('Failed to delete from storage', 'STORAGE_DELETE_FAILED', cause)
  }

  /** 创建配额超限错误 */
  static quotaExceeded(): RecordingError {
    return new RecordingError('Storage quota exceeded', 'STORAGE_QUOTA_EXCEEDED')
  }

  /** 创建状态非法错误 */
  static invalidState(message: string): RecordingError {
    return new RecordingError(message, 'INVALID_STATE')
  }

  /** 创建录制未找到错误 */
  static notFound(id: string): RecordingError {
    return new RecordingError(`Recording ${id} not found`, 'RECORDING_NOT_FOUND')
  }

  /** 创建回放失败错误 */
  static playbackFailed(cause?: Error): RecordingError {
    return new RecordingError('Playback failed', 'PLAYBACK_FAILED', cause)
  }
}
