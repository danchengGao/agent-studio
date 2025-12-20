/**
 * Prompt 相关类型定义
 */

// 模型配置接口 - 统一的模型配置定义
export interface ModelConfig {
  model: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  stopSequences: string[]
  // 动态参数支持 - 允许任意字符串键的值
  [key: string]: any
}

// 消息接口
export interface PromptMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'placeholder'
  content: string
  placeholderName?: string // 仅用于placeholder类型
}

// 优化源接口
export interface OptimizationSource {
  type: 'main' | 'base' | 'control'
  groupId?: number
  messageId?: string // 记录具体操作的消息ID
}

// 优化目标接口
export interface OptimizingTarget {
  type: 'main' | 'base' | 'control' | 'message'
  groupId?: number
  messageId?: string
}

// 参数接口
export interface PromptParameter {
  name: string
  value: string
  description?: string
  type?: 'text' | 'placeholder'
  dataType?: 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array<string>' | 'array<integer>' | 'array<number>'
  messages?: Array<{
    id: string
    role: 'system' | 'user' | 'assistant'
    content: string
  }> // 仅用于placeholder类型
}

// 提示词版本接口
export interface PromptVersion {
  id: string
  version: string
  content: string
  parameters: PromptParameter[]
  modelConfig: ModelConfig
  createdAt: string
  isActive: boolean
  description: string
  author: string
  baseVersion?: string // 新增基版本字段
  associations?: {
    relationObjs?: any[] // RelationObj类型来自API
  }
  performance: {
    usage: number
    rating: number
    successRate: number
  }
}

// 聊天消息接口
export interface ChatMessage {
  type: 'user' | 'ai' | 'system'
  content: string
  timestamp: string
  userInput?: string
  input_tokens?: string
  output_tokens?: string
  reasoning?: string
  tool_calls?: any[]
  isCompleted?: boolean
  optimization_applied?: boolean
}

// 对比组数据接口
export interface ComparisonGroupData {
  id: number // 0表示基准组，1,2,3...表示对照组
  prompt: {
    name: string
    description: string
    category: string
    content: string
    tags: string[]
    isPublic: boolean
    language: string
  }
  modelConfig: ModelConfig
  parameters: PromptParameter[]
  chatMessages: ChatMessage[]
  tab: number
  isProcessing: boolean
  messages: PromptMessage[]
  messageInputValues: { [key: string]: string }
  draggedMessageId: string | null
  toolsEnabled: boolean
  tools?: Tool[]
  isBaseGroup?: boolean // 用于标识是否为基准组
  templateEngine: 'normal' | 'jinja2' // 每个组独立的模板引擎
}

// 选中文本接口
export interface SelectedText {
  text: string
  position: { x: number; y: number }
  range?: Range
  indices?: { start: number; end: number }
}

// 组编辑消息接口
export interface GroupEditingMessage {
  groupId: number
  messageIndex: number
}

// 调试跟踪信息接口
export interface DebugTraceInfo {
  debug_id?: string
  debug_trace_key?: string
}

// 工具参数接口
export interface ToolParameter {
  name: string
  type: string
  description: string
  required: boolean
  enum?: string[]
}

// 工具接口
export interface Tool {
  id: string
  name: string
  description: string
  defaultValue?: string
  fieldType?: 'PlainText' | 'JSON'
  parameters: ToolParameter[]
  parametersJsonSchema?: string // 保存原始的JSON Schema，用于保留高级特性（enum、format等）
  parametersMode?: 'visual' | 'json' // 参数模式：visual（可视化）或 json（JSON配置）
}

// 模型接口
export interface Model {
  openModel: {
    model_id: string
    name: string
    param_config?: {
      param_schemas?: Array<{
        name: string
        label: string
        desc: string
        type: string
        min?: number
        max?: number
        default_val?: any
      }>
    }
  }
}

// 测试记录接口
export interface TestRecord {
  input: Record<string, any>
  output: string
  timestamp: string
}

// 选择指标接口
export interface SelectionIndices {
  start: number
  end: number
}

// 选中的AI回复接口
export interface SelectedAiReply {
  userQuestion: string
  aiResponse: string
  messageIndex: number
}

// 优化步骤类型
export type OptimizeStep = 'input' | 'optimizing' | 'result'

// 对照组数据接口（简化版，用于对话框）
export interface ControlGroupData {
  id: number
  messages: PromptMessage[]
  messageInputValues: Record<string, string>
  modelConfig: {
    model: string
    topP: number
    temperature: number
  }
}
