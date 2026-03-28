/**
 * BlockNote 编辑器组件
 *
 * @description
 * 使用 BlockNote 提供 Notion 风格的块级编辑体验
 * - 支持 Markdown 导入（使用内置 API）
 * - 文本选区支持
 * - 块级 AI 悬停高亮
 * - AI 改写面板
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { BlockNoteEditor as BNEditor, type Block } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { SideMenuController } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import { CustomSideMenu, AIRewritePanel, AIRewriteStatusIndicator } from './sideMenu'
import type { RewriteStatus } from '@/pages/Apps/types'
import { PANEL_TOTAL_HEIGHT, HIGHLIGHT_STYLE_ID, HIGHLIGHT_CSS } from './constants'
import { useConversationStore } from '@/stores/useConversationStore'
import { codePointIndexToUtf16Index, utf16IndexToCodePointIndex } from '@/utils/textOffset'
import { mapCleanedOffsetToOriginal, preprocessMarkdown, type BlockOffset } from '@/utils/markdownCleaner'
import type { ReportRewriteParams, ReportRewriteAction } from '@/pages/Apps/types'
import './sideMenu/styles.css'

type AnyBlock = Block<any, any, any>

// 动画阶段到 CSS 类名的映射
const PHASE_CLASS_MAP = {
  highlight: 'block-rewriting',
  fadeout: 'content-fade-out',
  fadein: 'content-fade-in',
  success: 'content-replace-success',
  error: 'content-replace-error',
} as const

type AnimationPhase = keyof typeof PHASE_CLASS_MAP

export interface BlockNoteEditorProps {
  /** 预处理后的内容（用于显示） */
  content: string
  /** 原始内容（含 citation 标记） */
  rawContent?: string
  /** 偏移量映射 */
  offsetMap?: number[]
  /** 块位置信息 */
  blockOffsets?: BlockOffset[]
  /** 是否只读 */
  readonly?: boolean
  /** 内容变化回调 */
  onChange?: (markdown: string) => void
  /** 选区变化回调 */
  onSelectionChange?: (selectedText: string, range: Range | null) => void
  /** 自定义类名 */
  className?: string
  /** 滚动容器引用 */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  /** 会话 ID（用于 AI 改写） */
  conversationId?: string
  /** 报告局部改写回调（注入到原始对话流） */
  onReportRewrite?: (params: ReportRewriteParams) => Promise<void>
}

