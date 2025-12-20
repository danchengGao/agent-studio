import React, { useRef, useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, IconButton, CircularProgress, Paper } from '@mui/material'
import { Zap, Check, RotateCw, Square, Maximize, Minimize } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import DiffViewer from './DiffViewer'
import LimitedTextInput from './LimitedTextInput'
import { OptimizationSource, PromptMessage as Message, OptimizeStep, SelectedAiReply, ControlGroupData } from '@/types/promptType'

// 调试结果优化对话框属性
export interface DebugOptimizeDialogProps {
  open: boolean
  onClose: () => void
  selectedAiReply: SelectedAiReply | null
  optimizeStep: OptimizeStep
  optimizedPromptTemplate: string
  humanEvaluation: string
  optimizationSource: OptimizationSource
  promptMessages: Message[]
  baseGroupMessages: Message[]
  controlGroupsData: ControlGroupData[]
  onStepChange: (step: OptimizeStep) => void
  onOptimizedTemplateChange: (template: string) => void
  onHumanEvaluationChange: (evaluation: string) => void
  onAdoptOptimizedPrompt: () => void
  onStartOptimization: () => Promise<void>
  onRetryOptimization: () => Promise<void>
  onStopOptimization: () => void
}

export const DebugOptimizeDialog: React.FC<DebugOptimizeDialogProps> = ({
  open,
  onClose,
  selectedAiReply,
  optimizeStep,
  optimizedPromptTemplate,
  humanEvaluation,
  optimizationSource,
  promptMessages,
  baseGroupMessages,
  controlGroupsData,
  onStepChange,
  onOptimizedTemplateChange,
  onHumanEvaluationChange,
  onAdoptOptimizedPrompt,
  onStartOptimization,
  onRetryOptimization,
  onStopOptimization,
}) => {
  const { t } = useTranslation()
  const streamingOutputRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 自动滚动优化后的Prompt模板区域（流式输出过程中）
  useEffect(() => {
    if (optimizeStep === 'optimizing' && streamingOutputRef.current && optimizedPromptTemplate) {
      const scrollToBottom = () => {
        if (streamingOutputRef.current) {
          // 方法1：直接设置 scrollTop
          streamingOutputRef.current.scrollTop = streamingOutputRef.current.scrollHeight

          // 方法2：使用滚动锚点
          const scrollAnchor = streamingOutputRef.current.querySelector('#scroll-anchor')
          if (scrollAnchor) {
            scrollAnchor.scrollIntoView({ behavior: 'auto', block: 'end' })
          }

          // 方法3：强制滚动到最底部（备用方案）
          requestAnimationFrame(() => {
            if (streamingOutputRef.current) {
              streamingOutputRef.current.scrollTop = streamingOutputRef.current.scrollHeight + 100
            }
          })
        }
      }

      // 立即滚动一次
      scrollToBottom()

      // 延迟滚动，确保DOM已更新
      const timer = setTimeout(scrollToBottom, 50)
      return () => clearTimeout(timer)
    }
  }, [optimizedPromptTemplate, optimizeStep])

  // 获取原始Prompt模板内容
  const getOriginalPromptTemplate = (): string => {
    if (optimizationSource.type === 'main') {
      return promptMessages.find(msg => msg.role === 'system')?.content || t('components.prompts.debugOptimizeDialog.templateNotFound')
    } else if (optimizationSource.type === 'base') {
      return baseGroupMessages.find(msg => msg.role === 'system')?.content || t('components.prompts.debugOptimizeDialog.templateNotFoundBase')
    } else if (optimizationSource.type === 'control' && optimizationSource.groupId) {
      const group = controlGroupsData.find(g => g.id === optimizationSource.groupId)
      return (
        group?.messages.find(msg => msg.role === 'system')?.content ||
        t('components.prompts.debugOptimizeDialog.templateNotFoundControl', { groupId: optimizationSource.groupId })
      )
    }
    return t('components.prompts.debugOptimizeDialog.templateNotFound')
  }

  // 开始优化 - 调用父组件的函数
  const handleStartOptimization = async () => {
    await onStartOptimization()
  }

  // 重新优化 - 调用父组件的函数
  const handleRetryOptimization = async () => {
    await onRetryOptimization()
  }

  // 停止优化 - 调用父组件的函数
  const handleStopOptimization = () => {
    console.log('🛑 [DebugOptimizeDialog] 用户点击停止调试优化')
    onStopOptimization()
  }

  // 处理对话框关闭 - 如果正在优化则先停止
  const handleCloseDialog = () => {
    if (optimizeStep === 'optimizing') {
      console.log('🛑 [DebugOptimizeDialog] 对话框关闭时正在优化，先停止优化')
      handleStopOptimization()
    }
    setIsFullscreen(false) // 关闭时重置全屏状态
    onClose()
    onStepChange('input')
    onOptimizedTemplateChange('')
  }

  // 切换全屏
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <Dialog
      open={open}
      onClose={handleCloseDialog}
      maxWidth={isFullscreen ? false : 'xl'}
      fullWidth
      fullScreen={isFullscreen}
      PaperProps={{
        sx: {
          height: isFullscreen ? '100vh' : '90vh',
          maxHeight: isFullscreen ? '100vh' : '90vh',
          borderRadius: isFullscreen ? '0px' : '16px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <DialogTitle className="border-b border-gray-200/60 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <Typography variant="h6" className="font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {t('components.prompts.debugOptimizeDialog.title')}
            </Typography>
          </div>
          <div className="flex items-center space-x-2">
            <IconButton
              onClick={handleToggleFullscreen}
              size="small"
              title={
                isFullscreen
                  ? t('components.prompts.debugOptimizeDialog.exitFullscreen', '退出全屏')
                  : t('components.prompts.debugOptimizeDialog.enterFullscreen', '全屏')
              }
              sx={{
                color: '#6b7280',
                '&:hover': {
                  color: '#3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                },
              }}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </IconButton>
            <IconButton
              onClick={handleCloseDialog}
              size="small"
              sx={{
                color: '#6b7280',
                '&:hover': {
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                },
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
        </div>
      </DialogTitle>

      <DialogContent
        className="flex flex-col bg-white"
        sx={{
          padding: 0,
          margin: 0,
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingTop: '0px',
          paddingBottom: '0px',
        }}
        style={{ height: isFullscreen ? 'calc(100vh - 140px)' : 'calc(90vh - 140px)' }}
      >
        {/* 上半部分：调试记录 */}
        <div className="border border-gray-200/60 shadow-sm" style={{ height: '30%', minHeight: '300px' }}>
          {/* 调试记录 */}
          <div className="w-full flex flex-col h-full">
            <div className="bg-gradient-to-r from-gray-50/80 to-purple-50/80 px-4 py-3 border-b border-gray-200/60 backdrop-blur-sm">
              <Typography variant="subtitle2" className="font-semibold text-gray-700">
                {t('components.prompts.debugOptimizeDialog.debugRecord')}
              </Typography>
            </div>
            <div
              className="flex-1 p-4 overflow-y-auto bg-gradient-to-br from-white to-gray-50/30"
              style={{ maxHeight: isFullscreen ? 'calc(30vh - 80px)' : 'calc(40vh - 80px)' }}
            >
              {selectedAiReply && (
                <div className="space-y-4">
                  <div>
                    <Typography variant="subtitle2" className="mb-2 text-blue-600 font-semibold">
                      {t('components.prompts.debugOptimizeDialog.userQuestion')}
                    </Typography>
                    <Paper className="p-4 bg-gradient-to-br from-blue-50/80 to-blue-100/50 border border-blue-200/60 rounded-xl shadow-sm backdrop-blur-sm">
                      <Typography variant="body2" className="text-gray-700 leading-relaxed">
                        {selectedAiReply.userQuestion}
                      </Typography>
                    </Paper>
                  </div>
                  <div>
                    <Typography variant="subtitle2" className="mb-2 text-purple-600 font-semibold">
                      {t('components.prompts.debugOptimizeDialog.aiResponse')}
                    </Typography>
                    <Paper className="p-4 bg-gradient-to-br from-purple-50/80 to-purple-100/50 border border-purple-200/60 rounded-xl shadow-sm backdrop-blur-sm">
                      <Typography variant="body2" className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                        {selectedAiReply.aiResponse}
                      </Typography>
                    </Paper>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 下半部分：提示词模板对比 */}
        <div className="flex border border-gray-200/60 shadow-sm" style={{ height: '55%', minHeight: '320px' }}>
          <div className="w-full flex flex-col">
            <div className="bg-gradient-to-r from-gray-50/80 to-blue-50/80 border-b border-gray-200/60 backdrop-blur-sm">
              {/* 标题栏布局与上半部分对齐 */}
              <div className="flex">
                <div className="w-1/2 px-4 py-3 border-r border-gray-300/60 flex items-center justify-between">
                  <Typography variant="subtitle2" className="font-semibold text-gray-700">
                    {t('components.prompts.debugOptimizeDialog.originalTemplate')}
                  </Typography>
                  <Typography
                    variant="caption"
                    className="text-orange-600 bg-gradient-to-r from-orange-100/80 to-orange-200/60 px-3 py-1 rounded-full text-xs font-medium shadow-sm backdrop-blur-sm border border-orange-200/40"
                  >
                    {t('components.prompts.debugOptimizeDialog.onlyFirstSystem')}
                  </Typography>
                </div>
                <div className="w-1/2 px-4 py-3">
                  <Typography variant="subtitle2" className="font-semibold text-gray-700">
                    {t('components.prompts.debugOptimizeDialog.optimizedTemplate')}
                  </Typography>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto" style={{ maxHeight: isFullscreen ? 'calc(55vh + 20px)' : 'calc(45vh + 20px)' }}>
              {optimizedPromptTemplate && optimizeStep === 'result' ? (
                <div className="h-full bg-white">
                  <DiffViewer oldContent={getOriginalPromptTemplate()} newContent={optimizedPromptTemplate} autoScroll={false} />
                </div>
              ) : (
                <div className="h-full bg-white">
                  {/* 内容区域 */}
                  <div className="flex h-full">
                    <div className="flex-1 border-r border-gray-300/60 flex flex-col">
                      <div className="p-4 font-mono text-sm bg-gradient-to-br from-gray-50/50 to-white overflow-y-auto flex-1">
                        <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed">{getOriginalPromptTemplate()}</pre>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                      {optimizeStep === 'optimizing' ? (
                        <div className="p-4 font-mono text-sm bg-gradient-to-br from-blue-50/50 to-white overflow-y-auto flex-1" ref={streamingOutputRef}>
                          {!optimizedPromptTemplate ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <div className="p-4 bg-white/80 rounded-xl shadow-sm backdrop-blur-sm border border-white/20">
                                  <CircularProgress size={40} className="mb-4" sx={{ color: '#3b82f6' }} />
                                  <Typography variant="body2" className="text-gray-600 font-medium">
                                    {t('components.prompts.debugOptimizeDialog.generating')}
                                  </Typography>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed">{optimizedPromptTemplate}</pre>
                              {/* 滚动锚点 - 确保能滚动到最底部 */}
                              <div id="scroll-anchor" style={{ height: '1px' }}></div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 flex items-center justify-center flex-1 bg-gray-50">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-3 mx-auto">
                              <Zap className="w-8 h-8 text-gray-400" />
                            </div>
                            <Typography variant="body2" className="text-gray-500 mb-2">
                              {t('components.prompts.debugOptimizeDialog.clickToGenerate')}
                            </Typography>
                            <Typography variant="caption" className="text-gray-400">
                              {t('components.prompts.debugOptimizeDialog.optimizedContentHere')}
                            </Typography>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 人工评估输入框 */}
        <div
          className="flex-shrink-0 border-t-2 border-gray-200/60 pt-4 bg-gradient-to-r from-white to-gray-50/30"
          style={{ height: '15%', minHeight: '120px', maxHeight: '160px', overflow: 'hidden' }}
        >
          <Typography variant="subtitle2" className="mb-3 font-semibold text-gray-700">
            {t('components.prompts.debugOptimizeDialog.humanEvaluation')}
          </Typography>
          <LimitedTextInput
            value={humanEvaluation}
            onChange={onHumanEvaluationChange}
            placeholder={t('components.prompts.debugOptimizeDialog.humanEvaluationPlaceholder')}
            rows={3}
            maxLength={500}
            disabled={optimizeStep === 'optimizing'}
          />
        </div>
      </DialogContent>

      <DialogActions className="border-t border-gray-200/60 bg-white/60 backdrop-blur-sm pt-4 pb-4">
        <Button
          onClick={handleCloseDialog}
          variant="outlined"
          sx={{
            borderRadius: '10px',
            borderColor: 'rgba(156,163,175,0.5)',
            color: '#6b7280',
            backgroundColor: 'white',
            '&:hover': {
              borderColor: 'rgba(156,163,175,0.8)',
              backgroundColor: 'rgba(243,244,246,0.5)',
            },
          }}
        >
          {t('components.prompts.debugOptimizeDialog.cancel')}
        </Button>

        {optimizeStep === 'input' && (
          <Button
            onClick={handleStartOptimization}
            variant="contained"
            disabled={!selectedAiReply || !humanEvaluation.trim()}
            startIcon={<Zap className="w-4 h-4" />}
            sx={{
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                boxShadow: '0 6px 16px rgba(59,130,246,0.5)',
                transform: 'translateY(-1px)',
              },
              '&:disabled': {
                background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)',
                boxShadow: 'none',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            {t('components.prompts.debugOptimizeDialog.startOptimization')}
          </Button>
        )}

        {optimizeStep === 'optimizing' && (
          <Button
            onClick={handleStopOptimization}
            variant="contained"
            startIcon={<Square className="w-4 h-4" />}
            sx={{
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                boxShadow: '0 6px 16px rgba(239,68,68,0.5)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            {t('components.prompts.debugOptimizeDialog.stopResponse')}
          </Button>
        )}

        {optimizeStep === 'result' && (
          <>
            <Button
              onClick={handleRetryOptimization}
              variant="outlined"
              disabled={!humanEvaluation.trim()}
              startIcon={<RotateCw className="w-4 h-4" />}
              sx={{
                borderRadius: '10px',
                borderColor: 'rgba(245,158,11,0.5)',
                color: '#d97706',
                '&:hover': {
                  borderColor: 'rgba(245,158,11,0.8)',
                  backgroundColor: 'rgba(254,243,199,0.5)',
                },
                '&:disabled': {
                  borderColor: 'rgba(209,213,219,0.5)',
                  color: '#9ca3af',
                },
              }}
            >
              {t('components.prompts.debugOptimizeDialog.retryOptimization')}
            </Button>
            <Button
              onClick={onAdoptOptimizedPrompt}
              variant="contained"
              disabled={!optimizedPromptTemplate}
              startIcon={<Check className="w-4 h-4" />}
              sx={{
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  boxShadow: '0 6px 16px rgba(16,185,129,0.5)',
                  transform: 'translateY(-1px)',
                },
                '&:disabled': {
                  background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)',
                  boxShadow: 'none',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              {t('components.prompts.debugOptimizeDialog.adopt')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default DebugOptimizeDialog
