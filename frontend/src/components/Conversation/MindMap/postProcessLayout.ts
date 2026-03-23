import { ThoughtNode, ThoughtEdge } from '../../../stores/handlers/deepsearchMindMapHandler';
import { DEFAULT_LAYOUT_OPTIONS, getNodeWidth } from './types';

/**
 * 计算图的中心点
 */
function calculateGraphCenter(nodes: ThoughtNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };

  const xs = nodes.map(n => n.position?.x || 0);
  const ys = nodes.map(n => n.position?.y || 0);

  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2
  };
}

/**
 * 更可靠的楼层识别 - 基于实际节点分布
 */
function identifyNodeLayers(nodes: ThoughtNode[]): Map<number, ThoughtNode[]> {
  if (nodes.length === 0) return new Map();

  // 收集所有有位置信息的节点的Y坐标
  const yCoordinates = nodes
    .filter(node => node.position?.y !== undefined)
    .map(node => node.position!.y)
    .sort((a, b) => a - b);

  if (yCoordinates.length === 0) return new Map();

  // 使用更简单直接的方法：基于Y坐标聚类识别楼层
  const LAYER_THRESHOLD = 50; // 50px阈值，超过这个距离认为是新楼层

  const layers = new Map<number, ThoughtNode[]>();
  const layerCenters: number[] = [yCoordinates[0]];
  let currentLayer = 0;

  // 寻找楼层中心
  for (let i = 1; i < yCoordinates.length; i++) {
    if (yCoordinates[i] - layerCenters[currentLayer] > LAYER_THRESHOLD) {
      currentLayer++;
      layerCenters.push(yCoordinates[i]);
    }
  }

  // 将每个节点分配到最近的楼层
  nodes.forEach(node => {
    if (node.position?.y !== undefined) {
      let closestLayer = 0;
      let minDistance = Math.abs(node.position.y - layerCenters[0]);

      layerCenters.forEach((centerY, layerIndex) => {
        const distance = Math.abs(node.position.y - centerY);
        if (distance < minDistance) {
          minDistance = distance;
          closestLayer = layerIndex;
        }
      });

      if (!layers.has(closestLayer)) {
        layers.set(closestLayer, []);
      }
      layers.get(closestLayer)!.push(node);
    }
  });

  return layers;
}

/**
 * 实现同层节点顶端对齐
 */
function alignNodesInSameLayer(nodes: ThoughtNode[]): void {
  const layers = identifyNodeLayers(nodes);

  layers.forEach((layerNodes, layerIndex) => {
    if (layerNodes.length <= 1) return;

    // 找到该层最小的Y坐标作为对齐基准
    const minY = Math.min(...layerNodes.map(n => n.position?.y || 0));

    // 将所有节点对齐到同一Y坐标
    layerNodes.forEach(node => {
      if (node.position) {
        node.position.y = minY;
      }
    });
  });
}

/**
 * 实现父子节点水平居中对齐
 *
 * 算法流程：
 * 1. 按深度层遍历所有节点
 * 2. 对每一层的节点，按父节点集合进行分群（排除CROSS_SECTION_DEPEND边）
 * 3. 对每个群体计算平均X坐标并排序
 * 4. 对每个群体内的节点按创建时间排序并居中对齐
 * 5. 解决节点重叠问题
 *
 * @param nodes 节点数组
 * @param edges 边数组
 * @param nodeSpace 节点间距
 * @param addNodeId 新增节点ID，用于定位新增节点。如果提供，且其他节点都已布局，则仅处理新增节点的父节点对齐。
 */
