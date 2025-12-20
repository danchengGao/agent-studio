import type { Model, ModelConfig } from '@/components/Prompts'
import type { QuickOptimizeModelInfo, AgentModelInfo } from '@test-agentstudio/api-client'

/**
 * 构建模型信息的工具函数
 * 用于各种优化功能（快捷优化、反馈优化、badcase优化等）
 *
 * @param selectedModel 选中的模型
 * @param modelConfig 模型配置
 * @param defaultId 可选的默认 ID（当解析失败时使用，默认为 undefined 表示不使用默认值）
 * @returns 构建好的模型信息对象
 */
export function buildModelInfo(selectedModel: Model, modelConfig: ModelConfig, defaultId?: number): QuickOptimizeModelInfo {
  return {
    id: defaultId !== undefined ? parseInt(selectedModel.openModel.model_id) || defaultId : parseInt(selectedModel.openModel.model_id),
    model: selectedModel.openModel.name,
    model_from: modelConfig.model_from || 'db',
    headers: (() => {
      const supportedParams: Record<string, unknown> = {}

      // 获取模型支持的参数列表
      const paramSchemas = selectedModel.openModel.param_config?.param_schemas || []

      // 遍历模型支持的参数
      paramSchemas.forEach(paramSchema => {
        const paramName = paramSchema.name
        const configValue = modelConfig[paramName]

        // 只有当参数在 modelConfig 中有值时才添加
        if (configValue !== undefined && configValue !== null) {
          supportedParams[paramName] = configValue
        }
      })

      return supportedParams
    })(),
  }
}

/**
 * 将 AgentModelInfo 转换为 QuickOptimizeModelInfo
 * 用于智能体编辑器的快捷优化功能
 *
 * @param agentModel 智能体模型信息
 * @param modelId 可选的模型ID（如果无法从 agentModel 中获取）
 * @returns 构建好的模型信息对象
 */
export function buildModelInfoFromAgent(agentModel: AgentModelInfo, modelId?: number): QuickOptimizeModelInfo {
  const modelInfo = agentModel.model_info || {}
  const headers: Record<string, any> = {}

  // 提取 headers 参数
  if (modelInfo.temperature !== undefined && modelInfo.temperature !== null) {
    headers.temperature = modelInfo.temperature
  }
  if (modelInfo.max_tokens !== undefined && modelInfo.max_tokens !== null) {
    headers.max_tokens = modelInfo.max_tokens
  }
  if (modelInfo.top_p !== undefined && modelInfo.top_p !== null) {
    headers.top_p = modelInfo.top_p
  }

  return {
    id: modelId !== undefined ? modelId : 0, // 如果未提供ID，使用0作为默认值
    model: modelInfo.model_type || '',
    model_from: 'db', // 根据新API格式，model_from固定为'db'
    headers,
  }
}
