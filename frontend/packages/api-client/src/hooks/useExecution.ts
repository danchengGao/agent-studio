import { useState, useCallback, useRef } from 'react'
import ExecutionService from '../services/executionService'
import {
  WorkflowExecutionRequest,
  WorkflowCancelRequest,
  WorkflowExecutionEvent,
  WorkflowExecutionResult,
  WorkflowExecutionStatus,
  NodeExecutionStatus,
  ComponentExecuteRequest,
  ComponentExecuteResponse,
  ComponentCancelRequest,
} from '../types'
import { API_ENDPOINTS } from '../config'
import { nanoid } from 'nanoid'
import { useMutation } from 'react-query'

// 执行相关的React Query hooks

// 流式执行工作流
export const useStreamWorkflowExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<WorkflowExecutionResult | null>(null)
  const [logs, setLogs] = useState<Array<{ timestamp: string; level: string; message: string; nodeId?: string }>>([])
  const [progress, setProgress] = useState<{ current: number; total: number; percentage: number; currentNode?: string } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeExecutionStatus>>(new Map())
  const [isInputInterrupted, setIsInputInterrupted] = useState(false)
  const [inputInterruption, setInputInterruption] = useState<{
    nodeId: string
    nodeTitle: string
    schema: any
    executionId: string
    queryVars?: Record<string, any>
    interactionMsg?: string
  } | null>(null)

  const closeConnectionRef = useRef<(() => void) | null>(null)
  const executionIdRef = useRef<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const spaceIdRef = useRef<string | null>(null)
  const workflowVersionRef = useRef<string | null>(null)

  // 更新节点状态的辅助函数
  const updateNodeStatus = useCallback((nodeId: string, status: NodeExecutionStatus) => {
    setNodeStatuses(prev => {
      const newMap = new Map(prev)
      newMap.set(nodeId, status)

      // 同步更新ExecutionService中的活跃节点状态
      import('../services/executionService').then(({ ExecutionService }) => {
        ExecutionService.setActiveNodeStatuses(newMap)
      })

      return newMap
    })
  }, [])

  const executeWorkflow = useCallback(
    async (request: WorkflowExecutionRequest) => {
      setIsExecuting(true)
      setError(null)
      setExecutionResult(null)
      setLogs([])
      setProgress(null)
      setNodeStatuses(new Map())
      setIsInputInterrupted(false)
      setInputInterruption(null)

      // 导入ExecutionService并设置活跃节点状态
      import('../services/executionService').then(({ ExecutionService }) => {
        ExecutionService.setActiveNodeStatuses(new Map())
      })

      // 生成会话ID（如果未提供）
      const conversationId = request.conversation_id || nanoid()

      // 构建完整的执行请求
      const executionRequest: WorkflowExecutionRequest = {
        ...request,
        conversation_id: conversationId,
      }

      // 保存执行参数
      spaceIdRef.current = request.space_id
      workflowVersionRef.current = request.version
      conversationIdRef.current = conversationId
      executionIdRef.current = request.id

      try {
        const closeConnection = await ExecutionService.executeWorkflow(
          executionRequest,
          (event: WorkflowExecutionEvent) => {
            // 处理节点执行事件
            if (event.interaction_node) {
              // 处理交互中断事件 - 执行已被中断，关闭当前连接
              if (closeConnectionRef.current) {
                closeConnectionRef.current()
                closeConnectionRef.current = null
              }

              setIsInputInterrupted(true)
              setInputInterruption({
                nodeId: event.interaction_node || event.id,
                nodeTitle: '输入节点',
                schema: { type: 'object', properties: {} },
                executionId: executionIdRef.current || event.id,
                queryVars: {},
                interactionMsg: event.interaction_msg,
              })
              setIsExecuting(false) // 执行已中断
              setExecutionResult(null) // 清除之前的执行结果
            } else {
              if (event.status === 'start') {
                updateNodeStatus(event.id, {
                  nodeId: event.id,
                  status: 'running',
                  startTime: event.start_time || new Date().toISOString(),
                  inputs: event.inputs,
                  parentId: event.parent_id,
                  loopIndex: event.loop_index,
                })
              } else if (event.status === 'finish') {
                const endTime = event.end_time || new Date().toISOString()
                const startTime = event.start_time || new Date().toISOString()
                const duration = new Date(endTime).getTime() - new Date(startTime).getTime()

                updateNodeStatus(event.id, {
                  nodeId: event.id,
                  status: 'completed',
                  startTime: event.start_time || new Date().toISOString(),
                  endTime: endTime,
                  inputs: event.inputs,
                  outputs: event.outputs,
                  parentId: event.parent_id,
                  loopIndex: event.loop_index,
                  duration: duration,
                })
              }
            }

            if (event.status === 'failed' || event.status === 'error') {
              updateNodeStatus(event.id, {
                nodeId: event.id,
                status: 'failed',
                startTime: event.start_time || new Date().toISOString(),
                endTime: event.end_time || new Date().toISOString(),
                inputs: event.inputs,
                outputs: event.outputs,
                error: event.error,
                parentId: event.parent_id,
                loopIndex: event.loop_index,
              })

              // 如果是error状态，设置错误信息
              if (event.status === 'error' && event.error) {
                setError(new Error(event.error))
                setIsExecuting(false)
              }
            }
          },
          (error: Error) => {
            setError(error)
            setIsExecuting(false)
          },
          () => {
            setIsExecuting(false)
          },
        )

        closeConnectionRef.current = closeConnection
      } catch (error) {
        setError(error as Error)
        setIsExecuting(false)
      }
    },
    [updateNodeStatus],
  )

  const stopExecution = useCallback(() => {
    if (closeConnectionRef.current) {
      closeConnectionRef.current()
      closeConnectionRef.current = null
      setIsExecuting(false)
    }
  }, [])

  const resumeExecution = useCallback(
    async (inputs: Record<string, any>) => {
      if (!inputInterruption) {
        throw new Error('没有可恢复的执行 - inputInterruption 为空')
      }
      if (!spaceIdRef.current) {
        throw new Error('没有可恢复的执行 - spaceId 为空')
      }
      if (!executionIdRef.current) {
        throw new Error('没有可恢复的执行 - executionId 为空')
      }
      if (!conversationIdRef.current) {
        throw new Error('没有可恢复的执行 - conversationId 为空')
      }
      if (workflowVersionRef.current === null || workflowVersionRef.current === undefined) {
        throw new Error('没有可恢复的执行 - workflowVersion 为空')
      }

      try {
        setIsInputInterrupted(false)
        setInputInterruption(null)
        setIsExecuting(true)

        // 重置ExecutionService中的活跃节点状态
        import('../services/executionService').then(({ ExecutionService }) => {
          ExecutionService.setActiveNodeStatuses(new Map())
        })

        // 发送用户输入请求 - 使用新的inputs结构
        const userInputRequest = {
          space_id: spaceIdRef.current,
          id: executionIdRef.current,
          version: workflowVersionRef.current,
          conversation_id: conversationIdRef.current,
          inputs: {
            node_id: inputInterruption.nodeId,
            input_value: inputs,
          },
        }

        const closeConnection = await ExecutionService.handleUserInput(
          userInputRequest,
          event => {
            // 处理恢复执行的事件，复用现有的处理逻辑
            if (event.interaction_node) {
              // 处理交互中断事件 - 执行已被中断，关闭当前连接
              if (closeConnectionRef.current) {
                closeConnectionRef.current()
                closeConnectionRef.current = null
              }

              setIsInputInterrupted(true)
              setInputInterruption({
                nodeId: event.interaction_node || event.id,
                nodeTitle: '输入节点',
                schema: { type: 'object', properties: {} },
                executionId: executionIdRef.current || event.id,
                queryVars: {},
                interactionMsg: event.interaction_msg,
              })
              setIsExecuting(false) // 执行已中断
              setExecutionResult(null) // 清除之前的执行结果
            } else {
              // 处理非交互事件 (trace, log, result, error, failed)
              if (event.status === 'start') {
                updateNodeStatus(event.id, {
                  nodeId: event.id,
                  status: 'running',
                  startTime: event.start_time || new Date().toISOString(),
                  inputs: event.inputs,
                  parentId: event.parent_id,
                  loopIndex: event.loop_index,
                })
              } else if (event.status === 'finish') {
                const endTime = event.end_time || new Date().toISOString()
                const startTime = event.start_time || new Date().toISOString()
                const duration = new Date(endTime).getTime() - new Date(startTime).getTime()

                updateNodeStatus(event.id, {
                  nodeId: event.id,
                  status: 'completed',
                  startTime: event.start_time || new Date().toISOString(),
                  endTime: endTime,
                  inputs: event.inputs,
                  outputs: event.outputs,
                  parentId: event.parent_id,
                  loopIndex: event.loop_index,
                  duration: duration,
                })
              } else if (event.status === 'failed' || event.status === 'error') {
                updateNodeStatus(event.id, {
                  nodeId: event.id,
                  status: 'failed',
                  startTime: event.start_time || new Date().toISOString(),
                  endTime: event.end_time || new Date().toISOString(),
                  inputs: event.inputs,
                  outputs: event.outputs,
                  error: event.error,
                  parentId: event.parent_id,
                  loopIndex: event.loop_index,
                })

                // 如果是error状态，设置错误信息
                if (event.status === 'error' && event.error) {
                  setError(new Error(event.error))
                  setIsExecuting(false)
                }
              }
            }
          },
          error => {
            setError(error)
            setIsExecuting(false)
          },
          () => {
            setIsExecuting(false)
          },
        )

        // 保存关闭连接的引用
        closeConnectionRef.current = closeConnection
      } catch (error) {
        setError(error as Error)
        setIsExecuting(false)
      }
    },
    [inputInterruption],
  )

  const reset = useCallback(() => {
    setExecutionResult(null)
    setLogs([])
    setProgress(null)
    setError(null)
    setIsExecuting(false)
    setNodeStatuses(new Map())
    setIsInputInterrupted(false)
    setInputInterruption(null)
    executionIdRef.current = null
    conversationIdRef.current = null
    spaceIdRef.current = null
    workflowVersionRef.current = null
  }, [])

  return {
    executeWorkflow,
    stopExecution,
    resumeExecution,
    reset,
    isExecuting,
    executionResult,
    logs,
    progress,
    error,
    nodeStatuses,
    isInputInterrupted,
    inputInterruption,
    isCompleted: executionResult?.status === WorkflowExecutionStatus.COMPLETED,
    isFailed: executionResult?.status === WorkflowExecutionStatus.FAILED,
  }
}

