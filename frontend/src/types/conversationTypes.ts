/**
 * Conversation 相关共享类型定义
 * 用于在多个文件之间共享类型，避免循环依赖
 */

// ===== 枚举定义 =====

/**
 * 消息的类型定义
 */
export enum MessageType {
  // 基础类型
  TEXT = 'text',              // 普通文本/Markdown
  REPORT = 'report',          // 报告类型, 其他数据和TEXT一样，只是前端使用报告的模板进行显示
  LINK = 'link',              // 外部链接（网页）
  DETAIL_LINK = 'detail_link',// 详情链接（打开右侧面板）

  // 任务类型（带子任务）
  TASK = 'task',              // 任务容器

  // 特殊类型
  ERROR = 'error',            // 错误信息
  INTERRUPT = 'interrupt',    // 中断等待用户输入
  OUTLINE_INTERACTION = 'outline_interaction', // 大纲交互等待用户确认
}

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',        // 未开始
  IN_PROGRESS = 'in_progress', // 进行中
  REPORTING = "reporting",    // 报告生成中
  COMPLETED = 'completed',    // 完成
  FAILED = 'failed',          // 失败
  CANCELLED = 'cancelled',    // 手动结束
  UNKNOWN = 'unknown',        // 准完成/未知/提示状态, 有时后端api可能缺少某些流程的数据，导致消息的状态未知
  DEFAULT = 'default',        // 默认状态, 用于初始化状态
}

/**
 * 对话过程中，某次发问所选择的agent类型
 */
export enum AgentType {
  ORDINARY = 'ordinary',   // 普通agent
  DEEPSEARCH = 'deepsearch', // 深度研究
}

/**
 * Deepsearch 执行方法
 */
export enum DeepsearchExecutionMethod {
  PARALLEL = "parallel", // 并行执行
  DEPENDENCY_DRIVING = "dependency_driving", // 依赖驱动执行
}

/**
 * 思维链图类型
 */
export enum ThoughtGraphType {
  SECTION = 'section',     // 章节关系图
  TASK = 'task',          // 任务关系图
}

// ===== 基础接口 =====

/**
 * 思维链图管理器集合
 * 用于管理一个messageItems的多个思维链图
 */
export interface MindMapManagers {
  sectionGraph?: any;   // 章节图管理器 (MindMapManager)
  taskGraph?: any;      // 任务图管理器 (MindMapManager)
}

/**
 * 中止消息配置接口
 * 用于在消息中止时添加提示，支持失败和取消两种类型
 */
export interface AbortMessageConfig {
  title: string;
  content: string;
  abortType: TaskStatus.FAILED | TaskStatus.CANCELLED;  // 区分中止类型
}

// ===== 消息相关类型 =====

/**
 * 链接内容接口
 */
export interface LinkContent {
  url: string;                 // 链接地址
  title: string;               // 链接标题
  query?: string;              // 搜索词（collector_info_retrieval返回）
  description?: string;        // 简短描述
  source?: string;             // 来源（如：网页、知识库）
  publishTime?: string;        // 发布时间
  cardStyle?: 'text' | 'card'; // 展示样式
}

/**
 * JSON 对象类型定义
 */
export type JSONObject = Record<string, unknown>;

/**
 * Message 内容的类型定义
 */
export type MessageContent = string | LinkContent | JSONObject;

/**
 * 消息接口
 */
export interface Message {
  // ===== 必选字段 =====
  id: string;                  // 消息唯一标识，格式：task_1[_{section}[_{plan}[_{step}]]]
  type: MessageType;           // 消息类型
  status: TaskStatus;          // 状态
  content: MessageContent;     // 数据内容
                               // - TEXT/REPORT: Markdown字符串或JSONObject
                               // - LINK/DETAIL_LINK: LinkContent对象

  // ===== 可选字段 =====
  title?: string;              // 标题（可选）
  icon?: string;               // 图标标识

  // ===== 元数据字段 =====
  parentMessageId?: string;    // 父消息ID（用于构建树形结构）
  childMessageIds?: string[];     // 子任务ID列表（只存ID，不存对象）

