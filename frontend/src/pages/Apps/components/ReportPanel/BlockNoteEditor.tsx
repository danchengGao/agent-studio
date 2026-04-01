import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BlockNoteEditor as BNEditor, type Block } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { SideMenuController } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { CustomSideMenu, AIRewritePanel, AIRewriteStatusIndicator } from './sideMenu'
import type { RewriteStatus } from '@/pages/Apps/types'
import { PANEL_TOTAL_HEIGHT, HIGHLIGHT_CSS, HIGHLIGHT_STYLE_ID } from './constants'
import { useConversationStore } from '@/stores/useConversationStore'
import { codePointIndexToUtf16Index, utf16IndexToCodePointIndex, findAllOccurrencesUtf16 } from '@/utils/textOffset'
import {
  buildVisibleProjection,
  mapCleanedOffsetToOriginal,
  normalizeProblematicStrongPercentForRender,
  preprocessMarkdown,
  type BlockOffset,
  type VisibleProjectionResult,
} from '@/utils/markdownCleaner'
import type { ReportRewriteAction, ReportRewriteParams } from '@/pages/Apps/types'
import './sideMenu/styles.css'

type AnyBlock = Block<any, any, any>

type SelectionSnapshot = {
  text: string
  range: Range | null
  startBlockId: string | null
  endBlockId: string | null
  startOffsetInStartBlock: number
  endOffsetInEndBlock: number
}

type BlockAlignment = {
  blockId: string
  text: string
  visibleStart: number
  visibleEnd: number
}

type ResolvedSelection = {
  originalStart: number
  originalEnd: number
  originalText: string
}

const BLOCK_OUTER_SELECTOR = '[data-node-type="blockOuter"][data-id]'

const PHASE_CLASS_MAP = {
  highlight: 'block-rewriting',
  fadeout: 'content-fade-out',
  fadein: 'content-fade-in',
  success: 'content-replace-success',
  error: 'content-replace-error',
} as const

type AnimationPhase = keyof typeof PHASE_CLASS_MAP

export interface BlockNoteEditorProps {
  content: string
  rawContent?: string
  offsetMap?: number[]
  blockOffsets?: BlockOffset[]
  readonly?: boolean
  onChange?: (markdown: string) => void
  onSelectionChange?: (selectedText: string, range: Range | null) => void
  className?: string
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  conversationId?: string
  onReportRewrite?: (params: ReportRewriteParams) => Promise<void>
}

const normalizeText = (text: string) =>
  text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00A0/g, ' ')

const getTextPreview = (text: string, maxLength = 120) => {
  const escaped = normalizeText(text).replace(/\n/g, '\\n')
  return escaped.length > maxLength ? `${escaped.slice(0, maxLength)}...` : escaped
}

const getEditorElement = (wrapper: HTMLDivElement | null) =>
  wrapper?.querySelector('.bn-editor') as HTMLDivElement | null

const getBlockElement = (blockId: string, root: ParentNode = document) =>
  root.querySelector(
    `[data-node-type="blockOuter"][data-id="${blockId}"]`
  ) as HTMLElement | null

const getEditorBlockElements = (editorElement: HTMLElement) =>
  Array.from(editorElement.querySelectorAll<HTMLElement>(BLOCK_OUTER_SELECTOR))

const getClosestBlockElement = (node: Node | null) => {
  if (!node) {
    return null
  }

  let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.dataset.id &&
      current.matches(BLOCK_OUTER_SELECTOR)
    ) {
      return current
    }
    current = current.parentNode
  }

  return null
}

const getBlockVisibleText = (blockElement: HTMLElement) =>
  normalizeText(blockElement.innerText || blockElement.textContent || '').trim()

const getVisibleOffsetFromBlockStart = (
  blockElement: HTMLElement,
  container: Node,
  offset: number
) => {
  const range = document.createRange()
  range.setStart(blockElement, 0)
  range.setEnd(container, offset)
  return normalizeText(range.toString()).length
}

