/**
 * 录制模块 - 配置
 */

import type { RecordingModuleConfig } from '../types'

/** 默认配置 */
export const DEFAULT_CONFIG: Required<Omit<RecordingModuleConfig, 'storage'>> & { storage: undefined } = {
  storage: undefined,
}

/**
 * 合并用户配置与默认配置
 */
export function mergeConfig(
  userConfig?: RecordingModuleConfig
): Required<RecordingModuleConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
  } as Required<RecordingModuleConfig>
}
