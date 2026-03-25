import ELK from 'elkjs/lib/elk.bundled.js';
import { ThoughtNode, ThoughtEdge, ThoughtNodeType } from '../../../stores/handlers/deepsearchMindMapHandler';
import { NODE_DIMENSIONS, LayoutOptions, DEFAULT_LAYOUT_OPTIONS } from './types';
import { postProcessLayout } from './postProcessLayout';

const elk = new ELK();

interface ElkNode {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  properties?: Record<string, string>; // ELK 节点属性（用于固定层级和顺序）
  layoutOptions?: Record<string, string>; // ELK 布局选项
}

interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

interface ElkGraph {
  id: string;
  children: ElkNode[];
  edges: ElkEdge[];
}

export function getNodeTypeString(type: ThoughtNodeType): string {
  const typeMap: Record<ThoughtNodeType, string> = {
    [ThoughtNodeType.OUTLINE]: 'outline',
    [ThoughtNodeType.SECTION]: 'section',
    [ThoughtNodeType.PLAN]: 'plan',
    [ThoughtNodeType.SUB_REPORT]: 'sub_report',
    [ThoughtNodeType.FINAL_REPORT]: 'final_report',
  };
  return typeMap[type] || 'outline';
}

export async function performElkLayout(
  nodes: ThoughtNode[],
  edges: ThoughtEdge[],
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS,
  graphType?: 'sectionGraph' | 'taskGraph' // 添加图类型参数
): Promise<ThoughtNode[]> {
  if (nodes.length === 0) return nodes;

  // 按创建时间排序节点，用于确定优先级
  const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt);

  // 🆕 新增：预处理阶段 - 根据depth计算固定Y坐标
  // 🆕 动态计算层高：所有节点最大高度 * 1.5
  const maxHeight = Math.max(...nodes.map(node => NODE_DIMENSIONS[node.type].height));
  const LAYER_HEIGHT = Math.round(maxHeight * 1.5); // 动态层高，确保节点不堆叠

  const nodesWithFixedY = nodes.map(node => {
    const fixedY = (node.depth !== undefined ? node.depth : 0) * LAYER_HEIGHT;
    return {
      ...node,
      fixedY, // 保存计算好的固定Y坐标
    };
  });

  const elkNodes: ElkNode[] = nodesWithFixedY.map((node) => {
    const dimensions = NODE_DIMENSIONS[node.type];
    const nodeIndex = sortedNodes.findIndex(n => n.messageId === node.messageId);

    return {
      id: node.messageId,
      width: dimensions.width,
      height: dimensions.height,

      // ✅ 使用 ELK 的 properties 来固定楼层和顺序
      properties: {
        'elk.layered.layering.layerConstraint': 'FIXED',
        'elk.layered.layering.layerId': String(node.depth ?? 0),
        'org.eclipse.elk.order': String(nodeIndex),
      },

      layoutOptions: {
        'elk.aspectRatio': '1.0',
      },
    };
  });

  const elkEdges: ElkEdge[] = edges
    .filter((edge) => edge.visible !== false)
    .map((edge) => ({
      id: edge.id,
      sources: [edge.sourceId],
      targets: [edge.targetId],
    }));

  const direction = options.direction === 'LR' ? 'RIGHT' : 'DOWN';

  const elkGraph: ElkGraph = {
    id: 'root',
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const layoutedGraph = await elk.layout(elkGraph, {
      layoutOptions: {
        // 核心算法配置
        'elk.algorithm': 'org.eclipse.elk.layered',
        'elk.direction': direction,

        // ✅ 新增：考虑模型顺序（配合 order 属性使用）
        'elk.layered.considerModelOrder': 'true',

        // 楼层和间距控制 - 增大楼层间距，使楼层更清晰
        'elk.layered.spacing.nodeNodeBetweenLayers': String(options.levelSpacing),
        'elk.spacing.nodeNode': String(options.nodeSpacing),
        'elk.layered.spacing.edgeNodeBetweenLayers': '30',

        // 分层策略优化 - 减少楼层数量
        'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.cycleBreaking.strategy': 'GREEDY',

        // 宽度优化 - 减小水平宽度
        'elk.layered.compaction.postCompaction.strategy': 'LEFT_RIGHT_CONSTRAINT_LOCKING',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',

        // 交叉最小化 - 减少边交叉
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.crossingMinimization.semiInteractive': 'true',

        // 边路由优化 - 使用曲线连接
        'elk.edgeRouting': 'SPLINES',
        'elk.layered.edgeRouting.splines.mode': 'CONSERVATIVE',
        'elk.layered.edgeRouting.splines.sloppy.layerSpacingFactor': '0.5',

        // 组件分离 - 处理不连通的子图
        'elk.separateConnectedComponents': 'true',
        'elk.spacing.componentComponent': '100',
      },
    });

    const layoutedNodes = nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.messageId);
      if (elkNode && elkNode.x !== undefined && elkNode.y !== undefined) {
        return {
          ...node,
          position: { x: elkNode.x, y: elkNode.y },
        };
      }
      return node;
    });

    // 应用后处理对齐优化
    const optimizedNodes = postProcessLayout(layoutedNodes, edges, LAYER_HEIGHT);

    return optimizedNodes;
  } catch (error) {
    console.error('ELK layout failed, falling back to simple layout:', error);
    return performSimpleLayout(nodes, edges, options.direction);
  }
}

