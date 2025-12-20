import React from 'react'
import { TextField, Button, IconButton, Tooltip } from '@mui/material'
import { Layers, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface DebugInputAreaProps {
  inputMessage: string
  onInputChange: (value: string) => void
  onSend: () => void
  onClear: () => void
  onMultiRunClick: () => void
  isProcessing: boolean
  isReadOnlyMode: boolean
}

const DebugInputArea: React.FC<DebugInputAreaProps> = ({ inputMessage, onInputChange, onSend, onClear, onMultiRunClick, isProcessing, isReadOnlyMode }) => {
  const { t } = useTranslation()

  return (
    <>
      {/* 功能按钮区域 */}
      <div className="py-2 border-t border-blue-200 bg-white/60 flex-shrink-0 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Layers className="w-4 h-4" />}
              onClick={() => {
                if (isReadOnlyMode) {
                  return
                }
                onMultiRunClick()
              }}
              disabled={isReadOnlyMode}
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              {t('prompts.promptEdit.promptDebug.multiRun')}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Tooltip title={t('prompts.promptEdit.promptDebug.clearMainChat')}>
              <IconButton
                size="small"
                onClick={() => {
                  if (isReadOnlyMode) {
                    return
                  }
                  onClear()
                }}
                disabled={isReadOnlyMode}
                sx={{
                  color: '#3b82f6',
                  '&:hover': {
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  },
                }}
              >
                <Trash2 size={16} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* 底部输入框 */}
      <div className="border-t border-blue-200 bg-white/80 flex-shrink-0 p-2 relative z-10">
        <div className="flex flex-col gap-1">
          <TextField
            fullWidth
            multiline
            placeholder={t('prompts.promptEdit.promptDebug.inputPlaceholder')}
            value={inputMessage}
            onChange={e => {
              if (isReadOnlyMode) {
                return
              }
              onInputChange(e.target.value)
            }}
            onKeyDown={e => {
              if (isReadOnlyMode) {
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            disabled={isProcessing || isReadOnlyMode}
            sx={{
              backgroundColor: 'white',
              minHeight: '80px',
              maxHeight: '120px',
              '& .MuiOutlinedInput-root': {
                minHeight: '80px',
                maxHeight: '120px',
                borderRadius: 1,
                alignItems: 'flex-start',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                '& fieldset': {
                  borderColor: '#dbeafe',
                },
                '&:hover fieldset': {
                  borderColor: '#bfdbfe',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#3b82f6',
                },
              },
              '& .MuiInputBase-inputMultiline': {
                py: 1.5,
                px: 1.5,
                fontSize: '0.875rem',
                overflow: 'auto !important',
                maxHeight: 'calc(120px - 24px) !important',
                minHeight: 'calc(80px - 24px) !important',
                resize: 'none',
                boxSizing: 'border-box',
                wordWrap: 'break-word',
                wordBreak: 'break-word',
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f3f4f6',
                  borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#d1d5db',
                  borderRadius: '3px',
                  '&:hover': {
                    background: '#9ca3af',
                  },
                },
              },
              '& .MuiInputBase-input': {
                py: 1.5,
                px: 1.5,
                fontSize: '0.875rem',
                overflow: 'auto !important',
                maxHeight: 'calc(120px - 24px) !important',
                minHeight: 'calc(80px - 24px) !important',
                resize: 'none',
                boxSizing: 'border-box',
                wordWrap: 'break-word',
                wordBreak: 'break-word',
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f3f4f6',
                  borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#d1d5db',
                  borderRadius: '3px',
                  '&:hover': {
                    background: '#9ca3af',
                  },
                },
              },
            }}
          />
          <div className="flex justify-end">
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                if (isReadOnlyMode) {
                  return
                }
                onSend()
              }}
              disabled={isProcessing || isReadOnlyMode}
              startIcon={
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
              sx={{
                borderRadius: 1,
                px: 2,
                py: 0.5,
                background: 'linear-gradient(to right, #3b82f6, #6366f1)',
                fontSize: '0.875rem',
                '&:hover': {
                  background: 'linear-gradient(to right, #2563eb, #4f46e5)',
                },
              }}
            >
              {t('prompts.promptEdit.promptDebug.send')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

export default DebugInputArea