// 单节点调试hook
export const useComponentExecute = () => {
  return useMutation((request: ComponentExecuteRequest) =>
    ExecutionService.executeComponent(request),
    {
      onError: (error: Error) => {
        console.error('单节点调试失败:', error)
      },
      onSuccess: (data) => {
        console.log('单节点调试成功:', data)
      },
    }
  )
}

// 智能体执行hook
export const useStreamAgentExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false)
  const [agentResponse, setAgentResponse] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isInputInterrupted, setIsInputInterrupted] = useState(false)
  const [inputInterruption, setInputInterruption] = useState<{
    nodeId: string
    interactionMsg: string | string[]
  } | null>(null)

  const closeConnectionRef = useRef<(() => void) | null>(null)
  const spaceIdRef = useRef<string | null>(null)
  const agentIdRef = useRef<string | null>(null)
  const agentVersionRef = useRef<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)

  const executeAgent = useCallback(
    async (request: {
      space_id: string
      id: string
      version: string
      inputs: { query: string }
      conversation_id: string
    }) => {
      setIsExecuting(true)
      setError(null)
      setAgentResponse(null)
      setIsInputInterrupted(false)
      setInputInterruption(null)

      // 生成会话ID（如果未提供）
      const conversationId = request.conversation_id

      // 保存执行参数
      spaceIdRef.current = request.space_id
      agentIdRef.current = request.id
      agentVersionRef.current = request.version
      conversationIdRef.current = conversationId

      try {
        const closeConnection = await ExecutionService.executionAgent(
          request,
          (event: WorkflowExecutionEvent) => {
            // 处理交互中断事件
            if (event.interaction_node) {
              // 处理交互中断事件 - 执行已被中断，关闭当前连接
              if (closeConnectionRef.current) {
                closeConnectionRef.current()
                closeConnectionRef.current = null
              }

              setIsInputInterrupted(true)
              setInputInterruption({
                nodeId: event.interaction_node,
                interactionMsg: event.interaction_msg || 'Please enter your input',
              })
              setIsExecuting(false) // 执行已中断
            } else if (event.output_text) {
              // 处理正常智能体响应
              setAgentResponse(prev => (prev ? prev + event.output_text : event.output_text || ''))
            } else if (event.status === 'failed' || event.status === 'error') {
              // 处理错误状态
              if (event.error) {
                setError(new Error(event.error))
                setIsExecuting(false)
              }
            }
          },
          (error: Error) => {
            setError(error)
            setIsExecuting(false)
          },
          () => {
            setIsExecuting(false)
          },
        )

        closeConnectionRef.current = closeConnection
      } catch (error) {
        setError(error as Error)
        setIsExecuting(false)
      }
    },
    [],
  )

  const resumeAgentExecution = useCallback(
    async (userInput: string) => {
      if (!inputInterruption) {
        throw new Error('没有可恢复的执行 - inputInterruption 为空')
      }
      if (!spaceIdRef.current) {
        throw new Error('没有可恢复的执行 - spaceId 为空')
      }
      if (!agentIdRef.current) {
        throw new Error('没有可恢复的执行 - agentId 为空')
      }
      if (!agentVersionRef.current) {
        throw new Error('没有可恢复的执行 - agentVersion 为空')
      }
      if (!conversationIdRef.current) {
        throw new Error('没有可恢复的执行 - conversationId 为空')
      }

      try {
        setIsInputInterrupted(false)
        setInputInterruption(null)
        setIsExecuting(true)

        // 发送智能体用户输入请求
        const userInputRequest = {
          space_id: spaceIdRef.current,
          id: agentIdRef.current,
          version: agentVersionRef.current,
          conversation_id: conversationIdRef.current,
          inputs: {
            node_id: inputInterruption.nodeId,
            input_value: {
              userInput: userInput,
            },
          },
        }

        const closeConnection = await ExecutionService.handleAgentUserInput(
          userInputRequest,
          (event: WorkflowExecutionEvent) => {
            // 处理恢复执行的事件
            if (event.interaction_node) {
              // 处理交互中断事件 - 执行已被中断，关闭当前连接
              if (closeConnectionRef.current) {
                closeConnectionRef.current()
                closeConnectionRef.current = null
              }

              setIsInputInterrupted(true)
              setInputInterruption({
                nodeId: event.interaction_node,
                interactionMsg: event.interaction_msg || 'Please enter your input',
              })
              setIsExecuting(false) // 执行已中断
            } else if (event.output_text) {
              // 处理正常智能体响应
              setAgentResponse(prev => (prev ? prev + event.output_text : event.output_text || ''))
            } else if (event.status === 'failed' || event.status === 'error') {
              // 处理错误状态
              if (event.error) {
                setError(new Error(event.error))
                setIsExecuting(false)
              }
            }
          },
          (error: Error) => {
            setError(error)
            setIsExecuting(false)
          },
          () => {
            setIsExecuting(false)
          },
        )

        // 保存关闭连接的引用
        closeConnectionRef.current = closeConnection
      } catch (error) {
        setError(error as Error)
        setIsExecuting(false)
      }
    },
    [inputInterruption],
  )

  const stopExecution = useCallback(() => {
    if (closeConnectionRef.current) {
      closeConnectionRef.current()
      closeConnectionRef.current = null
      setIsExecuting(false)
    }
  }, [])

  const reset = useCallback(() => {
    setAgentResponse(null)
    setError(null)
    setIsExecuting(false)
    setIsInputInterrupted(false)
    setInputInterruption(null)
    spaceIdRef.current = null
    agentIdRef.current = null
    agentVersionRef.current = null
    conversationIdRef.current = null
  }, [])

  return {
    executeAgent,
    resumeAgentExecution,
    stopExecution,
    reset,
    isExecuting,
    agentResponse,
    error,
    isInputInterrupted,
    setIsInputInterrupted,
    inputInterruption,
    setInputInterruption,
  }
}

export const useCancelWorkflowExecution = () => {
  return useMutation(
    async (request: WorkflowCancelRequest) => {
      return await ExecutionService.cancelWorkflowExecution(request)
    },
    {
      onSuccess: (data) => {
        console.log('Workflow execution cancelled successfully:', data)
      },
      onError: (error: Error) => {
        console.error('Failed to cancel workflow execution:', error)
      },
    },
  )
}

export const useCancelComponentExecution = () => {
  return useMutation(
    async (request: ComponentCancelRequest) => {
      return await ExecutionService.cancelComponent(request)
    },
    {
      onSuccess: (data) => {
        console.log('Component execution cancelled successfully:', data)
      },
      onError: (error: Error) => {
        console.error('Failed to cancel component execution:', error)
      },
    },
  )
}

export default {
  useStreamWorkflowExecution,
  useComponentExecute,
  useStreamAgentExecution,
  useCancelWorkflowExecution,
  useCancelComponentExecution,
}