function alignParentChildNodes(
  nodes: ThoughtNode[], 
  edges: ThoughtEdge[], 
  nodeSpace: number, 
  addNodeId?: string
): void {
  let depth = 1; // 当前的深度层
  // 如果提供了新增节点ID，且其他节点都已布局，则仅处理新增节点的父节点对齐
  const addNode = addNodeId? nodes.find(node => node.messageId === addNodeId) : undefined;
  if (addNode !== undefined && addNode.depth !== undefined
     && nodes.every(node => (node.position !== undefined || node.messageId==addNodeId))
    ) {
    // 获取该节点的depth
    depth = addNode.depth;
  }
  else{
    addNodeId = undefined;
  }

  // while循环遍历每个深度层
  while (true) {
    // 获取当前depth层的所有节点，假设为节点集A
    const layerNodes = nodes.filter(node => node.depth === depth);

    // 如果没有节点，结束循环
    if (layerNodes.length === 0) {
      break;
    }

    /**
     * 对A中的节点，进行分群并排序
     * 1. 对每个节点，获取它的父节点们（要排除CROSS_SECTION_DEPEND的边）
     * 2. 拥有完全相同的父节点们的节点，归为一个群体，同时计算它们的父节点的平均x坐标
     * 3. 获得分好群的群体集 B = {B1, B2, ..., Bn}，以及群体对应父节点的平均x坐标 X = {x1, x2, ..., xn}
     * 4. 按照该X坐标的值从小到大进行排序
     */
    const sortedClusters = clusterAndSortNodesByParents(layerNodes, edges, nodes, addNodeId);

    // 遍历排序后的群体
    sortedClusters.forEach(({ cluster, meanX }) => {
      // 先对Bi中的节点，按照创建时间从早到晚排序
      cluster.sort((a, b) => a.createdAt - b.createdAt);

      // 计算这个cluster的宽度：所有节点宽度之和 + 节点间距
      const clusterWeight = cluster.reduce((sum, node) => {
        return sum + getNodeWidth(node.type);
      }, 0) + nodeSpace * (cluster.length - 1);

      // 本cluster的最左侧x坐标（使群体居中对齐到meanX）
      const thisNodeLeftX = meanX - clusterWeight / 2;

      // 为群体中的每个节点分配x坐标
      let currentX = thisNodeLeftX;
      cluster.forEach((node) => {
        if (!node.position) {
          node.position = { x: 0, y: 0 };
        }
        node.position.x = currentX;
        currentX += getNodeWidth(node.type) + nodeSpace;
      });
    });

    depth++;

    // 解决所有层的重叠问题，这样可以为后续节点争取更多的空间，但会增加计算复杂度
    // resolveOverlappingNodes(nodes, DEFAULT_LAYOUT_OPTIONS.nodeSpacing / 5);

    ///  如果新增1个节点，则直接结束循环
    if(addNodeId)
      break;
  }
}

/**
 * 对节点进行分群并排序
 * 1. 对每个节点，获取它的父节点们（排除CROSS_SECTION_DEPEND的边）
 * 2. 拥有完全相同的父节点们的节点，归为一个群体，同时计算它们的父节点的平均x坐标
 * 3. 获得分好群的群体集 B = {B1, B2, ..., Bn}，以及群体对应父节点的平均x坐标 X = {x1, x2, ..., xn}
 * 4. 按照该X坐标的值从小到大进行排序
 *
 * @param layerNodes 当前层的节点
 * @param edges 所有边
 * @param allNodes 所有节点（用于获取父节点位置）
 * @param addNodeId 新增节点ID，用于定位新增节点。如果提供，且其他节点都已布局，则仅处理新增节点的父节点对齐。
 * @returns 排序后的群体及其父节点的平均X坐标
 */