const trimSelectionSnapshot = (snapshot: SelectionSnapshot): SelectionSnapshot | null => {
  const leadingWhitespace = snapshot.text.match(/^\s+/)?.[0].length ?? 0
  const trailingWhitespace = snapshot.text.match(/\s+$/)?.[0].length ?? 0
  const trimmedText = snapshot.text.trim()

  if (!trimmedText) {
    return null
  }

  return {
    ...snapshot,
    text: trimmedText,
    startOffsetInStartBlock: snapshot.startOffsetInStartBlock + leadingWhitespace,
    endOffsetInEndBlock: snapshot.endOffsetInEndBlock - trailingWhitespace,
  }
}

const createSelectionSnapshotFromRange = (range: Range): SelectionSnapshot | null => {
  const rawText = normalizeText(range.toString())
  if (!rawText.trim()) {
    return null
  }

  const startBlockElement = getClosestBlockElement(range.startContainer)
  const endBlockElement = getClosestBlockElement(range.endContainer)

  if (!startBlockElement || !endBlockElement) {
    return null
  }

  const snapshot: SelectionSnapshot = {
    text: rawText,
    range: range.cloneRange(),
    startBlockId: startBlockElement.dataset.id || null,
    endBlockId: endBlockElement.dataset.id || null,
    startOffsetInStartBlock: getVisibleOffsetFromBlockStart(
      startBlockElement,
      range.startContainer,
      range.startOffset
    ),
    endOffsetInEndBlock: getVisibleOffsetFromBlockStart(
      endBlockElement,
      range.endContainer,
      range.endOffset
    ),
  }

  return trimSelectionSnapshot(snapshot)
}

const createSelectionSnapshotFromBlock = (blockElement: HTMLElement): SelectionSnapshot | null => {
  const text = getBlockVisibleText(blockElement)
  if (!text) {
    return null
  }

  return {
    text,
    range: null,
    startBlockId: blockElement.dataset.id || null,
    endBlockId: blockElement.dataset.id || null,
    startOffsetInStartBlock: 0,
    endOffsetInEndBlock: text.length,
  }
}

const projectRawTextToVisible = (rawText: string) => {
  const { cleaned, offsetMap } = preprocessMarkdown(rawText)
  return buildVisibleProjection(cleaned, offsetMap).visibleText
}

const buildWhitespaceNormalizedProjection = (
  projection: VisibleProjectionResult
) => {
  const textParts: string[] = []
  const normalizedToOriginalMap: number[] = []
  let pendingWhitespaceOffset: number | null = null

  for (let i = 0; i < projection.visibleText.length; i++) {
    const ch = projection.visibleText[i]
    const originalOffset = projection.visibleToOriginalMap[i]

    if (/\s/.test(ch)) {
      if (textParts.length > 0 && pendingWhitespaceOffset === null) {
        pendingWhitespaceOffset = originalOffset
      }
      continue
    }

    if (pendingWhitespaceOffset !== null) {
      textParts.push(' ')
      normalizedToOriginalMap.push(pendingWhitespaceOffset)
      pendingWhitespaceOffset = null
    }

    textParts.push(ch)
    normalizedToOriginalMap.push(originalOffset)
  }

  return {
    text: textParts.join(''),
    normalizedToOriginalMap,
  }
}

const normalizeSearchText = (text: string) => normalizeText(text).replace(/\s+/g, ' ').trim()

const renderMarkdownToHTML = (markdown: string) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath, { singleDollarTextMath: true })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeStringify)
      .processSync(normalizeProblematicStrongPercentForRender(markdown))
  )

