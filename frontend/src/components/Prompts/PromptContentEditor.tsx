import React, { useLayoutEffect, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button, FormControl, Select, MenuItem, IconButton, Tooltip, TextField, Typography } from '@mui/material'
import { Plus, Settings, Code, GripVertical, Zap, Wrench, Copy, Trash2 } from 'lucide-react'
import FormattedPromptEditor from './AdvancedCodeMirrorEditor'
import { PromptMessage } from '@/types/promptType'

export interface PromptContentEditorProps {
  // 模板引擎相关
  templateEngine: 'normal' | 'jinja2'
  onTemplateEngineChange: (engine: 'normal' | 'jinja2') => void
  readOnly?: boolean

  // 消息相关
  promptMessages: PromptMessage[]
  onPromptMessagesChange: (messages: PromptMessage[]) => void
  messageInputValues: Record<string, string>
  onMessageInputValuesChange: (values: Record<string, string>) => void

  // 验证错误相关
  externalValidationErrors?: Record<string, string | { type?: string; loc?: any; msg?: string; input?: any; message?: string }>
  onValidationErrorsChange?: (errors: Record<string, string>) => void

  // 优化来源配置
  optimizationSource?: { type: 'main' | 'base' | 'control'; groupId?: number }

  // 当前活跃的消息ID（用于插入和选中文本反馈优化）
  currentMessageId?: string

  // 文本选择和优化相关
  selectedText?: string
  selectionPosition?: { x: number; y: number }
  isSelecting?: boolean
  showCursorOptimizeButton?: boolean
  cursorOptimizePosition?: { x: number; y: number }
  onTextSelection?: (text: string, position: { x: number; y: number }, messageId?: string) => void
  onCursorPositionChange?: (messageId: string) => (position: { x: number; y: number }, cursorPos: number) => void
  onOptimizeDialogOpen?: (optimizationSourceOverride?: any) => void
  onOptimizeInput?: (input: string) => void
  onSelectedTextChange?: (text: string) => void
  onSelectionIndicesChange?: (indices: any) => void
  onOptimizationSourceChange?: (source: any) => void
  onCurrentOptimizationTypeChange?: (type: string) => void
  onSetClickedOptimizationType?: (type: 'general' | 'select' | 'insert' | null) => void
  onOptimizingTargetChange?: (target: any) => void
  onIgnoreTextSelectionChange?: (ignore: boolean) => void
  onIgnoreTextSelectionRefChange?: (ignore: boolean) => void

  // 拖拽相关
  draggedMessageId?: string | null
  onDragStart?: (e: React.DragEvent, messageId: string) => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent, index: number) => void

  // 中文输入状态
  compositionState: Record<string, boolean>
  onCompositionStateChange: (state: Record<string, boolean>) => void

  // 其他回调
  onPromptChange?: (field: string, value: any) => void
  onCopyToClipboard?: (content: string) => Promise<void>
  onValidatePlaceholderContent?: (content: string, currentValue: string) => { isValid: boolean; hasError: boolean; originalValue: string }
  onDebouncedUpdatePlaceholderContent?: (messageId: string, index: number, content: string) => void
  onOptimizePrompt?: (target: any) => void
}