function clusterAndSortNodesByParents(
  layerNodes: ThoughtNode[],
  edges: ThoughtEdge[],
  allNodes: ThoughtNode[],
  addNodeId?: string
): { cluster: ThoughtNode[]; meanX: number }[] {
  // 存储每个节点的父节点集合
  const nodeToParentsMap = new Map<ThoughtNode, Set<string>>();

  layerNodes.forEach(node => {
    // 找到该节点的所有父节点（排除CROSS_SECTION_DEPEND边）
    const parentIds = edges
      .filter(edge =>
        edge.targetId === node.messageId &&
        edge.relation !== 'CROSS_SECTION_DEPEND'
      )
      .map(edge => edge.sourceId);

    // 将父节点ID集合作为key
    nodeToParentsMap.set(node, new Set(parentIds));
  });

  // 按父节点集合分组，并计算每个群体的父节点平均X坐标
  const clustersMap = new Map<string, { nodes: ThoughtNode[]; parentIds: string[] }>();

  nodeToParentsMap.forEach((parents, node) => {
    // 将父节点集合转换为排序后的字符串作为key
    const parentsKey = Array.from(parents).sort().join(',');

    if (!clustersMap.has(parentsKey)) {
      clustersMap.set(parentsKey, { nodes: [], parentIds: Array.from(parents) });
    }
    clustersMap.get(parentsKey)!.nodes.push(node);
  });

  // 如果提供了addNodeId，那clustersMap只保留 nodes包含addNodeId的群体
  if(addNodeId){
    clustersMap.forEach((value, key) => {
      if(!value.nodes.some(node => node.messageId === addNodeId)){
        clustersMap.delete(key);
      }
    })
  }

  // 计算每个群体的父节点平均X坐标，并排序
  const result = Array.from(clustersMap.values())
    .map(({ nodes, parentIds }) => {
      let meanX = 0;

      if (parentIds.length > 0) {
        // 计算父节点的平均X坐标（使用父节点的中心点）
        const parentXSum = parentIds.reduce((sum, parentId) => {
          const parentNode = allNodes.find(n => n.messageId === parentId);
          if (!parentNode?.position) return sum;
          const parentWidth = getNodeWidth(parentNode.type);
          return sum + (parentNode.position.x + parentWidth / 2);
        }, 0);
        meanX = parentXSum / parentIds.length;
      } else {
        // 如果没有父节点（如根节点），使用节点自身的平均X坐标
        const nodeXSum = nodes.reduce((sum, node) => {
          if (!node.position) return sum;
          const nodeWidth = getNodeWidth(node.type);
          return sum + (node.position.x + nodeWidth / 2);
        }, 0);
        meanX = nodeXSum / nodes.length;
      }

      return { cluster: nodes, meanX };
    })
    .sort((a, b) => a.meanX - b.meanX); // 按父节点平均X坐标从小到大排序

  return result;
}

/**
 * 实现水平中心对齐
 */
function alignGraphCenter(nodes: ThoughtNode[]): void {
  if (nodes.length === 0) return;

  const center = calculateGraphCenter(nodes);

  // 将整个图水平居中到原点
  nodes.forEach(node => {
    if (node.position) {
      node.position.x -= center.x;
    }
  });
}

/**
 * 后处理对齐优化
 * @param nodes 布局后的节点
 * @param edges 边数据
 * @param graphType 图类型
 * @returns 优化后的节点
 */
export function postProcessLayout(
  nodes: ThoughtNode[],
  edges: ThoughtEdge[],
  graphType?: 'sectionGraph' | 'taskGraph',
  layerHeight: number = 210 //  改为更准确的参数名：层高（默认140×1.5=210，但保持兼容性）
): ThoughtNode[] {
  // 深拷贝节点，避免修改原数据
  const optimizedNodes = nodes.map(node => ({ ...node }));

  // // 0. 对于任务图，强制SECTION节点在同一楼层
  // if (graphType === 'taskGraph') {
  //   forceSectionNodesSameLayer(optimizedNodes);
  // }

  // // 1. 节点y坐标，实现同层节点顶端对齐
  // alignNodesInSameLayer(optimizedNodes);

  // 2. 强制恢复Y坐标为 depth * 层高（覆盖所有之前的Y坐标修改）
  enforceDepthBasedYPositions(optimizedNodes, layerHeight);

  // 3. 调整节点x坐标，实现父子节点水平居中对齐
  alignParentChildNodes(optimizedNodes, edges, DEFAULT_LAYOUT_OPTIONS.nodeSpacing);

  // 4. 调整节点x坐标，实现整个图的水平中心对齐（在特殊节点对齐之前）
  alignGraphCenter(optimizedNodes);

  // 5. 调整节点x坐标，解决同层节点重叠问题（在Y坐标固定之后）
  resolveOverlappingNodes(optimizedNodes, DEFAULT_LAYOUT_OPTIONS.nodeSpacing/2);

  // 6. 调整特定节点x坐标，实现特定节点类型的特殊对齐（在全局居中和去重叠之后，避免不对齐）
  alignSpecialNodes(optimizedNodes, edges);

  // 7. 如果生成图太过扁长（宽度远小于高度的情况），则等比例拉长节点x坐标；如果过于矮胖（高度远小于宽度），则等比例拉长节点y坐标。
  balanceGraphAspectRatio(optimizedNodes);

  return optimizedNodes;
}

