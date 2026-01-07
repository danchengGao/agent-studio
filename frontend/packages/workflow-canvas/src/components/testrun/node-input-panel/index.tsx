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
import { useTranslation } from '../../../i18n'

import styles from './index.module.less'

export interface NodeInputPanelProps {
  // Basic properties
  title?: string
  description?: string
  nodeIcon?: React.ReactNode
  nodeIconFallback?: React.ReactNode

  // Form related
  values: Record<string, unknown>
  setValues: (values: Record<string, unknown>) => void
  inputFormMeta?: TestRunFormMetaItem[]

  // JSON mode
  inputJSONMode: boolean
  setInputJSONMode: (checked: boolean) => void

  // Interruption state related
  isInterruptionMode?: boolean
  interruptionMessage?: string

  // Result display
  result?: {
    inputs?: any
    outputs?: any
  }

  // Error messages
  errors?: string[]

  // Style class names
  className?: string
}

/**
 * Node input panel component
 *
 * Usage:
 * 1. Normal input and interruption state for TestRunPanel
 * 2. Single node test input for TestDebugPanel
 * 3. Other scenarios requiring node input
 */
export const NodeInputPanel: FC<NodeInputPanelProps> = ({
  title,
  description,
  nodeIcon,
  nodeIconFallback = <MessageSquare size={16} className={styles['interruption-icon']} />,
  values,
  setValues,
  inputFormMeta,
  inputJSONMode,
  setInputJSONMode,
  isInterruptionMode = false,
  interruptionMessage,
  result,
  errors,
  className,
}) => {
  const { t } = useTranslation()
  return (
    <div className={`${styles['node-input-panel']} ${className || ''}`}>
      {/* Input title area - Use original style class names */}
      {isInterruptionMode ? (
        <div className={styles['interruption-title']}>
          <span>{interruptionMessage || t('workflowCanvas.nodeInputPanel.completeInputToContinue')}</span>
        </div>
      ) : (
        <div className={styles['testrun-panel-input']}>
          <div className={styles.title}>{title || t('workflowCanvas.nodeInputPanel.inputParams')}</div>
          <div>
            <span style={{ fontSize: '12px', marginRight: 8 }}>{t('workflowCanvas.nodeInputPanel.jsonMode')}</span>
            <Switch checked={inputJSONMode} onChange={setInputJSONMode} size="small" />
          </div>
        </div>
      )}

      {/* Form area */}
      {isInterruptionMode ? (
        // Interruption mode: Use original container style
        <div className={styles['input-interruption-form']}>
          <TestRunForm values={values} setValues={setValues} inputFormMeta={inputFormMeta} />
        </div>
      ) : (
        // Normal mode: Render content directly
        <>
          {inputJSONMode ? (
            <TestRunJsonInput values={values} setValues={setValues} inputFormMeta={inputFormMeta} />
          ) : (
            <TestRunForm values={values} setValues={setValues} inputFormMeta={inputFormMeta} />
          )}
        </>
      )}

      {/* Error messages - Use original styles */}
      {errors && errors.length > 0 && (
        <>
          {errors.map((error, index) => (
            <div key={index} className={styles.error}>
              {error}
            </div>
          ))}
        </>
      )}

      {/* Output result */}
      {!isInterruptionMode && result && result.outputs && <NodeStatusGroup title={t('workflowCanvas.nodeInputPanel.output')} data={result.outputs} optional disableCollapse size="large" />}
    </div>
  )
}
