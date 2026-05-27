/**
 * 自定义侧边菜单组件
 *
 * @description
 * 作为 sideMenu 的容器，管理 AI 按钮
 * 使用 BlockNote 的 SideMenuExtension 获取当前悬停的块
 * 悬停时通过动态注入 CSS 规则高亮对应块
 *
 * @note
 * 组件必须作为 BlockNoteView 的子组件使用，以通过 hooks 获取 editor 实例
 *
 * @technical
 * BlockNote 基于 ProseMirror，会频繁替换 DOM 元素，导致直接添加的 class 丢失。
 * 解决方案：动态注入 <style> 规则到 <head>，通过 CSS 属性选择器匹配块 ID。
 * 即使 DOM 被替换，CSS 规则仍然会自动应用到新元素上。
 */

import React, { useCallback, useRef, useEffect } from 'react'
import type { Block } from '@blocknote/core'
import { SideMenuExtension } from '@blocknote/core/extensions'
import { useExtensionState, useBlockNoteEditor } from '@blocknote/react'
import { AIButton } from './AIButton'
import { HIGHLIGHT_STYLE_ID, HIGHLIGHT_CSS } from '../constants'

// 使用泛型 Block 类型以兼容 BlockNote 的扩展状态
type AnyBlock = Block<any, any, any>

export interface CustomSideMenuProps {
  /** 打开改写面板回调 */
  onOpenRewritePanel: (block: AnyBlock) => void
}

/**
 * 自定义侧边菜单组件
 */
export const CustomSideMenu: React.FC<CustomSideMenuProps> = ({
  onOpenRewritePanel,
}) => {
  // 通过 hook 获取 editor 实例（传递给 useExtensionState）
  const editor = useBlockNoteEditor()

  // 使用 BlockNote 的 SideMenuExtension 获取当前悬停的块
  const currentBlock = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block ?? null,
  })

  // 缓存样式元素引用，避免重复 DOM 查询
  const styleElRef = useRef<HTMLStyleElement | null>(null)

  // 用 ref 存储当前块，避免 useCallback 依赖变化导致频繁重建
  // 这是 React 中避免 stale closure 的常见模式
  const currentBlockRef = useRef<AnyBlock | null>(null)
  currentBlockRef.current = currentBlock as AnyBlock | null

  // 获取或创建样式元素
  const getStyleElement = useCallback((): HTMLStyleElement => {
    if (!styleElRef.current) {
      let styleEl = document.getElementById(HIGHLIGHT_STYLE_ID) as HTMLStyleElement | null
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = HIGHLIGHT_STYLE_ID
        document.head.appendChild(styleEl)
      }
      styleElRef.current = styleEl
    }
    return styleElRef.current
  }, [])

  // 组件卸载时清空样式（不移除元素，让 BlockNoteEditor 管理）
  useEffect(() => {
    return () => {
      if (styleElRef.current) {
        styleElRef.current.innerHTML = ''
      }
    }
  }, [])

  // 鼠标进入 AI 按钮 - 注入高亮 CSS 规则
  const handleMouseEnter = useCallback(() => {
    const blockId = currentBlockRef.current?.id
    if (!blockId) return

    const styleEl = getStyleElement()
    // 使用属性选择器匹配块 ID，即使 DOM 被替换也能生效
    styleEl.innerHTML = `[data-node-type="blockOuter"][data-id="${blockId}"] { ${HIGHLIGHT_CSS} }`
  }, [getStyleElement])

  // 鼠标离开 AI 按钮 - 清除高亮 CSS 规则
  const handleMouseLeave = useCallback(() => {
    if (styleElRef.current) {
      styleElRef.current.innerHTML = ''
    }
  }, [])

  // 点击 AI 按钮 - 打开改写面板
  const handleAIButtonClick = useCallback(() => {
    const block = currentBlockRef.current
    if (!block) return
    onOpenRewritePanel(block)
  }, [onOpenRewritePanel])

  return (
    <div className="bn-side-menu flex flex-col gap-0.5 relative">
      <AIButton
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleAIButtonClick}
      />
    </div>
  )
}