const PromptContentEditor: React.FC<PromptContentEditorProps> = ({
  templateEngine,
  onTemplateEngineChange,
  readOnly = false,
  promptMessages,
  onPromptMessagesChange,
  messageInputValues,
  onMessageInputValuesChange,
  externalValidationErrors,
  onValidationErrorsChange,
  optimizationSource = { type: 'main' },
  currentMessageId,
  selectedText,
  selectionPosition,
  isSelecting,
  showCursorOptimizeButton,
  cursorOptimizePosition,
  onTextSelection,
  onCursorPositionChange,
  onOptimizeDialogOpen,
  onOptimizeInput,
  onSelectedTextChange,
  onSelectionIndicesChange,
  onOptimizationSourceChange,
  onCurrentOptimizationTypeChange,
  onSetClickedOptimizationType,
  onOptimizingTargetChange,
  onIgnoreTextSelectionChange,
  onIgnoreTextSelectionRefChange,
  draggedMessageId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  compositionState,
  onCompositionStateChange,
  onPromptChange,
  onCopyToClipboard,
  onValidatePlaceholderContent,
  onDebouncedUpdatePlaceholderContent,
  onOptimizePrompt,
}) => {
  const { t } = useTranslation()
  const isReadOnly = !!readOnly
  const cursorButtonRef = useRef<HTMLDivElement | null>(null)
  const selectionButtonRef = useRef<HTMLDivElement | null>(null)

  // 添加防抖定时器引用，用于非 placeholder 消息
  const normalMessageUpdateTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // 添加防抖定时器引用，用于 messageInputValues 的更新（减少父组件渲染）
  const messageInputValuesUpdateTimer = useRef<NodeJS.Timeout | null>(null)
  // 用于保存防抖期间最新的 messageInputValues 值
  const pendingMessageInputValuesRef = useRef<Record<string, string>>(messageInputValues)

  // 添加防抖定时器引用，用于光标位置变化的更新（减少父组件渲染）
  const cursorPositionUpdateTimer = useRef<NodeJS.Timeout | null>(null)

  // 同步 messageInputValues 到 pendingMessageInputValuesRef（当外部值变化时）
  React.useEffect(() => {
    pendingMessageInputValuesRef.current = messageInputValues
  }, [messageInputValues])

  // 添加验证错误状态
  const [internalValidationErrors, setInternalValidationErrors] = React.useState<Record<string, string>>({})

  // 合并内部和外部的验证错误
  const validationErrors = React.useMemo(() => {
    return { ...internalValidationErrors, ...externalValidationErrors }
  }, [internalValidationErrors, externalValidationErrors])

  // 初始化时检查placeholder消息是否为空
  React.useEffect(() => {
    const newErrors: Record<string, string> = {}
    promptMessages.forEach(message => {
      if (message.role === 'placeholder') {
        const value = messageInputValues[message.id] || message.content
        if (!value.trim()) {
          newErrors[message.id] = t('components.prompts.promptContentEditor.placeholderCannotBeEmpty')
        }
      }
    })
    if (Object.keys(newErrors).length > 0) {
      setInternalValidationErrors(prev => ({ ...prev, ...newErrors }))
    }
  }, []) // 只在组件挂载时执行一次

  // 清理定时器
  useEffect(() => {
    return () => {
      // 清理所有防抖定时器
      Object.values(normalMessageUpdateTimers.current).forEach(timer => {
        clearTimeout(timer)
      })
      normalMessageUpdateTimers.current = {}
      // 清理 messageInputValues 更新定时器
      if (messageInputValuesUpdateTimer.current) {
        clearTimeout(messageInputValuesUpdateTimer.current)
        messageInputValuesUpdateTimer.current = null
      }
      // 清理光标位置更新定时器
      if (cursorPositionUpdateTimer.current) {
        clearTimeout(cursorPositionUpdateTimer.current)
        cursorPositionUpdateTimer.current = null
      }
    }
  }, [])

  // 使用 useLayoutEffect 确保按钮位置正确
  useLayoutEffect(() => {
    if (!isReadOnly && showCursorOptimizeButton && cursorOptimizePosition && cursorButtonRef.current) {
      // 重置可能影响位置的样式
      cursorButtonRef.current.style.setProperty('margin-left', '0px', 'important')
      cursorButtonRef.current.style.setProperty('margin-right', '0px', 'important')
    }
  }, [isReadOnly, showCursorOptimizeButton, cursorOptimizePosition, selectedText, selectionPosition])

  // 使用 useLayoutEffect 在 DOM 更新前调整选中反馈按钮位置
  useLayoutEffect(() => {
    if (!isReadOnly && selectedText && selectionPosition && selectionButtonRef.current) {
      const buttonRef = selectionButtonRef.current

      // 使用 selectionPosition 中已经计算好的第一行起始位置
      const firstLineStartX = selectionPosition.x

      // 获取当前容器位置
      const containerRect = buttonRef.getBoundingClientRect()
      const containerLeft = containerRect.left
      const horizontalDiff = containerLeft - firstLineStartX

      // 无论差距大小，都进行调整，确保按钮对齐到第一行起始位置
      if (Math.abs(horizontalDiff) > 1) {
        const computedStyle = window.getComputedStyle(buttonRef)
        const currentMarginLeft = parseFloat(computedStyle.marginLeft) || 0
        const targetMarginLeft = currentMarginLeft - horizontalDiff

        buttonRef.style.setProperty('margin-left', `${targetMarginLeft}px`, 'important')
      }
    }
  }, [isReadOnly, selectedText, selectionPosition])

  // 额外的 useEffect 作为备用方案，确保选中反馈按钮位置调整能执行
  useEffect(() => {
    if (!isReadOnly && selectedText && selectionPosition && selectionButtonRef.current) {
      const adjustSelectionButtonPosition = () => {
        const buttonRef = selectionButtonRef.current
        if (!buttonRef) return

        // 使用 selectionPosition 中已经计算好的第一行起始位置
        const firstLineStartX = selectionPosition.x

        const containerRect = buttonRef.getBoundingClientRect()
        const containerLeft = containerRect.left
        const horizontalDiff = containerLeft - firstLineStartX

        // 无论差距大小，都进行调整，确保按钮对齐到第一行起始位置
        if (Math.abs(horizontalDiff) > 1) {
          const computedStyle = window.getComputedStyle(buttonRef)
          const currentMarginLeft = parseFloat(computedStyle.marginLeft) || 0
          const targetMarginLeft = currentMarginLeft - horizontalDiff

          buttonRef.style.setProperty('margin-left', `${targetMarginLeft}px`, 'important')
        }
      }

      // 延迟调整，确保 DOM 已完全渲染
      setTimeout(() => {
        adjustSelectionButtonPosition()
      }, 0)

      // 使用 requestAnimationFrame 确保在下一帧再调整一次
      requestAnimationFrame(() => {
        adjustSelectionButtonPosition()
      })
    }
  }, [isReadOnly, selectedText, selectionPosition])

  const getRoleStyles = (role: string) => {
    switch (role) {
      case 'system':
        return {
          bg: 'from-blue-500 to-cyan-500',
          text: 'text-blue-700',
          border: 'border-blue-200',
          lightBg: 'bg-blue-50',
        }
      case 'user':
        return {
          bg: 'from-purple-500 to-indigo-500',
          text: 'text-purple-700',
          border: 'border-purple-200',
          lightBg: 'bg-purple-50',
        }
      case 'placeholder':
        return {
          bg: 'from-green-500 to-emerald-500',
          text: 'text-green-700',
          border: 'border-green-200',
          lightBg: 'bg-green-50',
        }
      case 'assistant':
        return {
          bg: 'from-orange-500 to-red-500',
          text: 'text-orange-700',
          border: 'border-orange-200',
          lightBg: 'bg-orange-50',
        }
      default:
        return {
          bg: 'from-gray-500 to-gray-600',
          text: 'text-gray-700',
          border: 'border-gray-200',
          lightBg: 'bg-gray-50',
        }
    }
  }

  const handleAddMessage = () => {
    if (isReadOnly) return
    const newMessage: PromptMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: '',
    }
    const newMessages = [...promptMessages, newMessage]
    onPromptMessagesChange(newMessages)
    const newValues = {
      ...messageInputValues,
      [newMessage.id]: '',
    }
    pendingMessageInputValuesRef.current = newValues
    // 立即更新父组件（添加消息操作不需要防抖）
    onMessageInputValuesChange(newValues)

    // 更新prompt.content为所有消息的组合
    const combinedContent = newMessages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')
    onPromptChange?.('content', combinedContent)

    // 添加消息后自动滚动到最下面
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container')
      if (messagesContainer) {
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: 'smooth',
        })
      }
    }, 100)
  }

  const handleMessageRoleChange = (index: number, newRole: PromptMessage['role']) => {
    if (isReadOnly) return

    // 确保创建新的数组和对象引用，触发 React 重新渲染
    const newMessages = promptMessages.map((msg, i) => (i === index ? { ...msg, role: newRole } : { ...msg }))

    onPromptMessagesChange(newMessages)
    // 更新prompt.content为所有消息的组合
    const combinedContent = newMessages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')
    onPromptChange?.('content', combinedContent)
  }

  const handleMessageDelete = (messageId: string) => {
    if (isReadOnly) return
    const newMessages = promptMessages.filter(m => m.id !== messageId)
    onPromptMessagesChange(newMessages)
    // 更新prompt.content
    const combinedContent = newMessages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')
    onPromptChange?.('content', combinedContent)
    // 清理对应的输入值
    const newInputValues = { ...messageInputValues }
    delete newInputValues[messageId]
    pendingMessageInputValuesRef.current = newInputValues
    // 立即更新父组件（删除操作不需要防抖）
    onMessageInputValuesChange(newInputValues)
  }

  const handleMessageContentChange = (messageId: string, index: number, newValue: string, message: PromptMessage) => {
    if (isReadOnly) return

    // 对placeholder类型的消息进行验证
    if (message.role === 'placeholder') {
      // 先检查是否为空
      if (!newValue.trim()) {
        setInternalValidationErrors(prev => ({
          ...prev,
          [messageId]: t('components.prompts.promptContentEditor.placeholderCannotBeEmpty'),
        }))
      } else {
        // 如果不为空，进行格式验证
        const currentValue = messageInputValues[messageId] || message.content
        const validationResult = onValidatePlaceholderContent?.(newValue, currentValue)

        if (validationResult) {
          // 更新验证错误状态，但不修改用户输入
          if (validationResult.isValid) {
            setInternalValidationErrors(prev => {
              const newErrors = { ...prev }
              delete newErrors[messageId]
              return newErrors
            })
          } else if (validationResult.hasError) {
            setInternalValidationErrors(prev => ({
              ...prev,
              [messageId]: t('components.prompts.promptContentEditor.placeholderValidationError'),
            }))
          }
        }
      }
    }

    // 直接使用用户输入的原始值，不进行任何修改
    // 使用防抖更新 messageInputValues（1000ms 防抖）
    const currentValue = messageInputValues[messageId] || message.content
    if (currentValue !== newValue) {
      // 更新待发送的值（保存最新的值）
      pendingMessageInputValuesRef.current = {
        ...pendingMessageInputValuesRef.current,
        [messageId]: newValue,
      }

      // 清除之前的定时器
      if (messageInputValuesUpdateTimer.current) {
        clearTimeout(messageInputValuesUpdateTimer.current)
      }

      // 设置新的防抖定时器
      messageInputValuesUpdateTimer.current = setTimeout(() => {
        onMessageInputValuesChange({
          ...pendingMessageInputValuesRef.current,
        })
        messageInputValuesUpdateTimer.current = null
      }, 1000)
    }

    // 如果不在输入中文，使用防抖更新
    if (!compositionState[messageId]) {
      if (message.role === 'placeholder') {
        // Placeholder消息使用防抖更新，避免频繁触发参数生成
        onDebouncedUpdatePlaceholderContent?.(messageId, index, newValue)
      } else {
        // 非placeholder消息也使用防抖更新，减少性能开销
        // 清除之前的定时器
        if (normalMessageUpdateTimers.current[messageId]) {
          clearTimeout(normalMessageUpdateTimers.current[messageId])
        }

        // 设置新的防抖定时器（300ms，比 placeholder 的 800ms 更短，保持响应性）
        normalMessageUpdateTimers.current[messageId] = setTimeout(() => {
          const newMessages = [...promptMessages]
          newMessages[index].content = newValue
          onPromptMessagesChange(newMessages)
          // 更新prompt.content为所有消息的组合
          const combinedContent = newMessages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')
          onPromptChange?.('content', combinedContent)

          // 清理定时器引用
          delete normalMessageUpdateTimers.current[messageId]
        }, 300)
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">{t('components.prompts.promptContentEditor.promptContent')}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{t('components.prompts.promptContentEditor.promptTemplate')}:</span>
            <FormControl size="small" className="min-w-[200px]" disabled={isReadOnly}>
              <Select
                value={templateEngine}
                onChange={e => onTemplateEngineChange(e.target.value as 'normal' | 'jinja2')}
                disabled={isReadOnly}
                renderValue={value => (value === 'normal' ? 'Normal' : 'Jinja2')}
                className="bg-white/80"
                sx={{
                  height: '32px',
                  fontSize: '15px',
                  '& .MuiSelect-select': {
                    padding: '6px 14px',
                    fontSize: '15px',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      '& .MuiMenuItem-root': {
                        fontSize: '12px',
                        padding: '6px 16px',
                        minHeight: 'auto',
                      },
                    },
                  },
                }}
              >
                <MenuItem value="normal">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-medium" style={{ fontSize: '12px' }}>
                        {t('components.prompts.promptContentEditor.normalTemplateEngine')}
                      </div>
                      <div className="text-xs text-gray-500" style={{ fontSize: '10px' }}>
                        {t('components.prompts.promptContentEditor.normalTemplateDescription')}
                      </div>
                    </div>
                  </div>
                </MenuItem>
                <MenuItem value="jinja2">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-green-600" />
                    <div>
                      <div className="font-medium" style={{ fontSize: '12px' }}>
                        {t('components.prompts.promptContentEditor.jinja2TemplateEngine')}
                      </div>
                      <div className="text-xs text-gray-500" style={{ fontSize: '10px' }}>
                        {t('components.prompts.promptContentEditor.jinja2TemplateDescription')}
                      </div>
                    </div>
                  </div>
                </MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>

        {/* 悬浮的优化按钮 - 选中反馈优化 */}
        {!isReadOnly && selectedText && selectionPosition && !isSelecting && (
          <div
            ref={el => {
              if (el) {
                selectionButtonRef.current = el
              }
            }}
            className="fixed z-[1600]"
            style={{
              left: `${selectionPosition.x}px`,
              top: `${selectionPosition.y}px`,
              transform: 'translate(0, -100%)', // 按钮左边缘对齐到 left 值
              marginLeft: '0', // 初始值，会被动态调整覆盖
              marginRight: '0',
              padding: '0',
            }}
            onMouseEnter={() => {
              // 当鼠标悬停时，再次尝试调整位置（作为备用方案）
              if (selectionButtonRef.current && selectionPosition) {
                // 使用 selectionPosition 中已经计算好的第一行起始位置
                const firstLineStartX = selectionPosition.x
                const containerRect = selectionButtonRef.current.getBoundingClientRect()
                const horizontalDiff = containerRect.left - firstLineStartX

                if (Math.abs(horizontalDiff) > 1) {
                  const computedStyle = window.getComputedStyle(selectionButtonRef.current)
                  const currentMarginLeft = parseFloat(computedStyle.marginLeft) || 0
                  const targetMarginLeft = currentMarginLeft - horizontalDiff
                  selectionButtonRef.current.style.setProperty('margin-left', `${targetMarginLeft}px`, 'important')
                }
              }
            }}
          >
            <Tooltip title={t('components.prompts.promptContentEditor.selectedTextOptimize')} placement="top" arrow>
              <IconButton
                size="small"
                data-testid="selection-optimize-button"
                disabled={isReadOnly}
                onMouseDown={e => {
                  e.preventDefault()
                  e.stopPropagation() // 阻止事件冒泡，防止全局点击事件清除选中文本
                  if (isReadOnly) {
                    return
                  }
                  // 设置按钮点击标记（最高优先级）
                  onSetClickedOptimizationType?.('select')
                  // 参考插入反馈优化按钮的逻辑：先设置优化源和打开对话框，最后设置优化类型
                  const selection = window.getSelection()
                  const currentSelectedText = selection ? selection.toString().trim() : ''
                  if (currentSelectedText) {
                    // 先设置选中文本，确保在打开对话框时能检测到
                    onSelectedTextChange?.(currentSelectedText)
                  }
                  // 先设置优化类型为 'select'，确保对话框打开时能正确识别
                  onCurrentOptimizationTypeChange?.('select')
                  // 不传递 optimizationSourceOverride，让 handleOptimizeDialogOpen 使用全局的 optimizationSource state
                  // 全局 state 已经在文本选中处理器中被正确设置了
                  onOptimizeDialogOpen?.(undefined)
                  onOptimizeInput?.('')
                }}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-sm"
                sx={{
                  background: 'linear-gradient(to right, #f97316, #ef4444)',
                  color: 'white',
                  '&:hover': {
                    background: 'linear-gradient(to right, #ea580c, #dc2626)',
                  },
                }}
              >
                <Zap className="w-4 h-4" />
              </IconButton>
            </Tooltip>
          </div>
        )}

        {/* 插入反馈优化按钮 */}
        {!isReadOnly &&
          showCursorOptimizeButton &&
          cursorOptimizePosition &&
          !selectedText &&
          createPortal(
            <div
              ref={cursorButtonRef}
              className="fixed z-[1600]"
              style={{
                left: `${cursorOptimizePosition.x}px`,
                top: `${cursorOptimizePosition.y}px`,
                transform: 'translate(-50%, 0)',
              }}
            >
              <Tooltip title={t('components.prompts.promptContentEditor.insertFeedbackOptimize')} placement="top" arrow>
                <IconButton
                  size="small"
                  disabled={isReadOnly}
                  onClick={() => {
                    if (isReadOnly) return
                    // 设置按钮点击标记（最高优先级）
                    onSetClickedOptimizationType?.('insert')
                    // 注意：在对比模式下，所有组共享同一个按钮状态，所以可能有多个按钮重叠显示
                    // 我们需要确保使用正确的 optimizationSource
                    // 不要使用 props 中的 optimizationSource，因为它可能属于错误的组
                    // 而是传递 undefined，让 handleOptimizeDialogOpen 使用全局的 optimizationSource state
                    // 不传递 optimizationSourceOverride，让 handleOptimizeDialogOpen 使用全局的 optimizationSource state
                    onOptimizeDialogOpen?.(undefined)
                    onOptimizeInput?.('')
                    onSelectedTextChange?.('')
                    onSelectionIndicesChange?.(null)
                    onCurrentOptimizationTypeChange?.('insert')
                  }}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-sm"
                  sx={{
                    background: 'linear-gradient(to right, #10b981, #059669)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(to right, #059669, #047857)',
                    },
                  }}
                >
                  <Zap className="w-4 h-4" />
                </IconButton>
              </Tooltip>
            </div>,
            document.body,
          )}

        {/* 消息列表 */}
        <div className="space-y-3 flex-1 overflow-y-auto relative message-list-container max-h-[calc(100vh-400px)] scrollbar-hide messages-container">
          {promptMessages.map((message, index) => {
            const roleStyles = getRoleStyles(message.role)

            return (
              <div
                key={message.id}
                className={`bg-white/80 border ${roleStyles.border} rounded-lg p-2 shadow-sm hover:shadow-sm transition-shadow ${draggedMessageId === message.id ? 'opacity-50' : ''}`}
                draggable={false}
                onDragOver={isReadOnly ? undefined : onDragOver}
                onDrop={isReadOnly ? undefined : e => onDrop?.(e, index)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`${isReadOnly ? 'cursor-not-allowed text-gray-300' : 'cursor-move text-gray-400 hover:text-gray-600'} drag-handle`}
                      draggable={!isReadOnly}
                      onDragStart={isReadOnly ? undefined : e => onDragStart?.(e, message.id)}
                      onDragEnd={isReadOnly ? undefined : onDragEnd}
                    >
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <FormControl size="small" className="min-w-[140px]" disabled={isReadOnly}>
                      <Select
                        value={message.role}
                        onChange={e => handleMessageRoleChange(index, e.target.value as PromptMessage['role'])}
                        disabled={isReadOnly}
                        renderValue={value => {
                          const roleLabels: Record<string, string> = {
                            system: 'System',
                            user: 'User',
                            placeholder: 'Placeholder',
                            assistant: 'Assistant',
                          }
                          return roleLabels[value] || value
                        }}
                        className={`${roleStyles.lightBg} ${roleStyles.text} font-medium`}
                        sx={{
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: roleStyles.border.replace('border-', ''),
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: roleStyles.text.replace('text-', ''),
                          },
                          height: '25px',
                          fontSize: '15px',
                          '& .MuiSelect-select': {
                            padding: '4px 8px',
                            fontSize: '15px',
                          },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              maxHeight: 140,
                              '& .MuiMenuItem-root': {
                                fontSize: '12px',
                                padding: '6px 16px',
                                minHeight: 'auto',
                              },
                            },
                          },
                        }}
                      >
                        <MenuItem value="system">
                          <span style={{ fontSize: '12px' }}>System</span>
                        </MenuItem>
                        <MenuItem value="user">
                          <span style={{ fontSize: '12px' }}>User</span>
                        </MenuItem>
                        <MenuItem value="assistant">
                          <span style={{ fontSize: '12px' }}>Assistant</span>
                        </MenuItem>
                        <MenuItem value="placeholder">
                          <span style={{ fontSize: '12px' }}>Placeholder</span>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </div>

                  <div className="flex items-center gap-1">
                    {message.role === 'system' && (
                      <>
                        <IconButton
                          size="small"
                          disabled={isReadOnly}
                          onClick={() => {
                            if (isReadOnly) {
                              return
                            }
                            // 创建包含当前消息ID的优化目标
                            // 确保使用当前消息的ID，不继承optimizationSource中可能存在的旧messageId
                            const targetWithMessageId = {
                              type: optimizationSource?.type || 'main',
                              groupId: optimizationSource?.groupId,
                              messageId: message.id, // 明确使用当前消息的ID
                            }
                            onOptimizingTargetChange?.(targetWithMessageId)
                            onOptimizePrompt?.(targetWithMessageId)
                          }}
                          className="text-orange-500 hover:bg-orange-50 transition-colors"
                          title={t('components.prompts.promptContentEditor.quickOptimize')}
                        >
                          <Zap className="w-4 h-4 text-blue-500 hover:bg-blue-50 transition-colors" />
                        </IconButton>

                        {/* 全文反馈优化按钮 */}
                        <IconButton
                          size="small"
                          disabled={isReadOnly}
                          onClick={e => {
                            if (isReadOnly) {
                              return
                            }
                            // 阻止事件冒泡，防止触发其他事件
                            e.stopPropagation()
                            e.preventDefault()

                            // 设置按钮点击标记（最高优先级，必须在最前面）
                            onSetClickedOptimizationType?.('general')

                            // 立即设置忽略文本选中事件标记，防止后续干扰
                            onIgnoreTextSelectionRefChange?.(true) // 立即生效的ref标记
                            onIgnoreTextSelectionChange?.(true) // React状态标记

                            // 清除选中文本和选择索引，确保是全文优化
                            onSelectedTextChange?.('')
                            onSelectionIndicesChange?.(null)
                            // 清除浏览器中的选中文本，防止被误判为选中反馈优化
                            const selection = window.getSelection()
                            if (selection) {
                              selection.removeAllRanges()
                            }

                            // 先强制设置为全文反馈优化（必须在打开对话框之前）
                            onCurrentOptimizationTypeChange?.('general')

                            // 传递包含当前消息ID的优化源信息
                            // 注意：在对比模式下，props 中的 optimizationSource 可能属于错误的组
                            // 所以我们只使用它的 type 和 groupId（这些是固定的），然后添加 messageId
                            const newOptimizationSource = { ...optimizationSource, messageId: message.id }
                            onOptimizationSourceChange?.(newOptimizationSource)

                            // 最后打开对话框和清空输入
                            onOptimizeInput?.('')
                            // 传递新的优化源信息作为参数，解决状态更新延迟问题
                            onOptimizeDialogOpen?.(newOptimizationSource)

                            // 延迟后恢复文本选中事件监听（延长恢复时间，确保对话框打开后光标位置变化事件也被忽略）
                            setTimeout(() => {
                              onIgnoreTextSelectionRefChange?.(false) // 恢复ref标记
                              onIgnoreTextSelectionChange?.(false) // 恢复React状态标记
                            }, 1000) // 延长到1000ms，确保对话框完全打开后光标位置变化事件也被忽略
                          }}
                          className="text-purple-500 hover:bg-purple-50 transition-colors"
                          title={t('components.prompts.promptContentEditor.fullTextFeedbackOptimize')}
                        >
                          <Wrench className="w-4 h-4" />
                        </IconButton>
                      </>
                    )}

                    <IconButton
                      size="small"
                      disabled={isReadOnly}
                      onClick={async () => {
                        if (isReadOnly) {
                          return
                        }
                        const content = messageInputValues[message.id] || message.content
                        try {
                          await onCopyToClipboard?.(content)
                        } catch (error) {
                          console.error(t('components.prompts.promptContentEditor.copyFailed'), error)
                        }
                      }}
                      className="text-blue-500 hover:bg-blue-50 transition-colors"
                      title={t('components.prompts.promptContentEditor.copyContent')}
                    >
                      <Copy className="w-4 h-4" />
                    </IconButton>

                    <IconButton
                      size="small"
                      disabled={isReadOnly}
                      onClick={() => {
                        if (isReadOnly) {
                          return
                        }
                        handleMessageDelete(message.id)
                      }}
                      className="text-red-500 hover:bg-red-50 transition-colors"
                      title={t('components.prompts.promptContentEditor.deleteMessage')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>

                {message.role === 'placeholder' ? (
                  <TextField
                    fullWidth
                    value={messageInputValues[message.id] || message.content}
                    onChange={e => handleMessageContentChange(message.id, index, e.target.value, message)}
                    placeholder={t('components.prompts.promptContentEditor.placeholderPlaceholder')}
                    disabled={isReadOnly}
                    error={!!validationErrors[message.id]}
                    size="small"
                    inputProps={{ maxLength: 50 }}
                    helperText={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        {validationErrors[message.id] ? (
                          <span>
                            {(() => {
                              const error = validationErrors[message.id]
                              if (typeof error === 'string') {
                                return error
                              }
                              if (typeof error === 'object' && error !== null) {
                                const errorObj = error as { msg?: string; message?: string }
                                return errorObj.msg || errorObj.message || '验证错误'
                              }
                              return '验证错误'
                            })()}
                          </span>
                        ) : (
                          <span />
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            color: (messageInputValues[message.id] || message.content).length >= 50 ? '#ef4444' : '#6b7280',
                            fontSize: '0.75rem',
                            marginLeft: 'auto',
                          }}
                        >
                          {(messageInputValues[message.id] || message.content).length}/50
                        </Typography>
                      </div>
                    }
                    FormHelperTextProps={{
                      component: 'div',
                      sx: {
                        margin: 0,
                        marginTop: '4px',
                      },
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        position: 'relative',
                        '& input': {
                          paddingRight: '8px',
                        },
                        '& fieldset': {
                          borderColor: validationErrors[message.id] ? '#ef4444' : roleStyles.border.replace('border-', ''),
                        },
                        '&:hover fieldset': {
                          borderColor: validationErrors[message.id] ? '#ef4444' : roleStyles.text.replace('text-', ''),
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: validationErrors[message.id] ? '#ef4444' : roleStyles.text.replace('text-', ''),
                        },
                      },
                    }}
                    InputProps={{
                      endAdornment: undefined,
                    }}
                  />
                ) : (
                  <FormattedPromptEditor
                    fullWidth
                    minRows={message.role === 'system' ? 20 : 1}
                    value={messageInputValues[message.id] || message.content}
                    messageId={message.id}
                    disabled={isReadOnly}
                    templateEngine={templateEngine}
                    optimizationSourceType={optimizationSource.type}
                    onTextSelection={
                      message.role === 'system'
                        ? (selectedText: string, position: { x: number; y: number }, messageId?: string) => {
                            // 设置正确的优化来源
                            onOptimizationSourceChange?.(optimizationSource)
                            // 调用原始的文本选择处理，传递消息ID
                            onTextSelection?.(selectedText, position, messageId || message.id)
                          }
                        : undefined
                    }
                    onCursorPositionChange={
                      message.role === 'system'
                        ? (position: { x: number; y: number }, cursorPos: number) => {
                            // 如果正在输入中文，跳过光标位置更新，避免频繁渲染
                            if (compositionState[message.id]) {
                              return
                            }

                            // 使用防抖更新光标位置（1000ms 防抖）
                            if (cursorPositionUpdateTimer.current) {
                              clearTimeout(cursorPositionUpdateTimer.current)
                            }

                            cursorPositionUpdateTimer.current = setTimeout(() => {
                              // 设置正确的优化来源
                              onOptimizationSourceChange?.(optimizationSource)
                              // 调用原始的光标位置处理，传递完整的参数
                              onCursorPositionChange?.(message.id)?.(position, cursorPos)
                              cursorPositionUpdateTimer.current = null
                            }, 1000)
                          }
                        : undefined
                    }
                    onChange={newValue => handleMessageContentChange(message.id, index, newValue, message)}
                    placeholder={t('components.prompts.promptContentEditor.messagePlaceholder', { role: message.role })}
                    className={`${roleStyles.lightBg}`}
                    InputProps={{
                      className: 'bg-white/60',
                      sx: {
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: roleStyles.border.replace('border-', ''),
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: roleStyles.text.replace('text-', ''),
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: roleStyles.text.replace('text-', ''),
                        },
                        '& textarea': {
                          resize: 'none',
                          overflow: 'hidden',
                        },
                      },
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* 添加消息按钮 */}
        <Button
          variant="outlined"
          startIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            if (isReadOnly) {
              return
            }
            handleAddMessage()
          }}
          className="mt-3 border-blue-300 text-blue-600 hover:bg-blue-50"
          disabled={isReadOnly}
        >
          {t('components.prompts.promptContentEditor.addMessage')}
        </Button>

        <div className="mt-2 text-xs text-gray-500">{t('components.prompts.promptContentEditor.variableHint')}</div>
      </div>
    </div>
  )
}

export default React.memo(PromptContentEditor)
