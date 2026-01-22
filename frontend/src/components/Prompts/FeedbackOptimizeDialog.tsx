import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Paper, Chip, IconButton, Tooltip } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Zap, Copy, RotateCw, Check, X, Square } from 'lucide-react'
import LimitedTextInput from './LimitedTextInput'
import { handleInputEnterKey } from '@/utils/prompts/utils'

// 优化模式定义
export type OptimizationMode = 'general' | 'insert' | 'select'

// 光标位置接口
export interface CursorPosition {
  messageId: string
  position: number
}

// 组件Props接口
export interface FeedbackOptimizeDialogProps {
  open: boolean
  currentOptimizationType: OptimizationMode | null
  selectedText?: string
  cursorPosition?: CursorPosition | null
  optimizeInput: string
  optimizedResult: string
  isOptimizing: boolean
  onClose: () => void
  onOptimizeInputChange: (input: string) => void
  onOptimizeRequest: () => void
  onApplyOptimization: () => void
  onStopOptimization: () => void
  onCopyResult?: (result: string) => Promise<void>
}

const FeedbackOptimizeDialog: React.FC<FeedbackOptimizeDialogProps> = ({
  open,
  currentOptimizationType,
  selectedText,
  cursorPosition,
  optimizeInput,
  optimizedResult,
  isOptimizing,
  onClose,
  onOptimizeInputChange,
  onOptimizeRequest,
  onApplyOptimization,
  onStopOptimization,
  onCopyResult,
}) => {
  const { t } = useTranslation()

  // 使用本地状态管理输入，避免每次输入都触发父组件重新渲染
  const [localInput, setLocalInput] = useState(optimizeInput)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 当对话框打开或外部 optimizeInput 变化时，同步到本地状态
  useEffect(() => {
    if (open) {
      setLocalInput(optimizeInput)
    }
  }, [open, optimizeInput])

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // 防抖更新父组件状态
  const debouncedUpdateParent = useCallback(
    (value: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        onOptimizeInputChange(value)
      }, 300) // 300ms 防抖延迟
    },
    [onOptimizeInputChange],
  )

  // 处理输入变化
  const handleInputChange = useCallback(
    (value: string) => {
      setLocalInput(value)
      // 使用防抖更新父组件状态，减少重新渲染频率
      debouncedUpdateParent(value)
    },
    [debouncedUpdateParent],
  )

  // 处理失去焦点时立即同步（确保数据不丢失）
  const handleInputBlur = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    // 立即同步到父组件
    onOptimizeInputChange(localInput)
  }, [localInput, onOptimizeInputChange])
  // 获取优化类型标签
  const getOptimizationTypeLabel = () => {
    switch (currentOptimizationType) {
      case 'general':
        return t('components.prompts.feedbackOptimizeDialog.type.feedback')
      case 'insert':
        return t('components.prompts.feedbackOptimizeDialog.type.insert')
      case 'select':
        return t('components.prompts.feedbackOptimizeDialog.type.select')
      default:
        return t('components.prompts.feedbackOptimizeDialog.type.default')
    }
  }

  // 获取优化类型颜色
  const getOptimizationTypeColor = () => {
    switch (currentOptimizationType) {
      case 'general':
        return 'primary'
      case 'insert':
        return 'success'
      case 'select':
        return 'warning'
      default:
        return 'default'
    }
  }

  // 获取占位符文本
  const getPlaceholderText = () => {
    switch (currentOptimizationType) {
      case 'general':
        return t('components.prompts.feedbackOptimizeDialog.placeholder.feedback')
      case 'insert':
        return t('components.prompts.feedbackOptimizeDialog.placeholder.insert')
      case 'select':
        return t('components.prompts.feedbackOptimizeDialog.placeholder.select')
      default:
        return t('components.prompts.feedbackOptimizeDialog.placeholder.default')
    }
  }

  // 获取应用按钮文本
  const getApplyButtonText = () => {
    switch (currentOptimizationType) {
      case 'general':
        return t('components.prompts.feedbackOptimizeDialog.applyButton.replace')
      case 'insert':
        return t('components.prompts.feedbackOptimizeDialog.applyButton.insert')
      case 'select':
        return t('components.prompts.feedbackOptimizeDialog.applyButton.replace')
      default:
        return t('components.prompts.feedbackOptimizeDialog.applyButton.apply')
    }
  }

  // 处理复制结果
  const handleCopyResult = async () => {
    if (!optimizedResult) {
      return
    }

    try {
      if (onCopyResult) {
        await onCopyResult(optimizedResult)
      } else {
        await navigator.clipboard.writeText(optimizedResult)
      }
    } catch (error) {
      console.error(t('components.prompts.feedbackOptimizeDialog.copyFailed'), error)
    }
  }

  // 停止反馈优化
  const handleStopOptimization = () => {
    console.log('🛑 [FeedbackOptimizeDialog] 用户点击停止反馈优化')
    onStopOptimization()
  }

  // 处理对话框关闭 - 如果正在优化则先停止
  const handleClose = useCallback(() => {
    // 关闭前立即同步输入到父组件
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    onOptimizeInputChange(localInput)

    if (isOptimizing) {
      console.log('🛑 [FeedbackOptimizeDialog] 对话框关闭时正在优化，先停止优化')
      onStopOptimization()
    }
    onClose()
  }, [localInput, isOptimizing, onOptimizeInputChange, onStopOptimization, onClose])

  // 处理优化请求 - 确保优化类型正确设置
  const handleOptimizeRequest = useCallback(() => {
    // 在提交前立即同步输入到父组件
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    onOptimizeInputChange(localInput)

    // 如果当前优化类型为空，则设置为 'general'（全文反馈优化）
    if (!currentOptimizationType) {
      console.log('🔍 [FeedbackOptimizeDialog] 优化类型未设置，自动设置为 general')
      // 这里我们不能直接修改 props，所以需要在父组件中处理
      // 暂时先调用原始的 onOptimizeRequest，让父组件处理类型设置
    }
    onOptimizeRequest()
  }, [localInput, currentOptimizationType, onOptimizeInputChange, onOptimizeRequest])

  // 处理发送请求（包装函数，用于键盘事件处理）
  const handleSendRequest = useCallback(() => {
    if (!isOptimizing) {
      handleOptimizeRequest()
    }
  }, [isOptimizing, handleOptimizeRequest])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
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
            <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <Typography variant="h6" className="font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {t('components.prompts.feedbackOptimizeDialog.title')}
            </Typography>
            <Chip
              label={getOptimizationTypeLabel()}
              size="small"
              color={getOptimizationTypeColor() as 'primary' | 'success' | 'warning' | 'default'}
              variant="filled"
              sx={{
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            />
          </div>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{
              color: '#6b7280',
              '&:hover': {
                color: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              },
            }}
          >
            <X className="w-5 h-5" />
          </IconButton>
        </div>
      </DialogTitle>

      <DialogContent className="bg-white">
        <div className="py-4">
          {/* 选中文本显示 */}
          {selectedText && (
            <>
              <div className="py-2">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"></div>
                  <Typography variant="subtitle2" className="font-medium text-gray-700">
                    {t('components.prompts.feedbackOptimizeDialog.selectedText')}
                  </Typography>
                </div>
                <Paper className="p-4 bg-gradient-to-br from-green-50/80 to-emerald-50/80 border border-green-200/60 rounded-lg">
                  <Typography
                    variant="body2"
                    className="text-gray-800 leading-relaxed"
                    sx={{
                      whiteSpace: 'pre-wrap', // 保留换行符和空格
                      wordBreak: 'break-word', // 长单词自动换行
                    }}
                  >
                    {selectedText}
                  </Typography>
                </Paper>
              </div>
              <hr className="border-gray-200" />
            </>
          )}

          {/* 光标位置显示 */}
          {cursorPosition && currentOptimizationType === 'insert' && (
            <>
              <div className="py-2">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"></div>
                  <Typography variant="subtitle2" className="font-medium text-gray-700">
                    {t('components.prompts.feedbackOptimizeDialog.insertPosition')}
                  </Typography>
                </div>
                <Paper className="p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200/60 rounded-lg">
                  <Typography variant="body2" className="text-gray-800 leading-relaxed">
                    {t('components.prompts.feedbackOptimizeDialog.cursorPosition', { position: cursorPosition.position })}
                  </Typography>
                </Paper>
              </div>
              <hr className="border-gray-200" />
            </>
          )}

          {/* 优化结果显示 */}
          {optimizedResult && (
            <>
              <div className="py-2">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full"></div>
                  <Typography variant="subtitle2" className="font-medium text-gray-700">
                    {t('components.prompts.feedbackOptimizeDialog.optimizedResult')}
                  </Typography>
                </div>
                <Paper className="p-4 bg-gradient-to-br from-emerald-50/80 to-green-50/80 border border-emerald-200/60 rounded-lg shadow-sm">
                  <TextField
                    multiline
                    fullWidth
                    value={optimizedResult}
                    InputProps={{
                      readOnly: true,
                      style: {
                        fontFamily: 'inherit',
                        fontSize: '0.875rem',
                        lineHeight: '1.25rem',
                        color: 'inherit',
                        whiteSpace: 'pre-wrap', // 保留换行符和空格
                      },
                    }}
                    variant="standard"
                    sx={{
                      '& .MuiInput-underline:before': { display: 'none' },
                      '& .MuiInput-underline:after': { display: 'none' },
                      '& .MuiInputBase-input': {
                        padding: 0,
                        cursor: 'text',
                        whiteSpace: 'pre-wrap', // 确保换行符被正确显示
                      },
                    }}
                    onFocus={e => e.target.select()}
                  />
                </Paper>

                {/* 操作按钮 */}
                <div className="flex items-center justify-start gap-2 mt-4 pt-3 border-gray-200">
                  <Tooltip title={t('components.prompts.feedbackOptimizeDialog.copy')} placement="top">
                    <IconButton
                      size="small"
                      onClick={handleCopyResult}
                      sx={{
                        color: '#6b7280',
                        backgroundColor: 'rgba(255,255,255,0.8)',
                        border: '1px solid rgba(229,231,235,0.6)',
                        borderRadius: '8px',
                        '&:hover': {
                          color: '#059669',
                          backgroundColor: 'rgba(16,185,129,0.1)',
                          borderColor: 'rgba(16,185,129,0.3)',
                        },
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title={t('components.prompts.feedbackOptimizeDialog.regenerate')} placement="top">
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleOptimizeRequest()
                      }}
                      disabled={isOptimizing}
                      sx={{
                        color: '#6b7280',
                        backgroundColor: 'rgba(255,255,255,0.8)',
                        border: '1px solid rgba(229,231,235,0.6)',
                        borderRadius: '8px',
                        '&:hover': {
                          color: '#f59e0b',
                          backgroundColor: 'rgba(245,158,11,0.1)',
                          borderColor: 'rgba(245,158,11,0.3)',
                        },
                        '&:disabled': {
                          color: '#d1d5db',
                          backgroundColor: 'rgba(243,244,246,0.5)',
                        },
                      }}
                    >
                      <RotateCw className="w-4 h-4" />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
              <hr className="border-gray-200" />
            </>
          )}

          {/* 优化输入框 */}
          <div className="py-2">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-2 h-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
              <Typography variant="subtitle2" className="font-medium text-gray-700">
                {t('components.prompts.feedbackOptimizeDialog.optimizeRequirement')}
              </Typography>
            </div>
            <LimitedTextInput
              value={localInput}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              placeholder={getPlaceholderText()}
              rows={3}
              maxLength={500}
              autoFocus={!optimizedResult}
              onKeyDown={handleInputEnterKey(false, handleInputChange, handleSendRequest) as React.KeyboardEventHandler}
            />
          </div>
        </div>
      </DialogContent>

      <DialogActions className="py-2 border-t border-gray-200/60 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center justify-end space-x-3 w-full">
          <Button
            variant="outlined"
            onClick={handleClose}
            sx={{
              borderRadius: '10px',
              borderColor: 'rgba(156,163,175,0.5)',
              color: '#6b7280',
              '&:hover': {
                borderColor: 'rgba(156,163,175,0.8)',
                backgroundColor: 'rgba(243,244,246,0.5)',
              },
            }}
          >
            {t('components.prompts.feedbackOptimizeDialog.cancel')}
          </Button>
          {optimizedResult && (
            <Button
              onClick={onApplyOptimization}
              variant="contained"
              startIcon={<Check className="w-4 h-4" />}
              sx={{
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
                  boxShadow: '0 6px 16px rgba(16,185,129,0.5)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              {getApplyButtonText()}
            </Button>
          )}
          {isOptimizing ? (
            // 优化中时显示停止按钮
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
              {t('components.prompts.feedbackOptimizeDialog.stopResponse')}
            </Button>
          ) : (
            // 非优化时显示优化按钮
            <Button
              onClick={handleOptimizeRequest}
              variant="contained"
              disabled={!localInput.trim()}
              startIcon={<Zap className="w-4 h-4" />}
              sx={{
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
                  boxShadow: '0 6px 16px rgba(239,68,68,0.5)',
                  transform: 'translateY(-1px)',
                },
                '&:disabled': {
                  background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)',
                  boxShadow: 'none',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              {optimizedResult ? t('components.prompts.feedbackOptimizeDialog.continueOptimize') : t('components.prompts.feedbackOptimizeDialog.send')}
            </Button>
          )}
        </div>
      </DialogActions>
    </Dialog>
  )
}

export default FeedbackOptimizeDialog