const alignTargetBlocks = (
  editorElement: HTMLElement,
  projection: VisibleProjectionResult,
  targetBlockIds: string[]
) => {
  const targetSet = new Set(targetBlockIds.filter(Boolean))
  const alignments = new Map<string, BlockAlignment>()
  let cursor = 0
  let firstFailedBlockId: string | null = null
  let firstFailedBlockText: string | null = null

  for (const blockElement of getEditorBlockElements(editorElement)) {
    const blockId = blockElement.dataset.id
    const blockText = getBlockVisibleText(blockElement)

    if (!blockId || !blockText) {
      continue
    }

    const matchIndex = projection.visibleText.indexOf(blockText, cursor)
    if (matchIndex === -1) {
      if (!firstFailedBlockId) {
        firstFailedBlockId = blockId
        firstFailedBlockText = blockText
      }
      if (targetSet.has(blockId)) {
        break
      }
      continue
    }

    alignments.set(blockId, {
      blockId,
      text: blockText,
      visibleStart: matchIndex,
      visibleEnd: matchIndex + blockText.length,
    })
    cursor = matchIndex + blockText.length

    const foundAllTargets = Array.from(targetSet).every(targetId => alignments.has(targetId))
    if (foundAllTargets) {
      break
    }
  }

  return {
    alignments,
    failedBlockId: firstFailedBlockId,
    failedBlockText: firstFailedBlockText,
  }
}

const resolveSelectionFromBlocks = (
  editorElement: HTMLElement,
  projection: VisibleProjectionResult,
  snapshot: SelectionSnapshot,
  rawContent: string
): ResolvedSelection | null => {
  const targetBlockIds = [snapshot.startBlockId, snapshot.endBlockId].filter(
    (blockId): blockId is string => !!blockId
  )

  if (targetBlockIds.length === 0) {
    return null
  }

  const { alignments, failedBlockId, failedBlockText } = alignTargetBlocks(
    editorElement,
    projection,
    targetBlockIds
  )
  const startAlignment = snapshot.startBlockId ? alignments.get(snapshot.startBlockId) : undefined
  const endAlignment = snapshot.endBlockId ? alignments.get(snapshot.endBlockId) : undefined

  if (!startAlignment || !endAlignment) {
    console.warn('[BlockNoteEditor] block 对齐未命中，继续尝试后续映射策略', {
      startBlockId: snapshot.startBlockId,
      endBlockId: snapshot.endBlockId,
      failedBlockId,
      failedBlockText: getTextPreview(failedBlockText || ''),
    })
    return null
  }

  const startLocalOffset = Math.max(0, Math.min(snapshot.startOffsetInStartBlock, startAlignment.text.length))
  const endLocalOffset = Math.max(0, Math.min(snapshot.endOffsetInEndBlock, endAlignment.text.length))
  const globalVisibleStart = startAlignment.visibleStart + startLocalOffset
  const globalVisibleEnd = endAlignment.visibleStart + endLocalOffset

  if (
    globalVisibleStart < 0 ||
    globalVisibleEnd <= globalVisibleStart ||
    globalVisibleEnd > projection.visibleToOriginalMap.length
  ) {
    console.warn('[BlockNoteEditor] 基于 block 对齐后的 visible offset 非法', {
      startBlockId: snapshot.startBlockId,
      endBlockId: snapshot.endBlockId,
      globalVisibleStart,
      globalVisibleEnd,
    })
    return null
  }

  const originalStart = projection.visibleToOriginalMap[globalVisibleStart]
  const originalEnd = projection.visibleToOriginalMap[globalVisibleEnd - 1] + 1
  const originalText = rawContent.slice(originalStart, originalEnd)
  const actualVisibleText = normalizeText(projectRawTextToVisible(originalText)).trim()
  const expectedVisibleText = normalizeText(snapshot.text)

  if (actualVisibleText !== expectedVisibleText) {
    console.warn('[BlockNoteEditor] block 对齐后文本校验失败', {
      expectedVisibleText: getTextPreview(expectedVisibleText),
      actualVisibleText: getTextPreview(actualVisibleText),
      expectedLength: expectedVisibleText.length,
      actualLength: actualVisibleText.length,
      startBlockId: snapshot.startBlockId,
      endBlockId: snapshot.endBlockId,
      globalVisibleStart,
      globalVisibleEnd,
    })
    return null
  }

  return {
    originalStart,
    originalEnd,
    originalText,
  }
}

