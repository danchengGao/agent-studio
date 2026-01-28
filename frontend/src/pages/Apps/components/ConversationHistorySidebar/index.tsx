import React, { useEffect, useState, useRef } from 'react'
import { Plus, ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react'
import { useConversationStore } from '../../../../stores/useConversationStore'
import { RADIUS_BUTTON, BUTTON_HOVER_EFFECTS, BUTTON_TRANSITION, RADIUS_CIRCLE } from '../../constants/styles'
import ConversationList from './ConversationList'
import type { ConversationHistorySidebarProps } from './types'

// Local storage key for sidebar collapsed state
const SIDEBAR_COLLAPSED_KEY = 'deepsearch_sidebar_collapsed'

// 超时时间：60分钟
const STREAMING_TIMEOUT = 60 * 60 * 1000

const ConversationHistorySidebar: React.FC<ConversationHistorySidebarProps> = ({
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  isStreaming,
  forceCollapsed = false,
}) => {
  // 超时检测状态
  const [showForceStop, setShowForceStop] = useState(false)
  const streamingStartTimeRef = useRef<number | null>(null)

  // 监听 isStreaming 变化，记录开始时间
  useEffect(() => {
    if (isStreaming && !streamingStartTimeRef.current) {
      // 开始传输
      streamingStartTimeRef.current = Date.now()
      setShowForceStop(false)
    } else if (!isStreaming && streamingStartTimeRef.current) {
      // 传输结束
      streamingStartTimeRef.current = null
      setShowForceStop(false)
    }
  }, [isStreaming])

  // 检测超时
  useEffect(() => {
    if (!isStreaming || !streamingStartTimeRef.current) return

    const checkTimeout = () => {
      if (streamingStartTimeRef.current) {
        const elapsed = Date.now() - streamingStartTimeRef.current
        if (elapsed > STREAMING_TIMEOUT) {
          setShowForceStop(true)
        }
      }
    }

    // 每秒检查一次
    const intervalId = setInterval(checkTimeout, 1000)

    return () => clearInterval(intervalId)
  }, [isStreaming])

  // 强制中断
  const handleForceStop = () => {
    const { abortController } = useConversationStore.getState() as any
    if (abortController) {
      abortController.abort()
    }
    setShowForceStop(false)
    streamingStartTimeRef.current = null
  }

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mainSidebarWidth, setMainSidebarWidth] = useState(260)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const savedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true')
    }
  }, [])

  // 自动收起：当 forceCollapsed 为 true 时，自动收起侧边栏
  useEffect(() => {
    if (forceCollapsed) {
      setIsCollapsed(true)
    }
  }, [forceCollapsed])

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    if (!forceCollapsed) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed))
    }
  }, [isCollapsed, forceCollapsed])

  // 实时监听主侧边栏的宽度变化
  useEffect(() => {
    const mainSidebar = document.querySelector('.lg\\:w-16, .lg\\:w-65') as HTMLElement
    if (!mainSidebar) return

    const updateWidth = () => {
      const width = mainSidebar.getBoundingClientRect().width
      setMainSidebarWidth(width)
    }

    // 初始宽度
    updateWidth()

    // 监听窗口大小变化
    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(mainSidebar)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const handleDeleteConversation = async (conversationId: string) => {
    const { deleteConversation } = useConversationStore.getState()
    await deleteConversation(conversationId)
  }

  // 按钮始终与主侧边栏保持 8px 间距
  const buttonLeftStyle = { left: mainSidebarWidth + 8 }

  // 统一的图标按钮样式
  const iconButtonClass = `
    flex items-center justify-center
    text-gray-500 hover:text-gray-700
    ${BUTTON_HOVER_EFFECTS}
    ${RADIUS_BUTTON}
    ${BUTTON_TRANSITION}
  `

  // 收起状态的展开按钮样式（圆形）
  const collapsedExpandButtonClass = `
    w-10 h-10 flex items-center justify-center
    bg-white ${RADIUS_CIRCLE}
    border border-gray-200 shadow-sm
    text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50
    ${BUTTON_TRANSITION}
    hover:scale-110 active:scale-95
  `

  if (isCollapsed) {
    // 收起状态：中间显示一个 > 按钮用于展开
    // 按钮位置根据主侧边栏状态动态调整，保持固定间距
    return (
      <>
        {/* 收起状态不占用布局空间 */}
        <div className="w-0 h-full" />

        {/* 展开按钮 - fixed 定位，垂直居中 */}
        <div
          className="fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300"
          style={buttonLeftStyle}
        >
          <button
            onClick={() => setIsCollapsed(false)}
            className={collapsedExpandButtonClass}
            title="展开对话历史"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </>
    )
  }

  // Expanded state - full sidebar
  return (
    <div className="flex flex-col bg-gray-50 border-r border-gray-200 w-[260px] h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-bold text-gray-700">所有对话</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* New conversation button */}
          <button
            onClick={onNewConversation}
            disabled={isStreaming}
            className={`${iconButtonClass} w-10 h-10 ${
              isStreaming ? 'cursor-not-allowed opacity-50' : ''
            }`}
            title={isStreaming ? '对话进行中，请稍候...' : '发起新对话'}
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Collapse button */}
          <button
            onClick={() => setIsCollapsed(true)}
            className={`${iconButtonClass} w-10 h-10`}
            title="收起对话历史"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <ConversationList
        currentConversationId={currentConversationId}
        onConversationSelect={onConversationSelect}
        onDeleteConversation={handleDeleteConversation}
        isStreaming={isStreaming}
      />

      {/* Force stop button - 只在超时时显示 */}
      {showForceStop && (
        <div className="px-4 py-3 border-t border-gray-200">
          <button
            onClick={handleForceStop}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors duration-200 text-sm font-medium"
            title="对话已超时，强制中断当前传输"
          >
            <AlertCircle className="w-4 h-4" />
            <span>强制中断</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default ConversationHistorySidebar
