/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { t } from '../../../i18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 你同样可以将错误日志上报给服务器
    console.error('🚨 ErrorBoundary捕获到错误:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      // 你可以自定义降级后的 UI 并渲染
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle size={16} />
            <span className="font-medium">{t('workflowCanvas.errorBoundary.renderError')}</span>
          </div>
          <div className="text-sm text-red-700 mb-3">
            {t('workflowCanvas.errorBoundary.errorMessage')}
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-3">
              <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800 mb-2">
                {t('workflowCanvas.errorBoundary.viewDetails')}
              </summary>
              <div className="bg-red-100 p-2 rounded text-xs">
                <div className="font-medium mb-1">{t('workflowCanvas.errorBoundary.errorInfo')}:</div>
                <pre className="whitespace-pre-wrap text-red-800">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <div className="mt-2">
                    <div className="font-medium mb-1">{t('workflowCanvas.errorBoundary.componentStack')}:</div>
                    <pre className="whitespace-pre-wrap text-red-700 text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            <RefreshCw size={12} />
            {t('workflowCanvas.errorBoundary.retry')}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}