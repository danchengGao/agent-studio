/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC, useState, useEffect, useMemo, useCallback } from 'react'

import classnames from 'classnames'
import { type PanelFactory, usePanelManager } from '@flowgram.ai/panel-manager-plugin'
import { Button } from '@douyinfe/semi-ui'
import { X, Loader2, MessageSquare } from 'lucide-react'

import { NodeInputPanel } from '../node-input-panel'
import { testRunRuntimeService } from '../runtime/testrun-runtime-service'
import { StreamResponse } from '../runtime/types'
import { useExecutionContext } from '../../../context'
import { useFormMeta } from '../hooks/use-form-meta'
import { useService } from '@flowgram.ai/free-layout-core'
import { WorkflowDocument } from '@flowgram.ai/free-layout-editor'
import { findNodeRecursively } from '../../../utils'
import { parseInteractionMsgToFormMeta } from '../utils/parseInteractionMsg'
import { useStreamMessages, useInputInterruption, useFormValidation } from '../shared'

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

  const { messages, handleStreamEvent: handleStreamMessageEvent, clearMessages, setRef } = useStreamMessages()
  const { interruption, inputValues, setInputValues, handleInputRequired, resume: resumeInput, clear: clearInterruption } = useInputInterruption()
  const { validate: validateForm } = useFormValidation()

  const formMeta = useFormMeta()

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
        clearInterruption()
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
  }, [clearInterruption])

  useEffect(() => {
    return () => {
      testRunRuntimeService.resetAllExecutionStates()
    }
  }, [])

  const interruptionNodeIcon = useMemo(() => {
    const nodeId = interruption?.nodeId
    if (!nodeId) return null

    const node = findNodeRecursively(document.root.blocks, nodeId)
    if (!node) return null

    const registry = node.getNodeRegistry()
    const icon = registry?.info?.icon
    if (!icon) return <MessageSquare size={16} className={styles['interruption-icon']} />

    if (typeof icon === 'string') {
      return <img src={icon} alt="node icon" width={16} height={16} className={styles['interruption-icon']} />
    } else {
      return <span className={styles['interruption-icon']}>{icon}</span>
    }
  }, [interruption?.nodeId, document.root.blocks])

  const interruptionFormMeta = useMemo(() => {
    return interruption ? parseInteractionMsgToFormMeta(interruption.message) : undefined
  }, [interruption?.message])

  const getNodeDisplayName = useCallback(
    (nodeId: string): string => {
      const streamData = messages.get(nodeId)
      if (streamData?.nodeName) return streamData.nodeName

      const node = findNodeRecursively(document.root.blocks, nodeId)
      if (!node) return nodeId

      const registry = node.getNodeRegistry()
      return registry?.info?.title || registry?.info?.name || nodeId
    },
    [document.root.blocks, messages],
  )

  const handleStreamEvent = useCallback(
    (event: StreamResponse) => {
      handleStreamMessageEvent(event)

      switch (event.type) {
        case 'input_required':
          handleInputRequired(event.data)
          setIsStreamExecuting(false)
          break
        case 'completed':
          setIsStreamExecuting(false)
          setResult({
            inputs: event.data.inputs,
            outputs: event.data.outputs,
          })
          break
        case 'error':
          setIsStreamExecuting(false)
          {
            const errorMessage = event.data.message || 'Execution error'
            const isUserCanceled = event.data.isUserCanceled || errorMessage === 'canceled by user'
            const nodeId = event.data.nodeId

            if (!isUserCanceled) {
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
      }
    },
    [handleStreamMessageEvent, handleInputRequired],
  )

  const onTestRun = async () => {
    if (isStreamExecuting) {
      testRunRuntimeService.stopStreamExecution()
      setIsStreamExecuting(false)
      clearMessages()
      return
    }

    if (!workflowId || !spaceId) {
      setErrors(['Missing workflowId or spaceId for execution'])
      return
    }

    const validationErrors = validateForm(values, formMeta)
    if (validationErrors) {
      setErrors(validationErrors)
      return
    }

    lastTestRunValues = values

    setResult(undefined)
    setErrors(undefined)
    clearInterruption()
    clearMessages()

    setIsStreamExecuting(true)
    executionContext.clearExecution()
    testRunRuntimeService.clearAllNodeStatuses()

    try {
      const params = {
        id: workflowId,
        version: '',
        space_id: spaceId,
        inputs: values,
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
          mode: 'workflow' as const,
        },
      }

      await testRunRuntimeService.execute(params, handleStreamEvent)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Execution failed'])
      setIsStreamExecuting(false)
      testRunRuntimeService.clearAllNodeStatuses()
    }
  }

  const handleInputResume = async () => {
    const metaForValidation = interruptionFormMeta || []
    const validationErrors = validateForm(inputValues, metaForValidation)

    if (validationErrors) {
      setErrors(validationErrors)
      return
    }

    setIsStreamExecuting(true)
    setErrors(undefined)

    const success = await resumeInput(inputValues)
    if (!success) {
      setIsStreamExecuting(false)
    }
  }

  const onClose = async () => {
    testRunRuntimeService.stopStreamExecution()
    testRunRuntimeService.resetAllExecutionStates()
    setValues({})
    setInputValues({})
    setIsStreamExecuting(false)
    clearInterruption()
    clearMessages()
    panelManager.close(testRunPanelFactory.key)
  }

  const renderRunning = (
    <div className={styles['testrun-panel-running']}>
      <div className={styles['running-header']}>
        <Loader2 className="animate-spin" size={20} />
        <div className={styles.text}>运行中...</div>
      </div>
      {messages.size > 0 && (
        <div className={styles['stream-messages-container']}>
          {Array.from(messages.entries()).map(([nodeId, data]) => (
            <div key={nodeId} className={styles['node-message-container']}>
              <div className={styles['node-message-header']}>{getNodeDisplayName(nodeId)}</div>
              <div ref={el => setRef(nodeId, el)} className={styles['node-message-textarea']}>
                {data.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderForm = (
    <div className={styles['testrun-panel-form']}>
      <NodeInputPanel
        title={interruption ? undefined : '试运行输入'}
        nodeIcon={interruption ? interruptionNodeIcon : undefined}
        nodeIconFallback={<MessageSquare size={16} className={styles['interruption-icon']} />}
        values={interruption ? inputValues : values}
        setValues={interruption ? setInputValues : setValues}
        inputFormMeta={interruptionFormMeta}
        inputJSONMode={interruption ? false : inputJSONMode}
        setInputJSONMode={interruption ? () => {} : setInputJSONMode}
        isInterruptionMode={!!interruption}
        interruptionMessage="完成以下输入后，继续试运行"
        result={result}
        errors={errors}
      />
    </div>
  )

  const renderButton = interruption ? (
    <Button onClick={handleInputResume} className={classnames(styles.button, styles.save)}>
      继续运行
    </Button>
  ) : (
    <Button
      onClick={onTestRun}
      className={classnames(styles.button, {
        [styles.running]: isStreamExecuting,
        [styles.default]: !isStreamExecuting,
      })}
    >
      {isStreamExecuting ? '取消' : '运行'}
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
