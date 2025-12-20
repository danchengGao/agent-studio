/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC, useState, useEffect, useRef } from 'react'
import { Button } from '@douyinfe/semi-ui'
import { type PanelFactory, usePanelManager } from '@flowgram.ai/panel-manager-plugin'
import { Loader2, X } from 'lucide-react'

import { NodeInputPanel } from '../node-input-panel'
import { testRunRuntimeService } from '../runtime/testrun-runtime-service'
import { UnifiedExecutionParams } from '../runtime/types'
import { useService } from '@flowgram.ai/free-layout-core'
import { WorkflowDocument } from '@flowgram.ai/free-layout-editor'
import { FlowNodeRegistry } from '../../../typings'
import { useNodeInputMeta } from '../hooks/use-node-input-meta'
import { useExecutionContext } from '../../../context'
import { findNodeRecursively } from '../../../utils'

import styles from './index.module.less'

const lastNodeTestValuesByNodeId = new Map<string, Record<string, unknown>>()

export const clearLastNodeTestValues = () => {
  lastNodeTestValuesByNodeId.clear()
}

// 节点测试数据接口
export interface NodeTestData {
  id: string
  inputs?: Record<string, any>
  space_id?: string
  version?: string
  loop_id?: string
  data?: {
    outputs?: {
      type: string
      properties: Record<string, any>
      required?: string[]
    }
  }
  [key: string]: any
}

// 测试调试面板Props接口 - 与TestRunPanel保持一致
export interface TestDebugPanelProps {
  nodeData: NodeTestData
  workflowId?: string // 新增：工作流ID
  spaceId?: string
}

