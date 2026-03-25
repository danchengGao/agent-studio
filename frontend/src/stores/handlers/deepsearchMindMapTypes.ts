// ===== 枚举定义 =====

/**
 * 思维链节点类型
 * 用于决定节点的样式渲染
 */
export enum ThoughtNodeType {
  OUTLINE = 'OUTLINE',       // 总框架节点，也是开始节点
  SECTION = 'SECTION',       // 分段节点
  PLAN = 'PLAN',              // 任务节点
  SUB_REPORT = 'SUB_REPORT', // 子报告节点
  FINAL_REPORT = 'FINAL_REPORT' // 最终报告节点
}

/**
 * 边关系类型
 */
export enum EdgeRelationType {
  // 父子关系：如果2个message存在父子关系，则可能会添加此关系；但有时2个message存在父子关系，可能考虑连线的精简，就不会在图中添加此关系
  PARENT = 'PARENT',

  // 章节依赖关系：后端sse数据中的章节依赖数据
  SECTION_DEPEND = 'SECTION_DEPEND',

  // 同章节plan任务之间的依赖关系：后端sse数据中，收集任务之间的依赖关系，最后会从收集任务层级会上升至plan任务层级，然后再体现这个依赖关系
  PLAN_DEPEND = 'PLAN_DEPEND',

  // 跨章节之间的依赖关系：可以是plan-plan的，也可以是step-step的，都两端不是同一个章节的。后端sse数据中，跨章节的plan任务之间的依赖关系，会收集任务层级会上升至plan任务层级，然后再体现这个依赖关系
  CROSS_SECTION_DEPEND = 'CROSS_SECTION_DEPEND',

  // 报告相关的依赖关系：此依赖关系在sse数据流中并不存在，是后面人为添加的，包含：
  // 1. plan任务与子报告的依赖关系
  // 2. 子报告与总报告的依赖关系
  REPORT_DEPEND = 'REPORT_DEPEND',
}

/**
 * 布局方向
 */
export type LayoutDirection = 'TB' | 'LR'; // Top-Bottom | Left-Right

// ===== 类型定义 =====

/**
 * 思维链节点数据结构
 * 通过 messageId 关联到 Message，获取 title、status、content 等显示数据
 */
export interface ThoughtNode {
  // ===== 标识 =====
  messageId: string;              // 指向 Message，也是 Node 的唯一 id

  // ===== 类型（决定样式渲染）=====
  type: ThoughtNodeType;

  // ===== 位置（布局算法计算或手动拖动）=====
  position?: {
    x: number;
    y: number;
  };

  // ===== 位置控制 =====
  isManuallyPositioned?: boolean; // 标记是否为手动调整的位置

  // 节点深度，从0开始，用于计算层级间距
  depth?: number;

  // ===== 时间字段 =====
  createdAt: number;
  updatedAt: number;
}

/**
 * 思维链边数据结构
 */
export interface ThoughtEdge {
  // ===== 标识（随机生成的唯一标识码）=====
  id: string;                     // 使用 crypto.randomUUID() 生成

  // ===== 关联 =====
  sourceId: string;               // 源节点 messageId
  targetId: string;               // 目标节点 messageId

  // ===== 关系类型 =====
  relation: EdgeRelationType;

  // ===== 标签（可为空）=====
  label?: string;

  // ===== 显示控制 =====
  visible?: boolean;              // 默认 true

  // ===== 时间字段 =====
  createdAt: number;
  updatedAt: number;
}

/**
 * 布局配置
 */
export interface LayoutConfig {
  direction: LayoutDirection;     // Top-Bottom | Left-Right
  isAutoLayout: boolean;          // 是否自动布局
  nodeSpacing: number;            // 节点间距
  levelSpacing: number;           // 层级间距
}

/**
 * 思维链图整体数据结构
 */
export interface ThoughtGraph {
  // ===== 标识（随机生成的唯一标识码）=====
  id: string;                     // 使用 crypto.randomUUID() 生成
  // ===== 其他 =====
  messageItemsId: string;      // 所属 MessageItems 的 ID
  conversationId: string;       // 所属 Conversation 的 ID

  // ===== 节点和边 =====
  nodes: ThoughtNode[];
  edges: ThoughtEdge[];

  // ===== 布局配置（可选）=====
  layoutConfig?: LayoutConfig;

  // ===== 是否需要重新布局，增删节点/边或修改布局配置时为true =====
  needLayout: boolean;

  // ===== 时间字段 =====
  createdAt: number;
  updatedAt: number;
}

/**
 * 节点尺寸配置
 */
export const NODE_DIMENSIONS: Record<ThoughtNodeType, { width: number; height: number }> = {
  [ThoughtNodeType.OUTLINE]: { width: 248, height: 50 },
  [ThoughtNodeType.SECTION]: { width: 360, height: 160 },
  [ThoughtNodeType.PLAN]: { width: 260, height: 140 },
  [ThoughtNodeType.SUB_REPORT]: { width: 300, height: 60 },
  [ThoughtNodeType.FINAL_REPORT]: { width: 340, height: 128 },
};

/**
 * 布局选项
 */
export interface LayoutOptions {
  direction: LayoutDirection;
  nodeSpacing: number;
  levelSpacing: number;
}

/**
 * 默认布局选项
 */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: 'TB',
  nodeSpacing: 40,
  levelSpacing: 40, // 楼层间距
};

/**
 * 获取节点宽度 - 从 NODE_DIMENSIONS 单一数据源获取
 */
export function getNodeWidth(type: string): number {
  return NODE_DIMENSIONS[type as keyof typeof NODE_DIMENSIONS]?.width || 200;
}

/**
 * 获取节点高度 - 从 NODE_DIMENSIONS 单一数据源获取
 */
export function getNodeHeight(type: string): number {
  return NODE_DIMENSIONS[type as keyof typeof NODE_DIMENSIONS]?.height || 100;
}