/**
 *  强制恢复Y坐标为 depth × 层高
 * 这个函数必须在所有其他后处理步骤之后调用，以确保Y坐标被强制设置为depth计算的值
 */
function enforceDepthBasedYPositions(nodes: ThoughtNode[], layerHeight: number): void {
  nodes.forEach(node => {
    if (node.position && node.depth !== undefined) {
      const targetY = node.depth * layerHeight;
      const oldY = node.position.y;
      // 只有当Y坐标不同时才更新
      if (Math.abs(oldY - targetY) > 1) { // 允许1px的误差
        node.position.y = targetY;
      }
    }
  });
}

/**
 *  调整图的宽高比，使其保持在合理范围内
 * 目标：
 * - 避免图太窄高（宽/高 < 3/4），通过增加宽度使宽/高 = 3/4
 * - 避免图太扁长（高/宽 < 1/2），通过增加高度使高/宽 = 1/2
 */
function balanceGraphAspectRatio(nodes: ThoughtNode[]): void {
  // 1. 计算所有节点中心坐标
  const nodeCenters = nodes
    .filter(node => node.position)
    .map(node => {
      const nodeWidth = getNodeWidth(node.type);
      return {
        x: node.position!.x + nodeWidth / 2, // 节点中心X坐标
        y: node.position!.y, // 节点Y坐标
      };
    });

  if (nodeCenters.length === 0) return;

  // 2. 计算图的宽度和高度
  const xCoords = nodeCenters.map(c => c.x);
  const yCoords = nodeCenters.map(c => c.y);

  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);

  const width = maxX - minX;
  const height = maxY - minY;

  // 3. 如果宽度或高度为0，不处理
  if (width === 0 || height === 0) return;

  // 4. 计算宽高比
  const widthToHeightRatio = width / height;
  const heightToWidthRatio = height / width;

  // 5. 根据宽高比决定调整策略
  if (widthToHeightRatio < 3/4) {
    // 情况1：图太窄高（宽/高 < 3/4），需要增加宽度
    // 目标：使宽/高 = 3/4，即 targetWidth = 3/4 * height
    const targetWidth = (3 / 4) * height;
    const k = targetWidth / width;

    // k > 1，需要拉伸X坐标
    if (k > 1) {
      nodes.forEach(node => {
        if (node.position) {
          const nodeWidth = getNodeWidth(node.type);
          const centerX = node.position.x + nodeWidth / 2;

          // 应用拉伸公式：新X = (原X - minX) * k + minX
          const newCenterX = (centerX - minX) * k + minX;
          node.position.x = newCenterX - nodeWidth / 2;
        }
      });
    }
  } else if (heightToWidthRatio < 1/2) {
    // 情况2：图太扁长（高/宽 < 1/2），需要增加高度
    // 目标：使高/宽 = 1/2，即 targetHeight = 1/2 * width
    const targetHeight = (1 / 2) * width;
    const k = targetHeight / height;

    // k > 1，需要拉伸Y坐标
    if (k > 1) {
      nodes.forEach(node => {
        if (node.position) {
          // 应用拉伸公式：新Y = (原Y - minY) * k + minY
          const newY = (node.position.y - minY) * k + minY;
          node.position.y = newY;
        }
      });
    }
  }
}

/**
 * 强制任务图中的SECTION节点在同一楼层，并优化X坐标分布
 */
