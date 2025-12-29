/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC, useCallback } from 'react'
import { type PanelFactory, usePanelManager } from '@flowgram.ai/panel-manager-plugin'
import { Button } from '@douyinfe/semi-ui'
import { X, AlertTriangle } from 'lucide-react'

import { NodeValidationErrorPanelProps } from './types'
import { ValidationErrorList } from './validation-error-list'
import styles from './styles/index.module.less'
import { testRunRuntimeService } from '../testrun/runtime/testrun-runtime-service'
import { useTranslation } from '../../i18n'

export const NodeValidationErrorPanel: FC<NodeValidationErrorPanelProps> = ({ errors, onNodeSelect, onFixAll, onDismiss }) => {
  const { t } = useTranslation()
  const panelManager = usePanelManager()

  const handleClose = useCallback(() => {
    panelManager.close(nodeValidationErrorPanelFactory.key)
    onDismiss?.()
  }, [panelManager, onDismiss])

  const errorCount = errors.filter(e => e.severity === 'error').length
  const warningCount = errors.filter(e => e.severity === 'warning').length

  return (
    <div className={styles['validation-error-panel']}>
      <div className={styles['validation-error-header']}>
        <div className={styles['validation-error-title']}>
          <AlertTriangle size={20} className={styles['error-icon']} />
          <span>{t('workflowCanvas.validation.nodeValidationError')}</span>
          <div className={styles['validation-error-count']}>
            {errorCount > 0 && <span className={styles['error-count']}>{errorCount} {t('workflowCanvas.validation.error')}</span>}
            {warningCount > 0 && <span className={styles['warning-count']}>{warningCount} {t('workflowCanvas.validation.warning')}</span>}
          </div>
        </div>
        <div className={styles['validation-error-actions']}>
          {onFixAll && errors.length > 0 && (
            <Button size="small" type="secondary" onClick={onFixAll}>
              {t('workflowCanvas.validation.fixAll')}
            </Button>
          )}
          <Button size="small" type="tertiary" theme="borderless" onClick={handleClose}>
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className={styles['validation-error-content']}>
        <ValidationErrorList
          errors={errors}
          onNodeSelect={nodeId => {
            onNodeSelect?.(nodeId)
            if (!testRunRuntimeService.getIsRunning()) {
              panelManager.open('node-form-panel', 'right', {
                props: { nodeId },
              })
            }
          }}
        />
      </div>
    </div>
  )
}

export const nodeValidationErrorPanelFactory: PanelFactory<NodeValidationErrorPanelProps> = {
  key: 'node-validation-error-panel',
  defaultSize: 300,
  render: props => <NodeValidationErrorPanel {...props} />,
}
