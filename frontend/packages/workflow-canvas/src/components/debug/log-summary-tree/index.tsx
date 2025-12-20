/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC, useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Terminal, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import type { ExecutionLogSummary, InvokeExecuteInfo } from '@test-agentstudio/api-client'

interface LogSummaryTreeProps {
  logSummary?: ExecutionLogSummary
  onNodeClick?: (node: InvokeExecuteInfo) => void
}

interface TreeNode {
  invoke: InvokeExecuteInfo
  level: number
  children: TreeNode[]
  id: string
}

const LogSummaryTree: FC<LogSummaryTreeProps> = ({ logSummary, onNodeClick }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const mergeInvokeInfo = (invokes: InvokeExecuteInfo[]): InvokeExecuteInfo[] => {
    const mergedMap = new Map<string, InvokeExecuteInfo>()

    const filteredInvokes = invokes.filter(invoke => !shouldFilterNode(invoke))

    filteredInvokes.forEach(invoke => {
      const normalizedInvoke = {
        ...invoke,
        invokeId: invoke.invokeId,
        invokeType: invoke.invokeType,
        invokeName: invoke.invokeName || invoke.invoke_name,
        startTimestamp: invoke.startTimestamp,
        duration: invoke.duration,
        status: invoke.status,
        inputTokens: invoke.inputTokens || invoke.input_tokens,
        outputTokens: invoke.outputTokens || invoke.output_tokens,
        inputs: invoke.inputs,
        outputs: invoke.outputs,
        childInvokesExecuteInfo: invoke.childInvokesExecuteInfo || invoke.child_invokes_execute_info,
        llmModel: invoke.llmModel || invoke.llm_model,
        llmTemperature: invoke.llmTemperature || invoke.llm_temperature,
        llmMaximumReplyLength: invoke.llm_maximum_reply_length || invoke.llmMaximumReplyLength,
        llmTtft: invoke.llmTtft || invoke.llm_ttft,
        loopNodeId: invoke.loopNodeId || invoke.loop_node_id,
        loopIndex: invoke.loopIndex || invoke.loop_index,
        workflowVersion: invoke.workflow_version,
      }

      const isLoopIteration = normalizedInvoke.loopNodeId !== null && normalizedInvoke.loopIndex !== null
      const key = isLoopIteration
        ? `${normalizedInvoke.invokeId || `${normalizedInvoke.invokeType}_${normalizedInvoke.invokeName}`}_loop_${normalizedInvoke.loopIndex}`
        : normalizedInvoke.invokeId || `${normalizedInvoke.invokeType}_${normalizedInvoke.invokeName}_${normalizedInvoke.startTimestamp}`

      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!

        const existingStart = existing.startTimestamp || 0
        const existingEnd = existingStart + (existing.duration || 0)
        const currentStart = normalizedInvoke.startTimestamp || 0
        const currentEnd = currentStart + (normalizedInvoke.duration || 0)

        const newStart = Math.min(existingStart, currentStart)
        const newEnd = Math.max(existingEnd, currentEnd)
        const newDuration = newEnd - newStart

        const getStatusPriority = (status?: string) => {
          const s = status?.toLowerCase()
          if (s === 'failed' || s === 'error') return 1
          if (s === 'running' || s === 'processing') return 2
          if (s === 'success' || s === 'completed' || s === 'finish') return 3
          return 4
        }

        const existingPriority = getStatusPriority(existing.status)
        const currentPriority = getStatusPriority(normalizedInvoke.status)
        const finalStatus = existingPriority < currentPriority ? existing.status : normalizedInvoke.status

        const inputTokens = (existing.inputTokens || 0) + (normalizedInvoke.inputTokens || 0)
        const outputTokens = (existing.outputTokens || 0) + (normalizedInvoke.outputTokens || 0)

        const inputs = { ...existing.inputs, ...normalizedInvoke.inputs }
        const outputs = { ...existing.outputs, ...normalizedInvoke.outputs }

        const existingChildren = existing.childInvokesExecuteInfo || []
        const currentChildren = normalizedInvoke.childInvokesExecuteInfo || []
        const allChildren = [...existingChildren, ...currentChildren]
        const uniqueChildren = mergeInvokeInfo(allChildren)

        mergedMap.set(key, {
          ...existing,
          startTimestamp: newStart,
          duration: newDuration,
          status: finalStatus,
          inputTokens,
          outputTokens,
          inputs,
          outputs,
          childInvokesExecuteInfo: uniqueChildren,
        })
      } else {
        mergedMap.set(key, normalizedInvoke)
      }
    })

    return Array.from(mergedMap.values())
  }

  const shouldFilterNode = (invoke: InvokeExecuteInfo): boolean => {
    const invokeType = invoke.invokeType || ''
    return invokeType.includes('block_start') || invokeType.includes('block_end')
  }

  const extractChildInvokes = (invoke: any): InvokeExecuteInfo[] => {
    const children: InvokeExecuteInfo[] = []

    const childArrays = [invoke.childInvokesExecuteInfo, invoke.child_invokes_execute_info]
    childArrays.forEach(childArray => {
      if (Array.isArray(childArray)) {
        children.push(...childArray.filter((item: InvokeExecuteInfo) => !shouldFilterNode(item)))
      }
    })

    const executeLists = [invoke.execute_info_list, invoke.executeInfoList]
    executeLists.forEach(executeList => {
      if (Array.isArray(executeList)) {
        executeList.forEach((item: any) => {
          children.push(...extractChildInvokes(item))
        })
      }
    })

    return children
  }

  const buildTreeData = useMemo(() => {
    if (!logSummary) {
      return []
    }

    let executeInfoList: InvokeExecuteInfo[] = []

    if (logSummary.executeInfoList && Array.isArray(logSummary.executeInfoList)) {
      executeInfoList = logSummary.executeInfoList.filter(item => !shouldFilterNode(item))
    } else if (logSummary.execute_info_list && Array.isArray(logSummary.execute_info_list)) {
      executeInfoList = logSummary.execute_info_list.filter(item => !shouldFilterNode(item))
    } else {
      const extracted = extractChildInvokes(logSummary)
      if (extracted.length > 0) {
        executeInfoList = extracted
      }
    }

    if (executeInfoList.length === 0) {
      return []
    }

    const deduplicatedRoots = mergeInvokeInfo(executeInfoList)

    const trees: TreeNode[] = []
    let nodeCounter = 0

    deduplicatedRoots.forEach(rootInvoke => {
      const buildNodeTree = (invoke: InvokeExecuteInfo, level: number = 0): TreeNode => {
        const rawChildren = extractChildInvokes(invoke)
        const deduplicatedChildren = mergeInvokeInfo(rawChildren)
        const nodeId = `node-${nodeCounter++}`

        return {
          invoke,
          level,
          id: nodeId,
          children: deduplicatedChildren.sort((a, b) => (a.startTimestamp || 0) - (b.startTimestamp || 0)).map(child => buildNodeTree(child, level + 1)),
        }
      }

      const rootNode = buildNodeTree(rootInvoke)
      trees.push(rootNode)
    })

    const allNodeIds = new Set<string>()
    const collectAllIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        allNodeIds.add(node.id)
        if (node.children.length) collectAllIds(node.children)
      })
    }
    collectAllIds(trees)
    setExpandedNodes(allNodeIds)

    return trees.sort((a, b) => (a.invoke.startTimestamp || 0) - (b.invoke.startTimestamp || 0))
  }, [logSummary])

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle size={14} className="text-green-500" />
      case 'failed':
      case 'error':
        return <XCircle size={14} className="text-red-500" />
      case 'running':
      case 'processing':
        return <Clock size={14} className="text-blue-500 animate-pulse" />
      case 'skipped':
        return <AlertCircle size={14} className="text-gray-400" />
      default:
        return <Clock size={14} className="text-gray-400" />
    }
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return ''
    if (duration < 1000) return `${duration}ms`
    if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`
    const minutes = Math.floor(duration / 60000)
    const seconds = ((duration % 60000) / 1000).toFixed(2)
    return `${minutes}m ${seconds}s`
  }

  const TreeNodeComponent: FC<{ node: TreeNode }> = ({ node }) => {
    const { invoke, level, children, id } = node
    const indent = level * 24
    const isExpanded = expandedNodes.has(id)

    return (
      <div>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 cursor-pointer rounded transition-colors group"
          style={{ paddingLeft: `${12 + indent}px` }}
          onClick={() => onNodeClick?.(invoke)}
        >
          {children.length > 0 && (
            <div
              onClick={e => {
                e.stopPropagation()
                toggleNode(id)
              }}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? <ChevronDown size={16} className="text-gray-600" /> : <ChevronRight size={16} className="text-gray-400" />}
            </div>
          )}

          {getStatusIcon(invoke.status)}

          <div className="text-sm font-medium text-gray-900 flex-1 flex items-center gap-2">
            <span>
              {(() => {
                const displayName = invoke.invokeName || invoke.invokeType || 'Unknown Component'
                const loopMatch = displayName.match(/^loop_[^.]+\.(.+)$/)
                if (loopMatch) {
                  return loopMatch[1]
                }
                return displayName
              })()}
            </span>
            {invoke.inputs && Object.keys(invoke.inputs).length > 0 && (
              <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Inputs: {Object.keys(invoke.inputs).length}</span>
            )}
            {invoke.outputs && Object.keys(invoke.outputs).length > 0 && (
              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Outputs: {Object.keys(invoke.outputs).length}</span>
            )}
          </div>

          {invoke.duration && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{formatDuration(invoke.duration)}</span>}

          {invoke.llmModel && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{invoke.llmModel}</span>}

          {invoke.invokeType && invoke.invokeName !== invoke.invokeType && (
            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">{invoke.invokeType}</span>
          )}
        </div>

        {children.length > 0 && isExpanded && (
          <div className="border-l border-gray-200 ml-6">
            {children.map((child, index) => (
              <TreeNodeComponent key={child.invoke.invokeId || `${id}-child-${index}`} node={child} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!logSummary) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
        <Terminal size={48} className="text-gray-300 mx-auto mb-3" />
        <div className="text-gray-500">暂无日志摘要数据</div>
        <div className="text-xs text-gray-400 mt-2">请尝试点击&ldquo;模拟数据&rdquo;按钮查看示例效果</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-blue-500" />
            <span className="font-medium text-gray-900">
              调测树 - {logSummary.execute_info_list?.[0]?.invoke_name || logSummary.executeInfoList?.[0]?.invokeName || 'Workflow'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {logSummary.duration && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">总耗时: {formatDuration(logSummary.duration)}</span>}
            <button
              onClick={() => {
                if (expandedNodes.size > 0) {
                  setExpandedNodes(new Set())
                } else {
                  const allNodeIds = new Set<string>()
                  const collectAllIds = (nodes: TreeNode[]) => {
                    nodes.forEach(node => {
                      allNodeIds.add(node.id)
                      if (node.children.length > 0) {
                        collectAllIds(node.children)
                      }
                    })
                  }
                  collectAllIds(buildTreeData)
                  setExpandedNodes(allNodeIds)
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              {expandedNodes.size > 0 ? '全部折叠' : '全部展开'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {buildTreeData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle size={32} className="text-gray-300 mx-auto mb-2" />
            <div>未找到执行信息</div>
          </div>
        ) : (
          <div className="space-y-1">
            {buildTreeData.map((rootNode, index) => (
              <TreeNodeComponent key={rootNode.invoke.invokeId || `root-${index}`} node={rootNode} />
            ))}
          </div>
        )}
      </div>

      {logSummary.inputTokens !== undefined || logSummary.outputTokens !== undefined ? (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {logSummary.inputTokens !== undefined && (
                <span className="text-gray-600">
                  输入 Tokens: <span className="font-medium text-gray-900">{logSummary.inputTokens}</span>
                </span>
              )}
              {logSummary.outputTokens !== undefined && (
                <span className="text-gray-600">
                  输出 Tokens: <span className="font-medium text-gray-900">{logSummary.outputTokens}</span>
                </span>
              )}
            </div>
            <div className="text-gray-500">
              节点总数:{' '}
              {buildTreeData.reduce((total, node) => {
                const countNodes = (n: TreeNode): number => {
                  return 1 + n.children.reduce((sum, child) => sum + countNodes(child), 0)
                }
                return total + countNodes(node)
              }, 0)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { LogSummaryTree }
