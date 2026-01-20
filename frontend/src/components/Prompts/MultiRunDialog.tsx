import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogTitle, DialogContent, Button, Typography, TextField, IconButton, Box, Paper, Tabs, Tab, Tooltip, Divider } from '@mui/material'
import { X, Trash2, Maximize2, Minimize2, Layers, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ChatMessageArea, { ChatMessage } from './ChatMessageArea'

interface MultiRunDialogProps {
  open: boolean
  onClose: () => void
  runCount: number
  onRunCountChange: (count: number) => void
  multiRunChatMessages: ChatMessage[][]
  multiRunProcessing: boolean[]
  onSendMessage: (message: string) => void
  onClearAll: () => void
  onClearInstance: (index: number) => void
  onRegenerateMessage: (instanceIndex: number, messageIndex: number) => void
  onAdoptConversation: (instanceIndex: number) => void
  onViewTrace?: (messageIndex: number) => void
  onDeleteMessage?: (instanceIndex: number, messageIndex: number) => void
  onUpdateMessage?: (instanceIndex: number, messageIndex: number, content: string) => void
  onStopStreaming?: (instanceIndex?: number) => void
  prompt: any
  modelConfig: any
  parameters: any[]
  // 新增：工具调用展开状态管理
  multiRunExpandedToolCallMessages: Set<number>
  onToggleMultiRunToolCallExpanded: (index: number) => void
  // 新增：AI思考过程展开状态管理
  multiRunExpandedReasoningMessages: Set<number>
  onToggleMultiRunReasoningExpanded: (index: number) => void
  readOnly?: boolean
}

export const MultiRunDialog: React.FC<MultiRunDialogProps> = ({
  open,
  onClose,
  runCount,
  onRunCountChange,
  multiRunChatMessages,
  multiRunProcessing,
  onSendMessage,
  onClearAll,
  onClearInstance,
  onRegenerateMessage,
  onAdoptConversation,
  onViewTrace,
  onDeleteMessage,
  onUpdateMessage,
  onStopStreaming,
  prompt,
  modelConfig,
  parameters,
  multiRunExpandedToolCallMessages,
  onToggleMultiRunToolCallExpanded,
  multiRunExpandedReasoningMessages,
  onToggleMultiRunReasoningExpanded,
  readOnly = false,
}) => {
  const { t } = useTranslation()
  const [inputMessage, setInputMessage] = useState('')
  const [selectedTab, setSelectedTab] = useState(0) // 默认选中"所有实例"页签（现在是第一个）

  const [isFullScreen, setIsFullScreen] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const allInstanceRefs = useRef<(HTMLDivElement | null)[]>([])

  // ChatMessageArea state management
  const [messageFormats, setMessageFormats] = useState<{ [key: number]: 'txt' | 'markdown' }>({})
  const [completedMessages, setCompletedMessages] = useState<Set<number>>(new Set())
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null)
  const [editingInstanceIndex, setEditingInstanceIndex] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState<string>('')
  const isReadOnly = !!readOnly

  // 滚动到底部函数
  const scrollToBottom = (containerRef?: React.RefObject<HTMLDivElement>) => {
    const ref = containerRef || chatContainerRef
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }

  // 处理复制功能
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  // 处理重试功能
  const handleRetry = async (instanceIndex: number, messageIndex: number) => {
    // 确保要重试的消息是AI消息
    const messages = multiRunChatMessages[instanceIndex]
    if (!messages || messageIndex < 0 || messages[messageIndex]?.type !== 'ai') return

    // 调用重新生成回调
    onRegenerateMessage(instanceIndex, messageIndex)
  }

  // ChatMessageArea callback handlers
  const handleToggleMessageFormat = (index: number) => {
    setMessageFormats(prev => ({
      ...prev,
      [index]: prev[index] === 'markdown' ? 'txt' : 'markdown',
    }))
  }

  const handleStartEdit = (instanceIndex: number, messageIndex: number, content: string) => {
    setEditingInstanceIndex(instanceIndex)
    setEditingMessageIndex(messageIndex)
    setEditingContent(content)
  }

  const handleSaveEdit = (messageIndex: number, content: string) => {
    if (editingInstanceIndex === null || editingMessageIndex === null) {
      return
    }

    const instanceIndex = editingInstanceIndex
    const messages = multiRunChatMessages[instanceIndex]
    if (!messages || messageIndex < 0 || messageIndex >= messages.length) {
      return
    }

    // 如果有回调函数，使用回调函数来更新消息
    if (onUpdateMessage) {
      onUpdateMessage(instanceIndex, messageIndex, content)
    } else {
      // 否则直接修改消息数组中的内容（不推荐，但作为后备方案）
      messages[messageIndex] = {
        ...messages[messageIndex],
        content: content,
      }
    }

    // 清除编辑状态
    setEditingInstanceIndex(null)
    setEditingMessageIndex(null)
    setEditingContent('')
  }

  const handleCancelEdit = () => {
    setEditingInstanceIndex(null)
    setEditingMessageIndex(null)
    setEditingContent('')
  }

  const handleEditContentChange = (content: string) => {
    setEditingContent(content)
  }

  // 处理删除消息功能
  const handleDeleteMessage = (instanceIndex: number, messageIndex: number) => {
    if (onDeleteMessage) {
      onDeleteMessage(instanceIndex, messageIndex)
    }
  }

  // 滚动所有实例到底部
  const scrollAllInstancesToBottom = () => {
    allInstanceRefs.current.forEach(ref => {
      if (ref) {
        ref.scrollTop = ref.scrollHeight
      }
    })
  }

  const handleSendMessage = () => {
    if (isReadOnly) {
      return
    }
    // 移除空内容检查，允许发送空消息进行调试
    onSendMessage(inputMessage)
    setInputMessage('')

    // 发送消息后滚动到底部
    setTimeout(() => {
      if (selectedTab === 0) {
        // 所有实例视图
        scrollAllInstancesToBottom()
      } else {
        // 单个实例视图
        scrollToBottom()
      }
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isReadOnly) {
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const isProcessing = multiRunProcessing.some(processing => processing)

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    if (selectedTab === 0) {
      setTimeout(scrollAllInstancesToBottom, 100)
    } else if (selectedTab > 0 && multiRunChatMessages[selectedTab - 1]?.length > 0) {
      setTimeout(scrollToBottom, 100)
    }
  }, [multiRunChatMessages, selectedTab, runCount])

  useEffect(() => {
    if (isReadOnly) {
      setEditingInstanceIndex(null)
      setEditingMessageIndex(null)
      setEditingContent('')
    }
  }, [isReadOnly])

  // Initialize completed messages and message formats when messages change
  useEffect(() => {
    const newCompletedMessages = new Set<number>()
    const newMessageFormats: { [key: number]: 'txt' | 'markdown' } = {}

    multiRunChatMessages.forEach((messages, instanceIndex) => {
      messages.forEach((message, messageIndex) => {
        if (message.content !== '......' && message.content.trim() !== '') {
          newCompletedMessages.add(messageIndex)
        }
        newMessageFormats[messageIndex] = 'txt' // Default to text format
      })
    })

    setCompletedMessages(newCompletedMessages)
    setMessageFormats(newMessageFormats)
  }, [multiRunChatMessages])

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={isFullScreen ? false : 'xl'}
        fullWidth
        fullScreen={isFullScreen}
        PaperProps={{
          sx: {
            height: isFullScreen ? '100%' : '90vh',
            maxHeight: isFullScreen ? '100%' : '90vh',
            background: '#ffffff',
            borderRadius: 0,
          },
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: 3,
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(229, 231, 235, 0.6)',
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                sx={{
                  p: 1,
                  background: 'linear-gradient(to right, #a855f7, #ec4899)',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Layers size={20} color="white" />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(to right, #1f2937, #4b5563)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {t('components.prompts.multiRunDialog.title')}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#6b7280',
                    display: 'block',
                    mt: -0.5,
                  }}
                >
                  {t('components.prompts.multiRunDialog.subtitle', { count: runCount })}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Tooltip title={t('components.prompts.multiRunDialog.adjustInstanceCount')}>
                <Box
                  display="flex"
                  alignItems="center"
                  gap={1}
                  sx={{
                    backgroundColor: 'white',
                    px: 2,
                    py: 0.5,
                    borderRadius: 2,
                    border: '1px solid #bfdbfe',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {t('components.prompts.multiRunDialog.instanceCount')}:
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={runCount}
                    onChange={e => {
                      if (isReadOnly) {
                        return
                      }
                      onRunCountChange(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))
                    }}
                    inputProps={{
                      min: 1,
                      max: 10,
                      style: {
                        padding: '4px 8px',
                        fontSize: '0.875rem',
                      },
                    }}
                    disabled={isReadOnly}
                    sx={{
                      width: 60,
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          border: 'none',
                        },
                      },
                    }}
                  />
                </Box>
              </Tooltip>
              <Tooltip title={isFullScreen ? t('components.prompts.multiRunDialog.exitFullScreen') : t('components.prompts.multiRunDialog.fullScreen')}>
                <IconButton
                  onClick={() => {
                    setIsFullScreen(!isFullScreen)
                  }}
                  data-readonly-allowed="true"
                  size="small"
                  sx={{
                    color: '#9ca3af',
                    '&:hover': {
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      color: '#2563eb',
                    },
                  }}
                >
                  {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={t('components.prompts.multiRunDialog.close')}>
                <IconButton
                  edge="end"
                  onClick={onClose}
                  aria-label="close"
                  sx={{
                    color: '#9ca3af',
                    '&:hover': {
                      backgroundColor: 'rgba(251, 113, 133, 0.08)',
                      color: '#f87171',
                    },
                  }}
                >
                  <X size={20} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent
          dividers
          sx={{
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
          }}
        >
          {/* 实例标签页 */}
          <Box
            sx={{
              borderBottom: '1px solid rgba(229, 231, 235, 0.6)',
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              data-readonly-allowed="true"
              sx={{
                minHeight: 48,
                '& .MuiTabs-indicator': {
                  backgroundColor: '#3b82f6',
                  height: 2.5,
                },
                '& .MuiTab-root': {
                  color: '#9ca3af',
                  fontWeight: 500,
                  '&:hover': {
                    color: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.04)',
                  },
                  '&.Mui-selected': {
                    color: '#2563eb',
                  },
                },
              }}
            >
              <Tab
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Layers size={16} />
                    <span style={{ fontSize: '0.875rem' }}>{t('components.prompts.multiRunDialog.allInstances')}</span>
                  </Box>
                }
                sx={{ minHeight: 48 }}
              />
              {Array.from({ length: runCount }, (_, index) => (
                <Tab
                  key={index + 1}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <span style={{ fontSize: '0.875rem' }}>{t('components.prompts.multiRunDialog.instance', { number: index + 1 })}</span>
                      {multiRunProcessing[index] && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'linear-gradient(to right, #3b82f6, #1d4ed8)',
                              animation: 'pulse 1.5s infinite',
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  }
                  sx={{ minHeight: 48 }}
                />
              ))}
            </Tabs>
          </Box>

          {/* 聊天内容区域 */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selectedTab > 0 ? (
              // 单个实例视图
              <Box sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
                <ChatMessageArea
                  messages={multiRunChatMessages[selectedTab - 1] || []}
                  onRetryMessage={index => handleRetry(selectedTab - 1, index)}
                  onCopyMessage={handleCopy}
                  onDeleteMessage={index => handleDeleteMessage(selectedTab - 1, index)}
                  onViewTrace={index => onViewTrace?.(index)}
                  isProcessing={multiRunProcessing[selectedTab - 1]}
                  onStopStreaming={() => onStopStreaming?.(selectedTab - 1)}
                  isStreamingStopped={false}
                  className="h-full"
                  messageFormats={messageFormats}
                  onToggleMessageFormat={handleToggleMessageFormat}
                  completedMessages={completedMessages}
                  expandedReasoningMessages={multiRunExpandedReasoningMessages}
                  onToggleReasoningExpanded={onToggleMultiRunReasoningExpanded}
                  expandedToolCallMessages={multiRunExpandedToolCallMessages}
                  onToggleToolCallExpanded={onToggleMultiRunToolCallExpanded}
                  editingMessageIndex={editingInstanceIndex === selectedTab - 1 ? editingMessageIndex : null}
                  editingContent={editingContent}
                  onStartEdit={(index, content) => handleStartEdit(selectedTab - 1, index, content)}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onEditContentChange={handleEditContentChange}
                  containerRef={chatContainerRef}
                  emptyStateText={t('components.prompts.multiRunDialog.startTesting')}
                  emptyStateSubtext={t('components.prompts.multiRunDialog.startTestingSubtext')}
                  readOnly={isReadOnly}
                />
              </Box>
            ) : (
              // 所有实例视图
              <Box className="custom-scrollbar" sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 2 }}>
                  {Array.from({ length: runCount }, (_, index) => (
                    <Paper
                      key={index}
                      elevation={2}
                      sx={{
                        p: 2,
                        height: 400,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        background: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(229, 231, 235, 0.6)',
                        borderRadius: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" color="primary">
                          {t('components.prompts.multiRunDialog.instance', { number: index + 1 })}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Tooltip title={t('components.prompts.multiRunDialog.adoptConversation')}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                if (isReadOnly) {
                                  return
                                }
                                onAdoptConversation(index)
                              }}
                              disabled={isReadOnly}
                              sx={{
                                color: '#3b82f6',
                                '&:hover': {
                                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                },
                              }}
                            >
                              <CheckCircle size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('components.prompts.multiRunDialog.clearInstance')}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                if (isReadOnly) {
                                  return
                                }
                                onClearInstance(index)
                              }}
                              disabled={isReadOnly}
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
                        </Box>
                      </Box>
                      <Divider sx={{ mb: 1 }} />
                      <Box
                        ref={el => {
                          if (el) allInstanceRefs.current[index] = el
                        }}
                        sx={{ flex: 1, overflow: 'hidden' }}
                      >
                        <ChatMessageArea
                          messages={multiRunChatMessages[index] || []}
                          onRetryMessage={msgIndex => handleRetry(index, msgIndex)}
                          onCopyMessage={handleCopy}
                          onDeleteMessage={msgIndex => handleDeleteMessage(index, msgIndex)}
                          onViewTrace={msgIndex => onViewTrace?.(msgIndex)}
                          isProcessing={multiRunProcessing[index]}
                          onStopStreaming={() => onStopStreaming?.(index)}
                          isStreamingStopped={false}
                          className="h-full"
                          messageFormats={messageFormats}
                          onToggleMessageFormat={handleToggleMessageFormat}
                          completedMessages={completedMessages}
                          expandedReasoningMessages={multiRunExpandedReasoningMessages}
                          onToggleReasoningExpanded={onToggleMultiRunReasoningExpanded}
                          expandedToolCallMessages={multiRunExpandedToolCallMessages}
                          onToggleToolCallExpanded={onToggleMultiRunToolCallExpanded}
                          editingMessageIndex={editingInstanceIndex === index ? editingMessageIndex : null}
                          editingContent={editingContent}
                          onStartEdit={(msgIndex, content) => handleStartEdit(index, msgIndex, content)}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={handleCancelEdit}
                          onEditContentChange={handleEditContentChange}
                          emptyStateText={t('components.prompts.multiRunDialog.noMessages')}
                          emptyStateSubtext=""
                          readOnly={isReadOnly}
                        />
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          {/* 输入框区域 */}
          <Box
            sx={{
              borderTop: '1px solid rgba(229, 231, 235, 0.6)',
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(12px)',
              p: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                placeholder={t('components.prompts.multiRunDialog.inputPlaceholder')}
                value={inputMessage}
                onChange={e => {
                  if (isReadOnly) {
                    return
                  }
                  setInputMessage(e.target.value)
                }}
                onKeyDown={handleKeyDown}
                disabled={isProcessing || isReadOnly}
                sx={{
                  backgroundColor: 'white',
                  height: 'calc(100vh / 9 - 48px)',
                  minHeight: '100px',
                  maxHeight: '120px',
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    borderRadius: 1,
                    alignItems: 'flex-start', // 改为向上对齐
                    overflow: 'hidden', // 防止内容溢出
                    '& fieldset': {
                      borderColor: 'rgba(229, 231, 235, 0.6)',
                    },
                    '&:hover fieldset': {
                      borderColor: '#3b82f6',
                      borderWidth: '2px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#3b82f6',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '0.875rem',
                    overflow: 'auto !important',
                    maxHeight: '100%', // 减去内边距，防止溢出
                    resize: 'none', // 禁用拖拽调整大小
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: '#e0f2fe',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: '#93c5fd',
                      borderRadius: '4px',
                      '&:hover': {
                        background: '#3b82f6',
                      },
                    },
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* 左侧按钮组 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* 清空按钮 */}
                  <Tooltip
                    title={
                      selectedTab === 0
                        ? t('components.prompts.multiRunDialog.clearAllInstances')
                        : t('components.prompts.multiRunDialog.clearInstanceNumber', { number: selectedTab })
                    }
                  >
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (isReadOnly) {
                          return
                        }
                        if (selectedTab === 0) {
                          onClearAll()
                        } else {
                          onClearInstance(selectedTab - 1)
                        }
                      }}
                      disabled={isReadOnly}
                      sx={{
                        color: '#3b82f6',
                        '&:hover': {
                          color: '#2563eb',
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        },
                      }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>

                  {/* 采纳按钮 - 只在单个实例页签时显示 */}
                  {selectedTab > 0 && (
                    <Tooltip title={t('components.prompts.multiRunDialog.adoptInstanceNumber', { number: selectedTab })}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (isReadOnly) {
                            return
                          }
                          onAdoptConversation(selectedTab - 1)
                        }}
                        disabled={isReadOnly}
                        sx={{
                          color: '#3b82f6',
                          '&:hover': {
                            color: '#2563eb',
                            backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          },
                        }}
                      >
                        <CheckCircle size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* 右侧发送按钮 */}
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={isProcessing || isReadOnly}
                  startIcon={
                    <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  }
                  sx={{
                    borderRadius: 2,
                    px: 2,
                    py: 0.5,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    fontSize: '0.875rem',
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 8px 25px rgba(59, 130, 246, 0.3)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t('components.prompts.multiRunDialog.send')}
                </Button>
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <style>{`
          @keyframes pulse {
            0% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
            100% {
              opacity: 1;
            }
          }
        `}</style>
      </Dialog>
    </>
  )
}
