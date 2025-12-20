/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/**
 * 递归查找节点，支持嵌套在循环节点内的节点
 * @param blocks - 节点块数组
 * @param targetId - 目标节点ID（支持完整ID如 'loop_g8Pv1.input_VkPV0' 或短ID如 'input_VkPV0'）
 * @returns 找到的节点或 null
 */
export const findNodeRecursively = (blocks: any[], targetId: string): any => {
  // 先在当前级别查找
  const found = blocks.find(node => node.id === targetId)
  if (found) {
    return found
  }

  // 如果完整ID没找到，尝试匹配短ID（去掉前缀）
  const shortId = targetId.includes('.') ? targetId.split('.').pop() : targetId
  if (shortId !== targetId) {
    const foundByShortId = blocks.find(node => node.id === shortId)
    if (foundByShortId) {
      return foundByShortId
    }
  }

  // 递归搜索嵌套的 blocks
  for (const block of blocks) {
    if (block.blocks && Array.isArray(block.blocks)) {
      const nestedResult = findNodeRecursively(block.blocks, targetId)
      if (nestedResult) {
        return nestedResult
      }
    }
  }

  return null
}