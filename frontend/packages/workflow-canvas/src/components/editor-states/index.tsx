/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Spin, Empty, Button } from '@douyinfe/semi-ui'

import { LoadingContainer, LoadingText, ErrorContainer } from './styles'

interface LoadingStateProps {
  message?: string
}

export const LoadingState = ({ message = '正在加载工作流画布...' }: LoadingStateProps) => (
  <LoadingContainer>
    <Spin size="large" />
    <LoadingText>{message}</LoadingText>
  </LoadingContainer>
)

interface ErrorStateProps {
  error?: Error | null
  onRetry?: () => void
}

export const ErrorState = ({ error, onRetry }: ErrorStateProps) => {
  const navigate = useNavigate()

  return (
    <ErrorContainer>
      <Empty image={<AlertTriangle size={48} color="#ef4444" />} title="加载工作流画布失败" description={error?.message || '无法获取工作流数据'}>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
          <Button theme="solid" type="primary" onClick={onRetry || (() => window.location.reload())}>
            重新加载
          </Button>
          <Button theme="light" onClick={() => navigate('/dashboard/workflows')}>
            返回工作流列表
          </Button>
        </div>
      </Empty>
    </ErrorContainer>
  )
}