export const BlockNoteEditor: React.FC<BlockNoteEditorProps> = ({
  content,
  rawContent,
  offsetMap = [],
  blockOffsets = [],
  readonly = false,
  onChange: _onChange,
  onSelectionChange,
  className = '',
  scrollContainerRef,
  conversationId: propConversationId,
  onReportRewrite,
}) => {
  const [isInitialized, setIsInitialized] = useState(false)

  const storeConversationId = useConversationStore(state => state.currentConversationId)
  const conversationId = propConversationId || storeConversationId

  // 获取剩余改写次数
  const selectedResultMessageId = useConversationStore(state => state.selectedResultMessageId)
  const messagesMap = useConversationStore(state => state.messagesMap)
  const messageItemsMap = useConversationStore(state => state.messageItemsMap)

  const remainingRewriteRounds = useMemo(() => {
    if (!selectedResultMessageId) return undefined
    const message = messagesMap.get(selectedResultMessageId)
    if (!message?.messageItemsId) return undefined
    const messageItems = messageItemsMap.get(message.messageItemsId)
    return messageItems?.remainingRewriteRounds
  }, [selectedResultMessageId, messagesMap, messageItemsMap])

  const [showRewritePanel, setShowRewritePanel] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState<AnyBlock | null>(null)
  const [selectedText, setSelectedText] = useState<string>('')

  // AI 改写状态
  const [rewriteStatus, setRewriteStatus] = useState<RewriteStatus>('idle')
  const [rewriteErrorMessage, setRewriteErrorMessage] = useState<string | undefined>()

  /**
   * 应用块过渡动画
   */
  const applyBlockTransition = useCallback((blockId: string, phase: AnimationPhase) => {
    const blockElement = document.querySelector(`[data-id="${blockId}"]`)
    if (!blockElement) return

    blockElement.classList.remove(...Object.values(PHASE_CLASS_MAP))
    blockElement.classList.add(PHASE_CLASS_MAP[phase])
  }, [])

  const [baselineContent, setBaselineContent] = useState(content)
  const rawContentRef = useRef(rawContent || content)
  const offsetMapRef = useRef<number[]>(offsetMap)
  const blockOffsetsRef = useRef<BlockOffset[]>(blockOffsets)

  // 改写过程中锁定内容，防止父组件更新导致的重新渲染
  const [isRewriting, setIsRewriting] = useState(false)
  const pendingContentRef = useRef<{ cleaned: string; raw: string; offsetMap: number[] } | null>(null)

  useEffect(() => {
    rawContentRef.current = rawContent || content
    offsetMapRef.current = offsetMap
    blockOffsetsRef.current = blockOffsets
  }, [rawContent, content, offsetMap, blockOffsets])

  // 只有在非改写状态下才更新 baselineContent
  useEffect(() => {
    if (isRewriting) {
      // 改写中，缓存新内容，等改写结束后再应用
      pendingContentRef.current = {
        cleaned: content,
        raw: rawContent || content,
        offsetMap: offsetMap
      }
      return
    }

    setBaselineContent(content)
  }, [content, rawContent, offsetMap, isRewriting])

  const styleElRef = useRef<HTMLStyleElement | null>(null)

  useEffect(() => {
    if (selectedBlock?.id) {
      let styleEl = document.getElementById(HIGHLIGHT_STYLE_ID) as HTMLStyleElement | null
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = HIGHLIGHT_STYLE_ID
        document.head.appendChild(styleEl)
      }
      styleElRef.current = styleEl
      styleElRef.current.innerHTML = `[data-node-type="blockOuter"][data-id="${selectedBlock.id}"] { ${HIGHLIGHT_CSS} }`
    } else {
      if (styleElRef.current) {
        styleElRef.current.innerHTML = ''
      }
    }
  }, [selectedBlock?.id])

  useEffect(() => {
    return () => {
      if (styleElRef.current) {
        styleElRef.current.innerHTML = ''
      }
    }
  }, [])

  const editor = useMemo(() => {
    const instance = BNEditor.create({
      initialContent: [
        {
          type: 'paragraph',
          props: {},
        },
      ],
      codeBlock: {
        createHighlighter: async () => {
          return {
            codeToHtml: (code: string) => `<pre><code>${code}</code></pre>`,
          }
        },
      },
    })
    setIsInitialized(true)
    return instance
  }, [])

  useEffect(() => {
    if (editor && baselineContent) {
      try {
        const blocks = editor.tryParseMarkdownToBlocks(baselineContent)
        if (blocks && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks)
        }
      } catch (err) {
        console.warn('[BlockNoteEditor] Failed to parse markdown:', err)
      }
    }
  }, [editor, baselineContent])

  useEffect(() => {
    if (!onSelectionChange) return

    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) {
          const text = selection.toString().trim()
          if (text) {
            const range = selection.getRangeAt(0)
            onSelectionChange(text, range)
          }
        }
      }, 10)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [onSelectionChange])

  const handleOpenRewritePanel = useCallback((block: AnyBlock) => {
    /**
     * 获取选中文本（带 Markdown 格式）
     *
     * 问题：window.getSelection().toString() 返回纯文本，不包含 Markdown 语法
     * 例如：选中加粗的 "18.79万辆" 时，返回 "18.79万辆" 而不是 "**18.79万辆**"
     *
     * 解决方案：使用 BlockNote API 获取带格式的 Markdown
     * 1. editor.getSelectionCutBlocks() 获取选中的部分块（支持部分选中）
     * 2. editor.blocksToMarkdownLossy() 将块转换为 Markdown 格式
     */
    const domSelection = window.getSelection()
    let plainText = domSelection?.toString().trim() || ''
    let markdownText = plainText

    // 使用 BlockNote API 获取带格式的选中文本
    try {
      const selectionCutBlocks = editor.getSelectionCutBlocks()
      if (selectionCutBlocks?.blocks?.length > 0 && plainText) {
        // 将选中的块转换为 Markdown（包含格式语法如 **粗体**）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        markdownText = editor.blocksToMarkdownLossy(selectionCutBlocks.blocks as any).trim()
      }
    } catch (e) {
      console.warn('[BlockNoteEditor] 获取 BlockNote 选区失败，回退到 DOM 选区:', e)
    }

    // 如果没有选中文本，使用整个块的内容
    if (!plainText) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markdownText = editor.blocksToMarkdownLossy([block] as any).trim()
      const blockElement = document.querySelector(`[data-id="${block.id}"]`)
      plainText = blockElement?.textContent?.trim() || ''
    }

    // 计算偏移量
    const currentRawContent = rawContentRef.current
    const currentOffsetMap = offsetMapRef.current

    const cleanedStart = baselineContent.indexOf(markdownText)
    if (cleanedStart === -1) {
      console.warn('[BlockNoteEditor] 未找到文本匹配，无法计算偏移量')
    }

    setSelectedBlock(block)
    setSelectedText(markdownText)
    setShowRewritePanel(true)

    if (scrollContainerRef?.current) {
      const blockElement = document.querySelector(`[data-id="${block.id}"]`) as HTMLElement
      if (blockElement) {
        const containerRect = scrollContainerRef.current.getBoundingClientRect()
        const blockRect = blockElement.getBoundingClientRect()
        const panelHeight = PANEL_TOTAL_HEIGHT

        const spaceBelow = containerRect.bottom - blockRect.bottom

        if (spaceBelow < panelHeight) {
          const scrollNeeded = panelHeight - spaceBelow
          scrollContainerRef.current.scrollTop += scrollNeeded
        }
      }
    }
  }, [scrollContainerRef])

  const handleCloseRewritePanel = useCallback(() => {
    setShowRewritePanel(false)
    setSelectedBlock(null)
    setSelectedText('')
  }, [])

  const handleSubmitRewrite = useCallback(async (action: ReportRewriteAction, prompt?: string) => {
    if (!selectedText) {
      console.warn('[BlockNoteEditor] 没有选中文本，无法执行改写')
      return
    }

    if (!conversationId) {
      console.warn('[BlockNoteEditor] 没有 conversationId，无法执行改写')
      return
    }

    // 保存当前块 ID 用于动画
    const currentBlockId = selectedBlock?.id

    // 立即关闭面板
    handleCloseRewritePanel()

    // 锁定编辑器，防止父组件更新导致的重新渲染
    setIsRewriting(true)
    pendingContentRef.current = null

    // 设置思考状态
    setRewriteStatus('thinking')
    setRewriteErrorMessage(undefined)

    // 应用高亮动画
    if (currentBlockId) {
      applyBlockTransition(currentBlockId, 'highlight')
    }

    const currentRawContent = rawContentRef.current
    const currentOffsetMap = offsetMapRef.current

    const cleanedStart = baselineContent.indexOf(selectedText)
    if (cleanedStart === -1) {
      console.warn('[BlockNoteEditor] 未找到文本匹配')
      setRewriteStatus('error')
      setRewriteErrorMessage('未找到文本匹配')
      setIsRewriting(false)
      return
    }
    const cleanedEnd = cleanedStart + selectedText.length

    const { originalStart, originalEnd } = mapCleanedOffsetToOriginal(
      cleanedStart,
      cleanedEnd,
      currentOffsetMap
    )

    const originalText = currentRawContent.slice(originalStart, originalEnd)

    const startCodePoint = utf16IndexToCodePointIndex(currentRawContent, originalStart)
    const endCodePoint = utf16IndexToCodePointIndex(currentRawContent, originalEnd)

    if (onReportRewrite) {
      let currentContent = currentRawContent
      let hasAppliedFirstDelta = false

      await onReportRewrite({
        action,
        selectedText: originalText,
        startOffset: startCodePoint,
        endOffset: endCodePoint,
        userInstruction: prompt,
        conversationId,
        blockId: currentBlockId,
        onStatusChange: (status) => {
          setRewriteStatus(status)
        },
        onDelta: (delta) => {
          // 第一次收到 delta 时应用淡出动画
          if (!hasAppliedFirstDelta && currentBlockId) {
            applyBlockTransition(currentBlockId, 'fadeout')
            hasAppliedFirstDelta = true
          }

          const startUtf16 = codePointIndexToUtf16Index(currentContent, delta.original_start_offset)
          const endUtf16 = codePointIndexToUtf16Index(currentContent, delta.original_end_offset)

          // 更新本地内容
          currentContent =
            currentContent.slice(0, startUtf16) +
            delta.rewritten_text +
            currentContent.slice(endUtf16)

          // 同步更新 rawContentRef
          rawContentRef.current = currentContent
        },
        onSnapshot: (snapshot) => {
          currentContent = snapshot.response_content
          rawContentRef.current = currentContent
        },
        onEnd: () => {
          // 1. 先解除锁定，让 useEffect 可以更新编辑器
          setIsRewriting(false)

          // 2. 如果有缓存的新内容（来自父组件），优先使用
          if (pendingContentRef.current) {
            rawContentRef.current = pendingContentRef.current.raw
            offsetMapRef.current = pendingContentRef.current.offsetMap
            setBaselineContent(pendingContentRef.current.cleaned)
            pendingContentRef.current = null
          } else {
            // 3. 否则使用 onSnapshot 更新的 rawContentRef 重新计算 cleaned
            const { cleaned: newCleaned, offsetMap: newOffsetMap } = preprocessMarkdown(rawContentRef.current)
            offsetMapRef.current = newOffsetMap
            setBaselineContent(newCleaned)
          }

          // 4. 等待 DOM 更新后应用动画
          requestAnimationFrame(() => {
            // 先应用淡入动画
            if (currentBlockId) {
              applyBlockTransition(currentBlockId, 'fadein')
            }

            // 延迟后应用成功闪烁动画
            setTimeout(() => {
              setRewriteStatus('idle')
              if (currentBlockId) {
                applyBlockTransition(currentBlockId, 'success')
              }
            }, 400) // fadein 动画持续时间
          })
        },
        onError: (err) => {
          console.error('[BlockNoteEditor] 改写错误:', err)
          setRewriteStatus('error')
          setRewriteErrorMessage(err)

          // 解除锁定
          setIsRewriting(false)
          pendingContentRef.current = null

          // 应用错误闪烁动画
          if (currentBlockId) {
            applyBlockTransition(currentBlockId, 'error')
          }
        },
      })
    } else {
      console.warn('[BlockNoteEditor] onReportRewrite 未提供，无法执行改写')
      setRewriteStatus('idle')
      setIsRewriting(false)
    }
  }, [selectedBlock, selectedText, baselineContent, onReportRewrite, conversationId, handleCloseRewritePanel, applyBlockTransition, editor])

  if (!isInitialized || !editor) {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-11/12"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-4/5"></div>
      </div>
    )
  }

  return (
    <div
      className={`blocknote-editor-wrapper ${className}`}
      style={{
        width: '100%',
        minHeight: '200px',
      }}
    >
      <BlockNoteView
        editor={editor}
        editable={!readonly}
        theme="light"
        sideMenu={false}
        formattingToolbar={false}
        linkToolbar={false}
        slashMenu={false}
      >
        <SideMenuController
          sideMenu={() => (
            (showRewritePanel || isRewriting) ? null : (
              <CustomSideMenu onOpenRewritePanel={handleOpenRewritePanel} />
            )
          )}
        />
      </BlockNoteView>
      {showRewritePanel && selectedBlock && (
        <AIRewritePanel
          block={selectedBlock}
          editor={editor}
          onClose={handleCloseRewritePanel}
          onSubmit={handleSubmitRewrite}
          remainingRewriteRounds={remainingRewriteRounds}
        />
      )}

      {/* AI 改写状态指示器 */}
      <AIRewriteStatusIndicator
        status={rewriteStatus}
        visible={rewriteStatus !== 'idle'}
        errorMessage={rewriteErrorMessage}
      />
    </div>
  )
}
