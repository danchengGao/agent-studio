import { JSONObject } from '../useConversationStore';

/**
 * deepsearch event类型
 */
export enum DeepsearchEvent {
  START = 'start',            // 开始
  MESSAGE = 'message',        // 消息
  DONE = 'done',              // 完成
  SUMMARY_RESPONSE = 'summary_response', // 摘要响应
  WAITING_USER_INPUT = 'waiting_user_input', // 等待用户输入
  USER_INPUT_ENDED = 'user_input_ended', // 用户输入结束
  ERROR = 'error',            // 错误
}

/**
 * deepsearch agent类型
 */
export enum DeepsearchAgentType {
  DEFAULT = 'default',        // 默认agent类型
  ENTRY = 'entry',            // 入口agent类型
  GENERATE_QUESTIONS = 'generate_questions', // 生成问题agent类型
  FEEDBACK_HANDLER = 'feedback_handler', // 反馈处理agent类型
  OUTLINE = 'outline',        // 大纲agent类型
  OUTLINE_INTERACTION = 'outline_interaction', // 大纲交互agent类型
  PLAN_REASONING = 'plan_reasoning', // 计划推理agent类型
  SUB_REPORTER = 'sub_reporter', // 子报告器agent类型
  COLLECTOR_INFO_RETRIEVAL = 'collector_info_retrieval', // 收集器信息检索agent类型
  COLLECTOR_SUMMARY = 'collector_summary', // 收集器摘要agent类型
  END = 'end',                // 结束agent类型
}

/**
 * DeepSearch SSE 事件数据类型
 */
export interface SSEData {
  event: DeepsearchEvent;
  agent: string;
  content?: string | JSONObject;
  section_idx?: string | number;
  plan_idx?: string | number;
  step_idx?: string | number;
  conversation_id?: string;  // 对话的conversationId
}