  // ===== 外键字段（用于关联和快速查找） =====
  messageItemsId: string;      // 所属 MessageItems 的 ID
  conversationId: string;       // 所属 Conversation 的 ID
  dependOnMessageIds?:{ [id: string]: string }; // 本Message所依赖的其他message；格式：{message_id: 依赖关系},  样例: {"xxx1": "基础依赖", "xxx2": "信息整合"}

  // ===== 时间字段 =====
  createdAt: number;           // 创建时间戳
  updatedAt: number;           // 最后更新时间戳

  // ===== SSE流式相关 =====
  isStreaming?: boolean;       // 是否正在接收

  // TASK类型数据相关 - 位置索引
  sectionIdx?: number;         // 作用于task类型消息中，用于章节索引：0=主任务, 1-10=章节，用于标识任务在层级结构中的位置； todo: 后续增加studio后端存储时，删除此字段，相应的功能使用indexPath
  indexPath?: string;          // 位置索引路径，格式："section-plan-step"，如 "0-1-2" 表示 section=0, plan=1, step=2
}

// ===== 数据容器类型 =====

/**
 * 消息项接口
 */
export interface MessageItems {
  id: string;                  // MessageItems唯一标识
  status: TaskStatus;          // 状态
  messagesIds: string[];       // 消息Message的id list, 如果是task的message，只写入根节点的id(子节点由根节点去索引)

  // ===== 时间字段 =====
  createdAt: number;           // 创建时间戳
  updatedAt: number;           // 最后更新时间戳

  // ===== 其他 =====
  conversationId: string;      // 会话ID

  // ===== 配置信息 =====
  isUser: boolean;             // 是否用户消息
  agentType?: AgentType;       // Agent类型，用于HITL场景判断agent匹配
  llm?: string;                // 大模型名称
  agentConfig?: { 
    remainingRewriteRounds?: number;  // 剩余 AI 改写次数（用于显示提示）
    maxRewriteRounds?: number;        // 最大 AI 改写次数（用于显示提示）
    [key: string]: any
  }; // agent的参数配置项

  /// 思维图数据； todo: 后续增加studio后端存储时，图数据直接保存于 messageItems数据结构中
  thoughtGraphs?: {
    sectionGraph?: any;  // 章节图 ThoughtGraph
    taskGraph?: any;     // 任务图 ThoughtGraph
  };  // { sectionGraph, taskGraph }，用于保存思维链数据

  // ===== AI 改写相关 =====  todo: 后续增加studio后端存储时，将下面2个数据挪至agentConfig中
  remainingRewriteRounds?: number;  // 剩余 AI 改写次数（用于显示提示）
  maxRewriteRounds?: number;        // 最大 AI 改写次数（用于显示提示）
}

/**
 * 会话接口
 */
export interface Conversation {
  id: string;                  // Conversation的id
  title: string;
  createdAt: number;
  updatedAt: number;
  config: {
    agentType: string;         // agent类型：deepsearch|travel|...
    [key: string]: any;
  };
  messageItemsIds: string[];    // 消息MessageItems的id列表
  lastSessionConversationId?: string; // 连续对话系列中的上一个会话ID，用于恢复对话上下文；连续对话类型包括：deepsearch,
}

// ===== 数据导出类型 =====

/**
 * 会话数据接口
 */
export interface ConversationData {
  conversation: Conversation;
  messageItems: MessageItems[];
  messages: Record<string, Message>;  // Map转对象以便序列化
  thoughtGraphs?: Record<string, {
    sectionGraph?: any;  // 章节图 ThoughtGraph
    taskGraph?: any;     // 任务图 ThoughtGraph
  }>;  // messageItemsId -> { sectionGraph, taskGraph }，用于持久化思维链数据
}

/**
 * 会话索引接口
 */
export interface ConversationsIndex {
  conversations: Record<string, {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    config: Conversation['config'];
  }>;
  lastUpdated: number;
}