export function performSimpleLayout(
  nodes: ThoughtNode[],
  edges: ThoughtEdge[],
  direction: 'TB' | 'LR' = 'TB'
): ThoughtNode[] {
  if (nodes.length === 0) return nodes;

  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, ThoughtEdge[]>();

  nodes.forEach((node) => {
    inDegree.set(node.messageId, 0);
    outEdges.set(node.messageId, []);
  });

  edges.forEach((edge) => {
    const currentInDegree = inDegree.get(edge.targetId) || 0;
    inDegree.set(edge.targetId, currentInDegree + 1);
    const currentOutEdges = outEdges.get(edge.sourceId) || [];
    currentOutEdges.push(edge);
    outEdges.set(edge.sourceId, currentOutEdges);
  });

  const levels: string[][] = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0 || visited.size < nodes.length) {
    const level: string[] = [];
    const nextQueue: string[] = [];

    queue.forEach((nodeId) => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        level.push(nodeId);

        const children = outEdges.get(nodeId) || [];
        children.forEach((edge) => {
          const targetInDegree = inDegree.get(edge.targetId) || 0;
          if (targetInDegree > 0) {
            inDegree.set(edge.targetId, targetInDegree - 1);
            if (targetInDegree - 1 === 0) {
              nextQueue.push(edge.targetId);
            }
          }
        });
      }
    });

    if (level.length > 0) {
      levels.push(level);
    }

    queue.length = 0;
    queue.push(...nextQueue);

    if (queue.length === 0 && visited.size < nodes.length) {
      nodes.forEach((node) => {
        if (!visited.has(node.messageId)) {
          visited.add(node.messageId);
          queue.push(node.messageId);
        }
      });
    }
  }

  const nodeSpacing = DEFAULT_LAYOUT_OPTIONS.nodeSpacing;
  const levelSpacing = DEFAULT_LAYOUT_OPTIONS.levelSpacing;

  const layoutedNodes = nodes.map((node) => {
    let levelIndex = -1;
    let positionInLevel = -1;

    for (let i = 0; i < levels.length; i++) {
      const pos = levels[i].indexOf(node.messageId);
      if (pos !== -1) {
        levelIndex = i;
        positionInLevel = pos;
        break;
      }
    }

    if (levelIndex === -1) {
      return node;
    }

    const levelSize = levels[levelIndex].length;
    const totalWidth = (levelSize - 1) * nodeSpacing;
    const startX = -totalWidth / 2;

    let x: number, y: number;

    if (direction === 'TB') {
      x = startX + positionInLevel * nodeSpacing;
      y = levelIndex * levelSpacing;
    } else {
      x = levelIndex * levelSpacing;
      y = startX + positionInLevel * nodeSpacing;
    }

    return {
      ...node,
      position: { x, y },
    };
  });

  return layoutedNodes;
}

/**
 * 使用Web Worker进行布局计算（异步高性能版本）
 * @param nodes 节点数据
 * @param edges 边数据
 * @param options 布局选项
 * @param graphType 图类型
 * @returns 布局后的节点
 */
export async function performElkLayoutWithWorker(
  nodes: ThoughtNode[],
  edges: ThoughtEdge[],
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS,
  graphType?: 'sectionGraph' | 'taskGraph'
): Promise<ThoughtNode[]> {
  if (nodes.length === 0) return nodes;

  // 🆕 计算动态层高，与主线程保持一致
  const maxHeight = Math.max(...nodes.map(node => NODE_DIMENSIONS[node.type].height));
  const LAYER_HEIGHT = Math.round(maxHeight * 1.5);

  try {
    // 创建Web Worker
    const worker = new Worker(new URL('./layoutWorker.ts', import.meta.url), {
      type: 'module'
    });

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Layout calculation timeout'));
      }, 30000); // 30秒超时

      // 监听Worker消息
      worker.onmessage = (e) => {
        const { type, result, message, error } = e.data;

        if (type === 'layout') {
          clearTimeout(timeout);
          worker.terminate();

          // 应用后处理对齐优化，使用动态计算的层高
          const optimizedNodes = postProcessLayout(result, edges, LAYER_HEIGHT);

          resolve(optimizedNodes);
        } else if (type === 'error') {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(message || error || 'Unknown layout error'));
        }
      };

      // 监听Worker错误
      worker.onerror = (error) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(`Worker error: ${error.message}`));
      };

      // 发送布局任务给Worker
      const workerNodes = nodes.map(node => ({
        ...node,
        width: NODE_DIMENSIONS[node.type].width,
        height: NODE_DIMENSIONS[node.type].height,
        type: node.type
      }));

      worker.postMessage({
        type: 'layout',
        data: {
          nodes: workerNodes,
          edges,
          options,
          graphType // 传递图类型给Worker
        }
      });
    });
  } catch (error) {
    console.error('Web Worker layout failed, falling back to main thread:', error);
    // 如果Web Worker失败，回退到主线程布局
    return performElkLayout(nodes, edges, options, graphType);
  }
}

/**
 * 智能布局函数 - 自动选择使用Web Worker或主线程布局
 * 对于大型图（节点数>10）使用Web Worker，小型图使用主线程
 */
export async function performSmartLayout(
  nodes: ThoughtNode[],
  edges: ThoughtEdge[],
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS,
  graphType?: 'sectionGraph' | 'taskGraph'
): Promise<ThoughtNode[]> {
  // 对于大型图使用Web Worker，小型图使用主线程以避免Worker创建开销
  if (nodes.length > 10) {
    try {
      return await performElkLayoutWithWorker(nodes, edges, options, graphType);
    } catch (error) {
      console.warn('Web Worker layout failed, falling back to main thread:', error);
      return performElkLayout(nodes, edges, options, graphType);
    }
  } else {
    return performElkLayout(nodes, edges, options, graphType);
  }
}