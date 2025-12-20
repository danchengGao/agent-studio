/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC, useState, useEffect, useRef, useMemo, useCallback } from 'react'

import classnames from 'classnames'
import { type PanelFactory, usePanelManager } from '@flowgram.ai/panel-manager-plugin'
import { Button } from '@douyinfe/semi-ui'
import { X, Loader2, MessageSquare } from 'lucide-react'

import { NodeInputPanel } from '../node-input-panel'
import { testRunRuntimeService } from '../runtime/testrun-runtime-service'
import { InputInterruption, type StreamResponse, UnifiedExecutionParams } from '../runtime/types'
import { useExecutionContext } from '../../../context'
import { useInputFormMeta } from '../hooks/use-input-form-meta'
import { useFormMeta } from '../hooks/use-form-meta'
import type { TestRunFormMetaItem } from '../testrun-form/type'
import { useService } from '@flowgram.ai/free-layout-core'
import { WorkflowDocument } from '@flowgram.ai/free-layout-editor'
import { FlowNodeRegistry } from '../../../typings'
import { WorkflowNodeType } from '../../../nodes/constants'
import { validateRequiredFields, validateBasicTypes } from '../utils/validation'
import { findNodeRecursively } from '../../../utils'

import styles from './index.module.less'

let lastTestRunValues: Record<string, unknown> | undefined

export const clearLastTestRunValues = () => {
  lastTestRunValues = undefined
}

interface TestRunSidePanelProps {
  workflowId?: string
  spaceId?: string
}

