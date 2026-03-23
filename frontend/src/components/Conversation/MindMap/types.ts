import { Node, Edge } from '@xyflow/react';
import {
  ThoughtNode,
  ThoughtEdge,
  ThoughtNodeType,
  EdgeRelationType,
  LayoutDirection,
} from '../../../stores/handlers/deepsearchMindMapHandler';
import { Message, TaskStatus } from '../../../stores/useConversationStore';

export type { ThoughtNode, ThoughtEdge };
export { ThoughtNodeType, EdgeRelationType };
export type { LayoutDirection };

export interface NodeData {
  messageId: string;
  type: ThoughtNodeType;
  message?: Message;
  status?: TaskStatus;
  title?: string;
  content?: string;
  onNodeClick?: (messageId: string) => void;
  [key: string]: unknown;
}

export type ThoughtFlowNode = Node<NodeData>;

export type ThoughtFlowEdge = Edge<{
  relation: EdgeRelationType;
  label?: string;
  visible?: boolean;
}>;

export interface MindMapFlowProps {
  messageItemsId: string;
  className?: string;
}

export interface LayoutOptions {
  direction: LayoutDirection;
  nodeSpacing: number;
  levelSpacing: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: 'TB',
  nodeSpacing: 40,
  levelSpacing: 40, // 楼层间距
};

export const NODE_DIMENSIONS: Record<ThoughtNodeType, { width: number; height: number }> = {
  [ThoughtNodeType.OUTLINE]: { width: 248, height: 50 },
  [ThoughtNodeType.SECTION]: { width: 360, height: 160 },
  [ThoughtNodeType.PLAN]: { width: 260, height: 140 },
  [ThoughtNodeType.SUB_REPORT]: { width: 300, height: 60 },
  [ThoughtNodeType.FINAL_REPORT]: { width: 340, height: 128 },
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