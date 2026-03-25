import { Node, Edge } from '@xyflow/react';
import {
  ThoughtNode,
  ThoughtEdge,
  ThoughtNodeType,
  EdgeRelationType,
  LayoutDirection,
  NODE_DIMENSIONS,
  LayoutOptions,
  DEFAULT_LAYOUT_OPTIONS,
  getNodeWidth,
  getNodeHeight
} from '../../../stores/handlers/deepsearchMindMapHandler';
import { Message, TaskStatus } from '../../../stores/useConversationStore';

// 重新导出思维链核心类型，保持向后兼容
export type { ThoughtNode, ThoughtEdge };
export { ThoughtNodeType, EdgeRelationType };
export type { LayoutDirection };
export { NODE_DIMENSIONS };

// 重新导出布局相关类型和工具函数
export type { LayoutOptions };
export { DEFAULT_LAYOUT_OPTIONS, getNodeWidth, getNodeHeight };

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
