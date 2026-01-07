/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Spin, Empty, Button } from '@douyinfe/semi-ui'

import { LoadingContainer, LoadingText, ErrorContainer } from './styles'
import { useTranslation } from '../../i18n'

interface LoadingStateProps {
  message?: string
}

export const LoadingState = ({ message }: LoadingStateProps) => {
  const { t } = useTranslation()
  const defaultMessage = t('workflowCanvas.editorStates.loadingWorkflow')
  return (
    <LoadingContainer>
      <Spin size="large" />
      <LoadingText>{message || defaultMessage}</LoadingText>
    </LoadingContainer>
  )
}

interface ErrorStateProps {
  error?: Error | null
  onRetry?: () => void
}

export const ErrorState = ({ error, onRetry }: ErrorStateProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <ErrorContainer>
      <Empty
        image={<AlertTriangle size={48} color="#ef4444" />}
        title={t('workflowCanvas.editorStates.loadFailed')}
        description={error?.message || t('workflowCanvas.editorStates.cannotGetWorkflowData')}
      >
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
          <Button theme="solid" type="primary" onClick={onRetry || (() => window.location.reload())}>
            {t('workflowCanvas.editorStates.retry')}
          </Button>
          <Button theme="light" onClick={() => navigate('/dashboard/workflows')}>
            {t('workflowCanvas.editorStates.backToList')}
          </Button>
        </div>
      </Empty>
    </ErrorContainer>
  )
}