const resolveSelectionByUniqueVisibleText = (
  projection: VisibleProjectionResult,
  snapshot: SelectionSnapshot,
  rawContent: string
): ResolvedSelection | null => {
  const occurrences = findAllOccurrencesUtf16(projection.visibleText, snapshot.text, false).map(o => o.startUtf16)
  if (occurrences.length !== 1) {
    return null
  }

  const visibleStart = occurrences[0]
  const visibleEnd = visibleStart + snapshot.text.length
  const originalStart = projection.visibleToOriginalMap[visibleStart]
  const originalEnd = projection.visibleToOriginalMap[visibleEnd - 1] + 1
  const originalText = rawContent.slice(originalStart, originalEnd)
  const actualVisibleText = normalizeText(projectRawTextToVisible(originalText)).trim()
  const expectedVisibleText = normalizeText(snapshot.text)

  if (actualVisibleText !== expectedVisibleText) {
    return null
  }

  return {
    originalStart,
    originalEnd,
    originalText,
  }
}

const resolveSelectionByNormalizedVisibleText = (
  projection: VisibleProjectionResult,
  snapshot: SelectionSnapshot,
  rawContent: string
): ResolvedSelection | null => {
  const normalizedProjection = buildWhitespaceNormalizedProjection(projection)
  const normalizedSelectionText = normalizeSearchText(snapshot.text)

  if (!normalizedSelectionText) {
    return null
  }

  const occurrences = findAllOccurrencesUtf16(normalizedProjection.text, normalizedSelectionText, false).map(o => o.startUtf16)
  if (occurrences.length !== 1) {
    return null
  }

  const normalizedStart = occurrences[0]
  const normalizedEnd = normalizedStart + normalizedSelectionText.length
  const originalStart = normalizedProjection.normalizedToOriginalMap[normalizedStart]
  const originalEnd = normalizedProjection.normalizedToOriginalMap[normalizedEnd - 1] + 1
  const originalText = rawContent.slice(originalStart, originalEnd)
  const actualVisibleText = normalizeSearchText(projectRawTextToVisible(originalText))

  if (actualVisibleText !== normalizedSelectionText) {
    console.warn('[BlockNoteEditor] 空白归一化匹配命中后校验失败', {
      expectedVisibleText: getTextPreview(normalizedSelectionText),
      actualVisibleText: getTextPreview(actualVisibleText),
      expectedLength: normalizedSelectionText.length,
      actualLength: actualVisibleText.length,
    })
    return null
  }

  return {
    originalStart,
    originalEnd,
    originalText,
  }
}

const resolveSelectionByLegacyCleanedMatch = (
  cleanedContent: string,
  offsetMap: number[],
  snapshot: SelectionSnapshot,
  rawContent: string
): ResolvedSelection | null => {
  const cleanedStart = cleanedContent.indexOf(snapshot.text)
  if (cleanedStart === -1) {
    return null
  }

  const cleanedEnd = cleanedStart + snapshot.text.length
  const { originalStart, originalEnd } = mapCleanedOffsetToOriginal(cleanedStart, cleanedEnd, offsetMap)
  const originalText = rawContent.slice(originalStart, originalEnd)

  return {
    originalStart,
    originalEnd,
    originalText,
  }
}