function forceSectionNodesSameLayer(nodes: ThoughtNode[]): void {
  // 找到所有SECTION节点
  const sectionNodes = nodes.filter(node => node.type === 'SECTION');

  if (sectionNodes.length <= 1) return; // 只有一个或没有SECTION节点时不需要处理

  // 按创建时间排序，确保先创建的在左边
  sectionNodes.sort((a, b) => a.createdAt - b.createdAt);

  // 获取所有SECTION节点的Y坐标
  const sectionYPositions = sectionNodes
    .map(node => node.position?.y || 0)
    .filter(y => y !== 0)
    .sort((a, b) => a - b);

  if (sectionYPositions.length === 0) return;

  // 使用中位数作为目标楼层，避免极端值影响
  const targetY = sectionYPositions[Math.floor(sectionYPositions.length / 2)];

  // 检查是否需要调整Y坐标（允许20px的误差范围）
  const allAlreadyAligned = sectionYPositions.every(y => Math.abs(y - targetY) < 20);

  if (!allAlreadyAligned) {
    // 将所有SECTION节点调整到目标楼层
    sectionNodes.forEach(node => {
      if (node.position) {
        node.position.y = targetY;
      }
    });
  }

  // 优化X坐标分布，确保SECTION节点之间有合理间距
  const sectionWidth = getNodeWidth('SECTION');
  const minSpacing = 120; // SECTION节点之间的最小间距，确保子节点不交叉

  // 计算所有SECTION节点的总宽度
  const totalWidth = sectionNodes.length * sectionWidth + (sectionNodes.length - 1) * minSpacing;

  // 计算起始X坐标，使整个SECTION节点组居中
  const startX = -totalWidth / 2;

  // 重新分配每个SECTION节点的X坐标
  sectionNodes.forEach((node, index) => {
    if (node.position) {
      const oldX = node.position.x;
      const newX = startX + index * (sectionWidth + minSpacing);

      if (Math.abs(oldX - newX) > 5) { // 只有变化超过5px才记录日志
      }

      node.position.x = newX;
      node.position.y = targetY;
    }
  });

}

/**
 * 获取节点中心X坐标
 */
function getCenterX(node: ThoughtNode): number {
  if (!node.position) return 0;
  const width = getNodeWidth(node.type);
  return node.position.x + width / 2;
}

/**
 *  解决同层节点重叠问题
 *
 * 算法流程：
 * 1. while遍历每个depth层级（直到找不到节点为止）
 * 2. 对每个层级：
 *    a. 按中心x排序节点
 *    b. for遍历相邻节点对
 *    c. 计算重叠距离 d = (w1+w2)/2 + gap - |x1-x2|
 *    d. 如果 d>0，移动**所有节点**中中心x > min(x1,x2) 的节点向右 +d
 *
 * @param nodes 节点数组
 * @param horizontalGap 水平间距（默认80）
 */
function resolveOverlappingNodes(
  nodes: ThoughtNode[],
  horizontalGap: number = 80
): void {

  // 1. while遍历每个depth层级
  let depth = 0;

  while (true) {
    // 2. 找到当前层级的所有节点
    const levelNodes = nodes.filter(node => node.depth === depth);

    // 找不到节点，说明达到最大深度，退出
    if (levelNodes.length === 0) {
      break;
    }

    // 3. 如果该层级只有一个节点，跳过
    if (levelNodes.length > 1) {
      // 4. 按中心x排序
      const sortedNodes = [...levelNodes].sort((a, b) => {
        const centerA = getCenterX(a);
        const centerB = getCenterX(b);
        return centerA - centerB;
      });

      // 5. for遍历相邻节点对
      for (let i = 0; i < sortedNodes.length - 1; i++) {
        const node1 = sortedNodes[i];
        const node2 = sortedNodes[i + 1];

        if (!node1.position || !node2.position) continue;

        // 6. 计算重叠距离
        const width1 = getNodeWidth(node1.type);
        const width2 = getNodeWidth(node2.type);
        const center1 = getCenterX(node1);
        const center2 = getCenterX(node2);

        const d = (width1 + width2) / 2 + horizontalGap - Math.abs(center1 - center2);

        // 7. 如果没有交集，跳过
        if (d <= 0) {
          continue;
        }

        // 8. 确定基准节点：x更小，或x一样但创建时间更小
        let baseNode: ThoughtNode;
        if (center1 < center2 || (center1 === center2 && node1.createdAt <= node2.createdAt)) {
          baseNode = node1;
        } else {
          baseNode = node2;
        }
        const baseCenterX = getCenterX(baseNode);

        // 9. 移动所有满足条件的节点：centerX >= baseCenterX 且 id != baseNode.id
        let movedCount = 0;
        nodes.forEach(node => {
          if (node.position && node.messageId !== baseNode.messageId) {
            const nodeCenterX = getCenterX(node);
            if (nodeCenterX >= baseCenterX) {
              node.position.x += d;
              movedCount++;
            }
          }
        });
      }
    }

    depth++;
  }
}