export const TestRunSidePanel: FC<TestRunSidePanelProps> = ({ workflowId, spaceId }) => {
  const panelManager = usePanelManager()
  const executionContext = useExecutionContext()
  const document = useService(WorkflowDocument)

  const [values, setValues] = useState<Record<string, unknown>>(() => lastTestRunValues || {})
  const [errors, setErrors] = useState<string[]>()
  const [result, setResult] = useState<
    | {
        inputs: Record<string, any>
        outputs: Record<string, any>
      }
    | undefined
  >()

  const [isStreamExecuting, setIsStreamExecuting] = useState(false)
  const [executionInstances, setExecutionInstances] = useState<Map<string, { startTime: number; status: string }>>(new Map())
  const [inputInterruption, setInputInterruption] = useState<InputInterruption | null>(null)
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({})
  const [streamMessages, setStreamMessages] = useState<Map<string, { message: string; nodeName: string }>>(new Map())
  const streamMessageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const inputFormMeta = useInputFormMeta(inputInterruption?.nodeId ?? '')

  const isSimpleStringMsg = useCallback((raw: any): boolean => {
    if (typeof raw !== 'string') return false
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return false
      if (parsed && typeof parsed === 'object') return false
      return true
    } catch {
      return true
    }
  }, [])

  const parseInteractionMsgToFormMeta = useCallback((msg: any): TestRunFormMetaItem[] => {
    const normalizeType = (t?: string): TestRunFormMetaItem['type'] => {
      const s = String(t || '').toLowerCase()
      if (s.includes('boolean')) return 'boolean'
      if (s.includes('integer')) return 'integer'
      if (s.includes('number')) return 'number'
      if (s.includes('array')) return 'array'
      if (s.includes('object')) return 'object'
      return 'string'
    }

    const items: TestRunFormMetaItem[] = []

    if (!msg) return items

    if (Array.isArray(msg)) {
      for (const f of msg) {
        const name = String(f?.input_name || f?.name || f?.label || '').trim()
        if (!name) continue
        items.push({
          name,
          type: normalizeType(f?.type),
          defaultValue: f?.default ?? '',
          required: Boolean(f?.required),
          itemsType: undefined,
        })
      }
      return items
    }

    if (typeof msg === 'string') {
      const name = msg.trim() || 'input'
      items.push({ name, type: 'string', defaultValue: '', required: false })
      return items
    }

    if (msg && typeof msg === 'object') {
      if (msg.properties && typeof msg.properties === 'object') {
        const requiredArr: string[] = Array.isArray(msg.required) ? msg.required : []
        for (const [name, prop] of Object.entries<any>(msg.properties)) {
          const type = normalizeType(prop?.type)
          const itemsType = prop?.items?.type ? normalizeType(prop.items.type) : undefined
          items.push({
            name,
            type,
            itemsType,
            defaultValue: prop?.default ?? '',
            required: requiredArr.includes(name),
          })
        }
        return items
      }

      for (const [name, val] of Object.entries<any>(msg)) {
        const type = typeof val === 'string' ? normalizeType(val) : normalizeType(val?.type)
        items.push({ name, type, defaultValue: '', required: false })
      }
      return items
    }

    return items
  }, [])

  useEffect(() => {
    streamMessages.forEach((_, nodeId) => {
      const ref = streamMessageRefs.current.get(nodeId)
      if (ref) {
        ref.scrollTop = ref.scrollHeight
      }
    })
  }, [streamMessages])

  const formMeta = useFormMeta()

  const interruptionNodeIcon = useMemo(() => {
    const nodeId = inputInterruption?.nodeId
    if (!nodeId) return null

    const node = findNodeRecursively(document.root.blocks, nodeId)
    if (!node) return null

    const icon = node.getNodeRegistry<FlowNodeRegistry>()?.info?.icon
    if (!icon) return <MessageSquare size={16} className={styles['interruption-icon']} />

    if (typeof icon === 'string') {
      return <img src={icon} alt="node icon" width={16} height={16} className={styles['interruption-icon']} />
    } else {
      return <span className={styles['interruption-icon']}>{icon}</span>
    }
  }, [inputInterruption?.nodeId, document.root.blocks])

  const [inputJSONMode, _setInputJSONMode] = useState(() => {
    const savedMode = localStorage.getItem('testrun-input-json-mode')
    return savedMode ? JSON.parse(savedMode) : false
  })

  const setInputJSONMode = (checked: boolean) => {
    _setInputJSONMode(checked)
    localStorage.setItem('testrun-input-json-mode', JSON.stringify(checked))
  }

  useEffect(() => {
    testRunRuntimeService.clearAllNodeStatuses()

    const resultDisposer = testRunRuntimeService.onResultChanged(event => {
      if (event.result) {
        setResult(event.result)
        setIsStreamExecuting(false)
        setErrors(undefined)
      } else if (event.errors) {
        const isUserCanceled = event.errors.length > 0 && event.errors[0] === 'canceled by user'

        if (isUserCanceled) {
          setErrors(event.errors)
          setIsStreamExecuting(false)
          setResult(undefined)
        } else {
          setErrors(event.errors)
          setIsStreamExecuting(false)
          setResult(undefined)
          testRunRuntimeService.clearAllNodeStatuses()
        }
      }
    })

    return () => {
      resultDisposer?.dispose()
    }
  }, [])

  useEffect(() => {
    return () => {
      testRunRuntimeService.resetAllExecutionStates()
    }
  }, [])

  const onTestRun = async () => {
    if (isStreamExecuting) {
      testRunRuntimeService.stopStreamExecution()
      setIsStreamExecuting(false)
      setExecutionInstances(new Map())
      return
    }

    if (!workflowId || !spaceId) {
      setErrors(['Missing workflowId or spaceId for execution'])
      return
    }

    const missingRequired = validateRequiredFields(values, formMeta)
    if (missingRequired.length > 0) {
      setErrors([`请填写必填字段: ${missingRequired.join(', ')}`])
      return
    }

    // 验证输入参数类型是否正确
    const typeValidationErrors = validateBasicTypes(values, formMeta)
    if (typeValidationErrors.length > 0) {
      setErrors(typeValidationErrors)
      return
    }

    lastTestRunValues = values

    setResult(undefined)
    setErrors(undefined)
    setInputInterruption(null)
    setStreamMessages(new Map())

    const executionId = `testrun-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    setExecutionInstances(prev =>
      new Map(prev).set(executionId, {
        startTime: Date.now(),
        status: 'running',
      }),
    )

    setIsStreamExecuting(true)

    executionContext.clearExecution()

    testRunRuntimeService.clearAllNodeStatuses()

    try {
      const params: UnifiedExecutionParams = {
        id: workflowId,
        version: '',
        space_id: spaceId,
        inputs: values,
        conversation_id: '',
        options: {
          statusManagement: {
            clearBeforeStart: false,
            triggerNodeStatus: true,
            triggerGlobalReset: false,
          },
          eventHandling: {
            enableNodeReport: true,
            enableProgressTracking: true,
            enableResultBroadcast: true,
          },
          mode: 'workflow',
        },
      }

      await testRunRuntimeService.execute(params, event => {
        handleStreamEvent(event)
      })
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Execution failed'])
      setIsStreamExecuting(false)

      setExecutionInstances(prev => {
        const newMap = new Map(prev)
        newMap.delete(executionId)
        return newMap
      })

      testRunRuntimeService.clearAllNodeStatuses()
    }
  }

  const handleStreamEvent = (event: StreamResponse) => {
    switch (event.type) {
      case 'input_required':
        setInputInterruption(event.data)
        setIsStreamExecuting(false)
        break
      case 'completed':
        setIsStreamExecuting(false)
        setResult({
          inputs: event.data.inputs,
          outputs: event.data.outputs,
        })
        setStreamMessages(new Map())
        break
      case 'error':
        setIsStreamExecuting(false)
        setStreamMessages(new Map())
        {
          const errorMessage = event.data.message || 'Execution error'
          const isUserCanceled = event.data.isUserCanceled || errorMessage === 'canceled by user'
          const nodeId = event.data.nodeId

          if (isUserCanceled) {
            setResult({
              inputs: {},
              outputs: { cancel: 'canceled by user' },
            })
            if (nodeId && nodeId !== 'workflow') {
              testRunRuntimeService.cancelSingleComponent(nodeId)
            }
          } else {
            setErrors([errorMessage])

            const isWorkflowLevelError = nodeId && nodeId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

            if (isWorkflowLevelError) {
              const runningNodes = testRunRuntimeService.getRunningNodes()

              if (runningNodes.length > 0) {
                const lastRunningNode = runningNodes[runningNodes.length - 1]
                testRunRuntimeService.setNodeFailedStatus(lastRunningNode, errorMessage)
              }
            } else if (nodeId) {
              testRunRuntimeService.setNodeFailedStatus(nodeId, errorMessage)
            }
          }
        }
        break
      case 'stream_message':
        if (event.data) {
          if (event.data.type === 'workflow' && event.data.payload?.node_id) {
            const nodeId = event.data.payload.node_id
            const nodeName = event.data.payload.node_name || event.data.payload.node_id
            const output = event.data.payload.output || ''

            setStreamMessages(prev => {
              const newMap = new Map(prev)
              const currentData = newMap.get(nodeId) || { message: '', nodeName }
              newMap.set(nodeId, {
                message: currentData.message + output,
                nodeName: nodeName,
              })
              return newMap
            })
          }
        }
        break
    }
  }

  const handleInputResume = async () => {
    if (!inputInterruption) return

    const isQ = isQuestionerInterruption(inputInterruption.nodeId)
    if (isQ) {
      if (isSimpleStringMsg(inputInterruption.message)) {
        const msgName = typeof inputInterruption.message === 'string' ? inputInterruption.message.trim() || 'input' : 'input'
        const v = (inputValues as any)[msgName] ?? (inputValues as any)['input'] ?? ''
        if (!String(v).trim()) {
          setErrors([`请填写必填字段: ${msgName}`])
          return
        }
      }
    } else {
      const metaForValidation = normalizedInterruptionFormMeta || []
      const missingRequired = validateRequiredFields(inputValues, metaForValidation)
      if (missingRequired.length > 0) {
        setErrors([`请填写必填字段: ${missingRequired.join(', ')}`])
        return
      }

      // 验证输入参数类型是否正确
      const typeValidationErrors = validateBasicTypes(inputValues, metaForValidation)
      if (typeValidationErrors.length > 0) {
        setErrors(typeValidationErrors)
        return
      }
    }

    try {
      const simple = isSimpleStringMsg(inputInterruption.message)
      let payload: any = inputValues
      if (simple) {
        const msgName = typeof inputInterruption.message === 'string' ? inputInterruption.message.trim() || 'input' : 'input'
        const v = (inputValues as any)[msgName] ?? (inputValues as any)['input'] ?? ''
        payload = v
      }
      await testRunRuntimeService.resumeStreamExecution({
        node_id: inputInterruption.nodeId,
        input_value: payload,
      })
      setInputInterruption(null)
      setIsStreamExecuting(true)
      setInputValues({})
      setErrors(undefined)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Resume execution failed'])
    }
  }

  const onClose = async () => {
    testRunRuntimeService.stopStreamExecution()
    testRunRuntimeService.resetAllExecutionStates()
    setValues({})
    setInputValues({})
    setIsStreamExecuting(false)
    setInputInterruption(null)
    setStreamMessages(new Map())
    panelManager.close(testRunPanelFactory.key)
  }

  const getNodeDisplayName = useCallback(
    (nodeId: string): string => {
      const streamData = streamMessages.get(nodeId)
      if (streamData?.nodeName) return streamData.nodeName

      // 回退到查找节点注册表中的名称
      const node = findNodeRecursively(document.root.blocks, nodeId)
      if (!node) return nodeId

      const registry = node.getNodeRegistry<FlowNodeRegistry>()
      return registry?.info?.title || registry?.info?.name || nodeId
    },
    [document.root.blocks, streamMessages],
  )

  const renderRunning = (
    <div className={styles['testrun-panel-running']}>
      <div className={styles['running-header']}>
        <Loader2 className="animate-spin" size={20} />
        <div className={styles.text}>运行中...</div>
      </div>
      {streamMessages.size > 0 && (
        <div className={styles['stream-messages-container']}>
          {Array.from(streamMessages.entries()).map(([nodeId, data]) => (
            <div key={nodeId} className={styles['node-message-container']}>
              <div className={styles['node-message-header']}>{getNodeDisplayName(nodeId)}</div>
              <div
                ref={el => {
                  if (el) {
                    streamMessageRefs.current.set(nodeId, el)
                  }
                }}
                className={styles['node-message-textarea']}
              >
                {data.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const effectiveInputFormMeta: TestRunFormMetaItem[] | undefined = useMemo(() => {
    if (!inputInterruption) return undefined

    if (isSimpleStringMsg(inputInterruption.message)) {
      return parseInteractionMsgToFormMeta(inputInterruption.message)
    }

    return inputFormMeta && inputFormMeta.length > 0 ? inputFormMeta : parseInteractionMsgToFormMeta(inputInterruption.message)
  }, [inputInterruption, inputFormMeta])

  const isQuestionerInterruption = useCallback(
    (nodeId?: string): boolean => {
      if (!nodeId) return false
      const node = findNodeRecursively(document.root.blocks, nodeId)
      const n = node as { getNodeRegistry?: () => unknown; type?: string; data?: { type?: string } } | null
      const registry = n?.getNodeRegistry?.()
      const type = (registry as Partial<FlowNodeRegistry>)?.type ?? n?.type ?? n?.data?.type
      return type === WorkflowNodeType.Questioner
    },
    [document.root.blocks],
  )

  const normalizedInterruptionFormMeta: TestRunFormMetaItem[] | undefined = useMemo(() => {
    if (!effectiveInputFormMeta) return undefined

    const isQ = isQuestionerInterruption(inputInterruption?.nodeId)
    if (!isQ) return effectiveInputFormMeta

    const isSimple = isSimpleStringMsg(inputInterruption?.message)
    return effectiveInputFormMeta.map(i => ({ ...i, required: isSimple }))
  }, [effectiveInputFormMeta, inputInterruption?.nodeId, inputInterruption?.message, isQuestionerInterruption])

  const renderForm = (
    <div className={styles['testrun-panel-form']}>
      <NodeInputPanel
        title={inputInterruption ? undefined : '试运行输入'}
        nodeIcon={inputInterruption ? interruptionNodeIcon : undefined}
        nodeIconFallback={<MessageSquare size={16} className={styles['interruption-icon']} />}
        values={inputInterruption ? inputValues : values}
        setValues={inputInterruption ? setInputValues : setValues}
        inputFormMeta={normalizedInterruptionFormMeta}
        inputJSONMode={inputInterruption ? false : inputJSONMode}
        setInputJSONMode={inputInterruption ? undefined : setInputJSONMode}
        isInterruptionMode={!!inputInterruption}
        interruptionMessage="完成以下输入后，继续试运行"
        result={result}
        errors={errors}
      />
    </div>
  )

  const renderButton = inputInterruption ? (
    <Button onClick={handleInputResume} className={classnames(styles.button, styles.save)}>
      继续运行
    </Button>
  ) : (
    <Button
      onClick={onTestRun}
      disabled={isStreamExecuting}
      className={classnames(styles.button, {
        [styles.running]: isStreamExecuting,
        [styles.default]: !isStreamExecuting,
      })}
    >
      {isStreamExecuting ? <>取消</> : <>运行</>}
    </Button>
  )

  const renderHeader = (
    <div className={styles['testrun-panel-header']}>
      <div className={styles['testrun-panel-title']}>试运行</div>
      <Button className={styles['testrun-panel-title']} type="tertiary" size="small" theme="borderless" onClick={onClose}>
        <X size={16} className={`${styles['text-gray-600']} ${styles['hover:text-red-6']}`} />
      </Button>
    </div>
  )

  return (
    <div className={styles['testrun-panel-container']}>
      {renderHeader}
      <div className={styles['testrun-panel-content']}>{isStreamExecuting ? renderRunning : renderForm}</div>
      <div className={styles['testrun-panel-footer']}>{renderButton}</div>
    </div>
  )
}

export const testRunPanelFactory: PanelFactory<TestRunSidePanelProps> = {
  key: 'test-run-panel',
  defaultSize: 400,
  render: props => <TestRunSidePanel {...props} />,
}
