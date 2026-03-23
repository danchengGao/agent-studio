// Web Worker for ELK layout computation
// This worker handles the heavy ELK layout calculations off the main thread

importScripts('https://cdn.jsdelivr.net/npm/elkjs@0.9.3/lib/elk.bundled.js');

let elk = null;

// Initialize ELK
function initializeElk() {
  if (!elk) {
    elk = new ELK();
  }
}

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'layout':
      await handleLayout(data);
      break;
    case 'init':
      initializeElk();
      self.postMessage({ type: 'init', success: true });
      break;
    default:
      self.postMessage({ type: 'error', message: 'Unknown message type' });
  }
};

async function handleLayout(data) {
  try {
    const { nodes, edges, options, graphType } = data;

    if (!elk) {
      initializeElk();
    }

    if (nodes.length === 0) {
      self.postMessage({ type: 'layout', result: nodes });
      return;
    }

    // 🆕 提取到函数顶部，避免重复声明
    // 🆕 动态计算层高：所有节点最大高度 * 1.5
    const maxHeight = Math.max(...nodes.map((node: any) => node.height));
    const LAYER_HEIGHT = Math.round(maxHeight * 1.5); // 动态层高，确保节点不堆叠

    // Sort nodes by creation time for priority
    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt);

    // 🆕 新增：预处理阶段 - 根据depth计算固定Y坐标
    const nodesWithFixedY = nodes.map((node: any) => {
      const fixedY = (node.depth !== undefined ? node.depth : 0) * LAYER_HEIGHT;
      return {
        ...node,
        fixedY, // 保存计算好的固定Y坐标
      };
    });

    // Create ELK graph
    const elkGraph = {
      id: 'root',
      children: nodesWithFixedY.map((node) => {
        const nodeIndex = sortedNodes.findIndex(n => n.messageId === node.messageId);

        return {
          id: node.messageId,
          width: node.width,
          height: node.height,

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
      }),
      edges: edges
        .filter((edge) => edge.visible !== false)
        .map((edge) => ({
          id: edge.id,
          sources: [edge.sourceId],
          targets: [edge.targetId],
        })),
    };

    // Perform layout
    const direction = options.direction === 'LR' ? 'RIGHT' : 'DOWN';
    const layoutedGraph = await elk.layout(elkGraph, {
      layoutOptions: {
        'elk.algorithm': 'org.eclipse.elk.layered',
        'elk.direction': direction,

        // ✅ 新增：考虑模型顺序（配合 order 属性使用）
        'elk.layered.considerModelOrder': 'true',

        'elk.layered.spacing.nodeNodeBetweenLayers': String(options.levelSpacing),
        'elk.spacing.nodeNode': String(options.nodeSpacing),
        'elk.layered.spacing.edgeNodeBetweenLayers': '30',
        'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.cycleBreaking.strategy': 'GREEDY',
        'elk.layered.compaction.postCompaction.strategy': 'LEFT_RIGHT_CONSTRAINT_LOCKING',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.crossingMinimization.semiInteractive': 'true',
        'elk.edgeRouting': 'SPLINES',
        'elk.layered.edgeRouting.splines.mode': 'CONSERVATIVE',
        'elk.layered.edgeRouting.splines.sloppy.layerSpacingFactor': '0.5',
        'elk.separateConnectedComponents': 'true',
        'elk.spacing.componentComponent': '100',
      },
    });

    // Extract layout positions
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

    self.postMessage({ type: 'layout', result: layoutedNodes });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message,
      error: error.toString()
    });
  }
}