/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC } from 'react'
import { Switch } from '@douyinfe/semi-ui'
import { MessageSquare } from 'lucide-react'

import { TestRunForm } from '../testrun-form'
import { TestRunJsonInput } from '../testrun-json-input'
import { NodeStatusGroup } from '../node-status-bar/group'
import { TestRunFormMetaItem } from '../testrun-form/type'

import styles from './index.module.less'

export interface NodeInputPanelProps {
  // 基础属性
  title?: string
  description?: string
  nodeIcon?: React.ReactNode
  nodeIconFallback?: React.ReactNode

  // 表单相关
  values: Record<string, unknown>
  setValues: (values: Record<string, unknown>) => void
  inputFormMeta?: TestRunFormMetaItem[]

  // JSON模式
  inputJSONMode: boolean
  setInputJSONMode: (checked: boolean) => void

  // 中断状态相关
  isInterruptionMode?: boolean
  interruptionMessage?: string

  // 结果展示
  result?: {
    inputs?: any
    outputs?: any
  }

  // 错误信息
  errors?: string[]

  // 样式类名
  className?: string
}

/**
 * 节点输入面板组件
 *
 * 用途：
 * 1. TestRunPanel的普通输入和中断状态
 * 2. TestDebugPanel的单节点测试输入
 * 3. 其他需要节点输入的场景
 */
export const NodeInputPanel: FC<NodeInputPanelProps> = ({
  title = '输入参数',
  description,
  nodeIcon,
  nodeIconFallback = <MessageSquare size={16} className={styles['interruption-icon']} />,
  values,
  setValues,
  inputFormMeta,
  inputJSONMode,
  setInputJSONMode,
  isInterruptionMode = false,
  interruptionMessage = '完成以下输入后，继续执行',
  result,
  errors,
  className,
}) => {
  return (
    <div className={`${styles['node-input-panel']} ${className || ''}`}>
      {/* 输入标题区域 - 使用原始样式类名 */}
      {isInterruptionMode ? (
        <div className={styles['interruption-title']}>
          <span>{interruptionMessage}</span>
        </div>
      ) : (
        <div className={styles['testrun-panel-input']}>
          <div className={styles.title}>{title}</div>
          <div>
            <span style={{ fontSize: '12px', marginRight: 8 }}>JSON 模式</span>
            <Switch checked={inputJSONMode} onChange={setInputJSONMode} size="small" />
          </div>
        </div>
      )}

      {/* 表单区域 */}
      {isInterruptionMode ? (
        // 中断模式：使用原始的容器样式
        <div className={styles['input-interruption-form']}>
          <TestRunForm values={values} setValues={setValues} inputFormMeta={inputFormMeta} />
        </div>
      ) : (
        // 普通模式：直接渲染内容
        <>
          {inputJSONMode ? (
            <TestRunJsonInput values={values} setValues={setValues} inputFormMeta={inputFormMeta} />
          ) : (
            <TestRunForm values={values} setValues={setValues} inputFormMeta={inputFormMeta} />
          )}
        </>
      )}

      {/* 错误信息 - 使用原始样式 */}
      {errors && errors.length > 0 && (
        <>
          {errors.map((error, index) => (
            <div key={index} className={styles.error}>
              {error}
            </div>
          ))}
        </>
      )}

      {/* 输出结果 */}
      {!isInterruptionMode && result && result.outputs && <NodeStatusGroup title="输出" data={result.outputs} optional disableCollapse size="large" />}
    </div>
  )
}