export const TestDebugPanel: FC<TestDebugPanelProps> = ({
  nodeData,
  workflowId, // 从props接收，与Tools组件一致
  spaceId,
}) => {
  const panelManager = usePanelManager()
  const executionContext = useExecutionContext()

  const [values, setValues] = useState<Record<string, unknown>>({})
  const valuesRef = useRef(values) // 用于跟踪最新的 values，避免闭包陷阱
  const [errors, setErrors] = useState<string[]>()
  const [result, setResult] = useState<any>()
  const [isExecuting, setIsExecuting] = useState(false)

  // 更新 ref 以保持最新的 values
  useEffect(() => {
    valuesRef.current = values
  }, [values])

  const [inputJSONMode, setInputJSONMode] = useState(() => {
    const savedMode = localStorage.getItem('testdebug-input-json-mode')
    return savedMode ? JSON.parse(savedMode) : false
  })

  const handleSetInputJSONMode = (checked: boolean) => {
    setInputJSONMode(checked)
    localStorage.setItem('testdebug-input-json-mode', JSON.stringify(checked))
  }

  const document = useService(WorkflowDocument)

  const inputFormMeta = useNodeInputMeta(nodeData?.id || '')

  const getNodeIcon = () => {
    if (!nodeData?.id) return null

    const node = findNodeRecursively(document.root.blocks, nodeData.id)
    if (!node) return null

    const icon = node.getNodeRegistry<FlowNodeRegistry>()?.info?.icon
    if (!icon) return null

    if (typeof icon === 'string') {
      return <img src={icon} alt="node icon" width={16} height={16} />
    } else {
      return <span>{icon}</span>
    }
  }

  const resetTest = () => {
    const nodeId = nodeData?.id
    if (nodeId && lastNodeTestValuesByNodeId.has(nodeId)) {
      const lastValues = lastNodeTestValuesByNodeId.get(nodeId)
      setValues(lastValues || {})
    } else {
      const preservedValues: Record<string, unknown> = {}
      inputFormMeta.forEach(meta => {
        if (meta.defaultValue !== undefined) {
          preservedValues[meta.name] = meta.defaultValue
        }
      })
      setValues(preservedValues)
    }
    setErrors(undefined)
    setResult(undefined)
  }

  // 取消执行
  const handleCancel = () => {
    if (nodeData?.id) {
      testRunRuntimeService.cancelSingleComponent(nodeData.id)
    }
    executionContext.clearExecution()
    // 不清空所有节点状态，让取消状态保持在NodeStatusBar中显示
    setIsExecuting(false)
  }

  // 关闭面板
  const handleClose = () => {
    if (isExecuting) {
      handleCancel()
    }
    if (nodeData?.id) {
      lastNodeTestValuesByNodeId.set(nodeData.id, valuesRef.current)
    }
    panelManager.close(testDebugPanelFactory.key)
  }

  const handleTestRun = async () => {
    const currentValues = valuesRef.current

    if (!nodeData) {
      setErrors(['节点数据未加载'])
      return
    }

    const finalSpaceId = nodeData.space_id || spaceId
    const finalVersion = nodeData.version || ''

    if (!finalSpaceId) {
      setErrors(['缺少空间ID，请确保工作空间信息正确'])
      return
    }

    if (!nodeData.id) {
      setErrors(['缺少节点ID，请重新选择节点'])
      return
    }

    setIsExecuting(true)
    setErrors(undefined)
    setResult(undefined)

    testRunRuntimeService.stopStreamExecution()
    executionContext.clearExecution()

    try {
      const params: UnifiedExecutionParams = {
        id: workflowId || '',
        version: finalVersion,
        space_id: finalSpaceId,
        inputs: currentValues, // 使用最新的 values
        component_id: nodeData.id,
        loop_id: nodeData.loop_id,
      }

      const paramsWithOptions = {
        ...params,
        options: {
          statusManagement: {
            clearBeforeStart: true,
            triggerNodeStatus: true,
            triggerGlobalReset: false,
          },
          eventHandling: {
            enableNodeReport: true,
            enableProgressTracking: true,
            enableResultBroadcast: true,
          },
          mode: 'single-node',
        },
      }

      const response = await testRunRuntimeService.execute(paramsWithOptions)

      if (nodeData?.id) {
        lastNodeTestValuesByNodeId.set(nodeData.id, currentValues)
      }

      if (response.code === 200) {
        let outputData = null

        if (response.data?.payload?.output) {
          outputData = response.data.payload.output
        } else if (response.data?.output?.result) {
          outputData = response.data.output.result
        } else if (response.data?.output) {
          outputData = response.data.output
        } else if (response.data) {
          outputData = response.data
        }

        setResult(outputData)
      } else {
        setErrors([response.message])
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '执行过程中发生未知错误'
      setErrors([errorMessage])
    } finally {
      setIsExecuting(false)
    }
  }

  useEffect(() => {
    testRunRuntimeService.clearAllNodeStatuses()

    if (nodeData) {
      resetTest()
    }
  }, [nodeData?.id])

  useEffect(() => {
    if (!nodeData?.id) return
    lastNodeTestValuesByNodeId.set(nodeData.id, values)
  }, [values, nodeData?.id])

  const renderRunning = (
    <div className={styles['testrun-panel-running']}>
      <Loader2 className="animate-spin" size={32} />
      <div className={styles.text}>运行中...</div>
    </div>
  )

  const renderForm = (
    <div className={styles['testrun-panel-form']}>
      <NodeInputPanel
        nodeIcon={getNodeIcon()}
        values={values}
        setValues={setValues}
        inputFormMeta={inputFormMeta}
        inputJSONMode={inputJSONMode}
        setInputJSONMode={handleSetInputJSONMode}
        isInterruptionMode={false} // 修改为非中断模式，确保能显示输出结果
        interruptionMessage="完成以下输入后，继续试运行"
        result={
          result
            ? {
                inputs: result.inputs,
                outputs: result.output,
              }
            : undefined
        }
        errors={errors}
      />
    </div>
  )

  const renderButton = isExecuting ? (
    <Button onClick={handleCancel} className={`${styles.button} ${styles.running}`}>
      取消
    </Button>
  ) : (
    <Button onClick={handleTestRun} className={`${styles.button} ${styles.save}`}>
      运行
    </Button>
  )

  const renderHeader = (
    <div className={styles['testrun-panel-header']}>
      <div className={styles['testrun-panel-title']}>试运行</div>
      <Button className={styles['testrun-panel-title']} type="tertiary" size="small" theme="borderless" onClick={handleClose}>
        <X size={16} className={styles['text-gray-600']} />
      </Button>
    </div>
  )

  return (
    <div className={styles['testrun-panel-container']}>
      {renderHeader}
      <div className={styles['testrun-panel-content']}>{isExecuting ? renderRunning : renderForm}</div>
      <div className={styles['testrun-panel-footer']}>{renderButton}</div>
    </div>
  )
}

// 面板工厂函数，用于与PanelManager集成
export const testDebugPanelFactory: PanelFactory<TestDebugPanelProps> = {
  key: 'test-debug-panel',
  defaultSize: 400,
  render: props => <TestDebugPanel {...props} />,
}