/**
 * 实现特定节点类型的特殊对齐
 * 1. OUTLINE节点要对齐到它的所有子节点的中心
 * 2. FINAL_REPORT/SUB_REPORT节点要对齐到它的父节点的中心
 */
function alignSpecialNodes(nodes: ThoughtNode[], edges: ThoughtEdge[]): void {
  // 1. OUTLINE节点对齐到其所有子节点的中心
  const outlineNodes = nodes.filter(node => node.type === 'OUTLINE');


  outlineNodes.forEach(outlineNode => {
    if (!outlineNode.position) return;

    // 找到OUTLINE节点的所有子节点（简单直接的逻辑）
    const allEdgesFromOutline = edges.filter(edge => edge.sourceId === outlineNode.messageId);

    const outlineChildren = allEdgesFromOutline
      .map(edge => nodes.find(n => n.messageId === edge.targetId))
      .filter(node => node && node.position) as ThoughtNode[];

    if (outlineChildren.length === 0) {
      return;
    }

    // 打印所有子节点的详细信息
    outlineChildren.forEach((child, idx) => {
    });

    // 统一算法：计算所有子节点中心点的平均值
    const childCenters = outlineChildren.map(child => {
      const childWidth = getNodeWidth(child.type);
      return child.position!.x + childWidth / 2; // 子节点中心点X坐标
    });

    const outlineCenterX = childCenters.reduce((sum, center) => sum + center, 0) / childCenters.length;

    // 根据OUTLINE中心点计算OUTLINE左边缘X坐标
    const outlineWidth = getNodeWidth('OUTLINE');
    const oldX = outlineNode.position.x;
    const newX = outlineCenterX - outlineWidth / 2;


    outlineNode.position.x = newX;
  });

  // 2. SUB_REPORT和FINAL_REPORT节点对齐到其父节点的中心
  const reportNodes = nodes.filter(node => node.type === 'SUB_REPORT' || node.type === 'FINAL_REPORT');


  reportNodes.forEach(reportNode => {
    if (!reportNode.position) return;

    // 找到报告节点的所有父节点
    const allEdgesToReport = edges.filter(edge => edge.targetId === reportNode.messageId);

    const parentNodes = allEdgesToReport
      .map(edge => nodes.find(n => n.messageId === edge.sourceId))
      .filter(node => node && node.position) as ThoughtNode[];

    if (parentNodes.length === 0) {
      return;
    }

    // 打印所有父节点的详细信息
    parentNodes.forEach((parent, idx) => {
    });

    // 统一算法：计算所有父节点中心点的平均值
    const parentCenters = parentNodes.map(parent => {
      const parentWidth = getNodeWidth(parent.type);
      return parent.position!.x + parentWidth / 2; // 父节点中心点X坐标
    });

    const reportCenterX = parentCenters.reduce((sum, center) => sum + center, 0) / parentCenters.length;

    // 根据报告中心点计算报告左边缘X坐标
    const reportWidth = getNodeWidth(reportNode.type);
    const oldX = reportNode.position.x;
    const newX = reportCenterX - reportWidth / 2;


    reportNode.position.x = newX;
  });
}