export const BlockNoteEditor: React.FC<BlockNoteEditorProps> = ({
  content,
  rawContent,
  offsetMap = [],
  blockOffsets: _blockOffsets = [],
  readonly = false,
  onChange: _onChange,
  onSelectionChange,
  className = '',
  scrollContainerRef,
  conversationId: propConversationId,
  onReportRewrite,
}) => {
  const storeConversationId = useConversationStore(state => state.currentConversationId)
  const conversationId = propConversationId || storeConversationId
  const selectedResultMessageId = useConversationStore(state => state.selectedResultMessageId)
  const messagesMap = useConversationStore(state => state.messagesMap)
  const messageItemsMap = useConversationStore(state => state.messageItemsMap)

  const remainingRewriteRounds = useMemo(() => {
    if (!selectedResultMessageId) {
      return undefined
    }
    const message = messagesMap.get(selectedResultMessageId)
    if (!message?.messageItemsId) {
      return undefined
    }
    const messageItems = messageItemsMap.get(message.messageItemsId)
    return messageItems?.remainingRewriteRounds
  }, [selectedResultMessageId, messagesMap, messageItemsMap])

  const [showRewritePanel, setShowRewritePanel] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState<AnyBlock | null>(null)
  const [rewriteStatus, setRewriteStatus] = useState<RewriteStatus>('idle')
  const [rewriteErrorMessage, setRewriteErrorMessage] = useState<string | undefined>()
  const [baselineContent, setBaselineContent] = useState(content)
  const [isRewriting, setIsRewriting] = useState(false)

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const styleElRef = useRef<HTMLStyleElement | null>(null)
  const baselineContentRef = useRef(content)
  const rawContentRef = useRef(rawContent || content)
  const offsetMapRef = useRef<number[]>(offsetMap)
  const cachedSelectionRef = useRef<SelectionSnapshot | null>(null)
  const rewriteSelectionRef = useRef<SelectionSnapshot | null>(null)
  const pendingContentRef = useRef<{ cleaned: string; raw: string; offsetMap: number[] } | null>(null)

  const applyBlockTransition = useCallback((blockId: string, phase: AnimationPhase) => {
    const blockElement = getBlockElement(blockId)
    if (!blockElement) {
      return
    }

    blockElement.classList.remove(...Object.values(PHASE_CLASS_MAP))
    blockElement.classList.add(PHASE_CLASS_MAP[phase])
  }, [])

  useEffect(() => {
    baselineContentRef.current = baselineContent
  }, [baselineContent])

  useEffect(() => {
    rawContentRef.current = rawContent || content
    offsetMapRef.current = offsetMap
  }, [rawContent, content, offsetMap])

  useEffect(() => {
    if (isRewriting) {
      pendingContentRef.current = {
        cleaned: content,
        raw: rawContent || content,
        offsetMap,
      }
      return
    }

    setBaselineContent(content)
  }, [content, rawContent, offsetMap, isRewriting])

  useEffect(() => {
    if (selectedBlock?.id) {
      let styleEl = document.getElementById(HIGHLIGHT_STYLE_ID) as HTMLStyleElement | null
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = HIGHLIGHT_STYLE_ID
        document.head.appendChild(styleEl)
      }

      styleElRef.current = styleEl
      styleEl.innerHTML = `[data-node-type="blockOuter"][data-id="${selectedBlock.id}"] { ${HIGHLIGHT_CSS} }`
      return
    }

    if (styleElRef.current) {
      styleElRef.current.innerHTML = ''
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
        createHighlighter: async () => ({
          codeToHtml: (code: string) => `<pre><code>${code}</code></pre>`,
        }),
      },
    })

    return instance
  }, [])

  useEffect(() => {
    if (!editor || !baselineContent) {
      return
    }

    try {
      const blocks = editor.tryParseHTMLToBlocks(renderMarkdownToHTML(baselineContent))
      if (blocks && blocks.length > 0) {
        editor.replaceBlocks(editor.document, blocks)
      }
    } catch (error) {
      console.warn('[BlockNoteEditor] Failed to parse markdown:', error)
    }
  }, [editor, baselineContent])

  const captureCurrentSelection = useCallback(() => {
    const editorElement = getEditorElement(wrapperRef.current)
    const selection = window.getSelection()

    if (!editorElement || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null
    }

    const range = selection.getRangeAt(0)
    if (!editorElement.contains(range.commonAncestorContainer)) {
      return null
    }

    const snapshot = createSelectionSnapshotFromRange(range)
    if (!snapshot) {
      return null
    }

    cachedSelectionRef.current = snapshot
    onSelectionChange?.(snapshot.text, snapshot.range)
    return snapshot
  }, [onSelectionChange])

  useEffect(() => {
    const handleSelectionChange = () => {
      captureCurrentSelection()
    }

    document.addEventListener('mouseup', handleSelectionChange)
    document.addEventListener('keyup', handleSelectionChange)

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange)
      document.removeEventListener('keyup', handleSelectionChange)
    }
  }, [captureCurrentSelection])

  const handleOpenRewritePanel = useCallback((block: AnyBlock) => {
    const editorElement = getEditorElement(wrapperRef.current)
    const blockElement = editorElement ? getBlockElement(block.id, editorElement) : null

    if (!editorElement || !blockElement) {
      return
    }

    const currentSelection = captureCurrentSelection()
    const selectionInCurrentBlock = currentSelection?.range
      ? currentSelection.range.intersectsNode(blockElement)
      : false
    let snapshot = selectionInCurrentBlock && currentSelection
      ? currentSelection
      : createSelectionSnapshotFromBlock(blockElement)

    if (!snapshot) {
      console.warn('[BlockNoteEditor] 未能捕获有效选区，无法打开改写面板', {
        blockId: block.id,
      })
      return
    }

    rewriteSelectionRef.current = snapshot
    setSelectedBlock(block)
    setShowRewritePanel(true)

    if (scrollContainerRef?.current) {
      const containerRect = scrollContainerRef.current.getBoundingClientRect()
      const blockRect = blockElement.getBoundingClientRect()
      const spaceBelow = containerRect.bottom - blockRect.bottom

      if (spaceBelow < PANEL_TOTAL_HEIGHT) {
        scrollContainerRef.current.scrollTop += PANEL_TOTAL_HEIGHT - spaceBelow
      }
    }
  }, [captureCurrentSelection, scrollContainerRef])

  const handleCloseRewritePanel = useCallback(() => {
    setShowRewritePanel(false)
    setSelectedBlock(null)
    rewriteSelectionRef.current = null
  }, [])

  const runRewrite = useCallback(async (
    action: ReportRewriteAction,
    prompt: string | undefined,
    currentBlockId: string | undefined,
    selection: ResolvedSelection
  ) => {
    if (!conversationId) {
      console.warn('[BlockNoteEditor] 没有 conversationId，无法执行改写')
      setRewriteStatus('idle')
      setIsRewriting(false)
      return
    }

    if (!onReportRewrite) {
      console.warn('[BlockNoteEditor] onReportRewrite 未提供，无法执行改写')
      setRewriteStatus('idle')
      setIsRewriting(false)
      return
    }

    const currentRawContent = rawContentRef.current
    const startCodePoint = utf16IndexToCodePointIndex(currentRawContent, selection.originalStart)
    const endCodePoint = utf16IndexToCodePointIndex(currentRawContent, selection.originalEnd)
    let currentContent = currentRawContent
    let hasAppliedFirstDelta = false

    await onReportRewrite({
      action,
      selectedText: selection.originalText,
      startOffset: startCodePoint,
      endOffset: endCodePoint,
      userInstruction: prompt,
      conversationId,
      blockId: currentBlockId,
      onStatusChange: (status) => {
        setRewriteStatus(status)
      },
      onDelta: (delta) => {
        if (!hasAppliedFirstDelta && currentBlockId) {
          applyBlockTransition(currentBlockId, 'fadeout')
          hasAppliedFirstDelta = true
        }

        const startUtf16 = codePointIndexToUtf16Index(currentContent, delta.original_start_offset)
        const endUtf16 = codePointIndexToUtf16Index(currentContent, delta.original_end_offset)

        currentContent =
          currentContent.slice(0, startUtf16) +
          delta.rewritten_text +
          currentContent.slice(endUtf16)

        rawContentRef.current = currentContent
      },
      onSnapshot: (snapshot) => {
        currentContent = snapshot.response_content
        rawContentRef.current = currentContent
      },
      onEnd: () => {
        setIsRewriting(false)

        if (pendingContentRef.current) {
          rawContentRef.current = pendingContentRef.current.raw
          offsetMapRef.current = pendingContentRef.current.offsetMap
          setBaselineContent(pendingContentRef.current.cleaned)
          pendingContentRef.current = null
        } else {
          const { cleaned: newCleaned, offsetMap: newOffsetMap } = preprocessMarkdown(rawContentRef.current)
          offsetMapRef.current = newOffsetMap
          setBaselineContent(newCleaned)
        }

        requestAnimationFrame(() => {
          if (currentBlockId) {
            applyBlockTransition(currentBlockId, 'fadein')
          }

          setTimeout(() => {
            setRewriteStatus('idle')
            if (currentBlockId) {
              applyBlockTransition(currentBlockId, 'success')
            }
          }, 400)
        })
      },
      onError: (error) => {
        console.error('[BlockNoteEditor] 改写错误:', error)
        setRewriteStatus('error')
        setRewriteErrorMessage(error)
        setIsRewriting(false)
        pendingContentRef.current = null

        if (currentBlockId) {
          applyBlockTransition(currentBlockId, 'error')
        }
      },
    })
  }, [applyBlockTransition, conversationId, onReportRewrite])

  const handleSubmitRewrite = useCallback(async (action: ReportRewriteAction, prompt?: string) => {
    const currentSelection = rewriteSelectionRef.current
    const currentBlockId = selectedBlock?.id

    if (!currentSelection || !currentSelection.text) {
      console.warn('[BlockNoteEditor] 没有有效选区，无法执行改写')
      return
    }

    handleCloseRewritePanel()
    setIsRewriting(true)
    pendingContentRef.current = null
    setRewriteStatus('thinking')
    setRewriteErrorMessage(undefined)

    if (currentBlockId) {
      applyBlockTransition(currentBlockId, 'highlight')
    }

    const currentRawContent = rawContentRef.current
    const projection = buildVisibleProjection(baselineContentRef.current, offsetMapRef.current)
    const editorElement = getEditorElement(wrapperRef.current)

    const resolvedSelection =
      (editorElement
        ? resolveSelectionFromBlocks(editorElement, projection, currentSelection, currentRawContent)
        : null) ??
      resolveSelectionByNormalizedVisibleText(projection, currentSelection, currentRawContent) ??
      resolveSelectionByUniqueVisibleText(projection, currentSelection, currentRawContent) ??
      resolveSelectionByLegacyCleanedMatch(
        baselineContentRef.current,
        offsetMapRef.current,
        currentSelection,
        currentRawContent
      )

    if (!resolvedSelection) {
      console.warn('[BlockNoteEditor] 未找到可靠的选区映射，无法计算偏移量', {
        selectedTextPreview: getTextPreview(currentSelection.text),
        startBlockId: currentSelection.startBlockId,
        endBlockId: currentSelection.endBlockId,
      })
      setRewriteStatus('error')
      setRewriteErrorMessage('未找到可靠的选区映射')
      setIsRewriting(false)
      return
    }

    await runRewrite(
      action,
      prompt,
      currentBlockId,
      resolvedSelection
    )
  }, [applyBlockTransition, handleCloseRewritePanel, runRewrite, selectedBlock?.id])

  if (!editor) {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        <div className="h-8 w-1/2 rounded bg-gray-200"></div>
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-11/12 rounded bg-gray-200"></div>
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-4/5 rounded bg-gray-200"></div>
      </div>
    )
  }

  return (
    <div
      ref={wrapperRef}
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
        onSelectionChange={captureCurrentSelection}
        sideMenu={false}
        formattingToolbar={false}
        linkToolbar={false}
        slashMenu={false}
      >
        <SideMenuController
          sideMenu={() => (
            showRewritePanel || isRewriting
              ? null
              : <CustomSideMenu onOpenRewritePanel={handleOpenRewritePanel} />
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

      <AIRewriteStatusIndicator
        status={rewriteStatus}
        visible={rewriteStatus !== 'idle'}
        errorMessage={rewriteErrorMessage}
      />
    </div>
  )
}
