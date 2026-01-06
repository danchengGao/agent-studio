/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState, useCallback } from 'react'

import { usePanelManager } from '@flowgram.ai/panel-manager-plugin'
import { useClientContext } from '@flowgram.ai/free-layout-editor'
import { Button, Badge } from '@douyinfe/semi-ui'
import { Play } from 'lucide-react'

import { testRunPanelFactory } from '../testrun-panel'
import { testRunRuntimeService } from '../runtime/testrun-runtime-service'
import { useValidationStatus } from '../../../hooks'
import { useTranslation } from '../../../i18n'
import { useWorkflowStore } from '../../../stores/useWorkflowStore'

import styles from './index.module.less'

export function TestRunButton(props: { disabled: boolean; workflowId?: string; spaceId?: string }) {
  const { t } = useTranslation()
  const [isSaving, setIsSaving] = useState(false)
  const clientContext = useClientContext()
  const panelManager = usePanelManager()
  const { hasValidationErrors, validationErrors, validateAndReturnErrors, showErrorPanel } = useValidationStatus()
  const selectedVersion = useWorkflowStore(s => s.selectedVersion)

  const onTestRun = useCallback(async () => {
    try {
      setIsSaving(true)

      const validationResult = await validateAndReturnErrors(true, true)

      if (validationResult.hasErrors) {
        return
      }

      const workflowData = clientContext.document.toJSON()

      if (props.workflowId && props.spaceId) {
        const viewingVersion = selectedVersion
        if (viewingVersion && viewingVersion !== 'draft') {
          console.log('Skip test run save: viewing history version ->', viewingVersion)
        } else {
          try {
            await testRunRuntimeService.saveWorkflow({
              workflow_id: props.workflowId,
              version: '',
              space_id: props.spaceId,
              schema: JSON.stringify(workflowData),
            })
          } catch (saveError) {
          }
        }
      }

      panelManager.open(testRunPanelFactory.key, 'right', {
        props: {
          workflowId: props.workflowId,
          spaceId: props.spaceId,
        },
      })
    } finally {
      setIsSaving(false)
    }
  }, [clientContext, panelManager, props.workflowId, props.spaceId, validateAndReturnErrors, selectedVersion])

  const errorCount = validationErrors.length
  const isDisabled = props.disabled || isSaving

  const handleButtonClick = () => {
    if (errorCount > 0) {
      showErrorPanel()
    }
    onTestRun()
  }

  return (
    <>
      {errorCount === 0 ? (
        <Button disabled={isDisabled} loading={isSaving} onClick={onTestRun} className={styles.testrunSuccessButton}>
          <Play size={16} className={styles['mr-2']} />
          {isSaving ? t('workflowCanvas.testrun.saving') : t('workflowCanvas.testrun.testRun')}
        </Button>
      ) : (
        <Badge count={errorCount} position="rightTop" type="danger">
          <Button type="danger" disabled={isDisabled} loading={isSaving} onClick={handleButtonClick} className={styles.testrunErrorButton}>
            <Play size={16} className={styles['mr-2']} />
            {isSaving ? t('workflowCanvas.testrun.saving') : t('workflowCanvas.testrun.testRun')}
          </Button>
        </Badge>
      )}
    </>
  )
}
