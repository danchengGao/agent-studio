/**
 * Mermaid timeline 图表处理器
 * 专门处理 timeline 图表的后处理
 */

import { getColor } from './utils'

// ==================== 常量定义 ====================

/** timeline 专用样式常量 */
const TIMELINE_STYLES = {
  /** 标题字体大小 */
  TITLE_FONT_SIZE: 18,
  /** 标题Y坐标 */
  TITLE_Y: 30,
} as const

// ==================== 标题处理 ====================

/**
 * 居中timeline图表标题
 */
export const centerTimelineTitle = (svgElement: SVGSVGElement): void => {
  const svgChildren = Array.from(svgElement.children)
  for (const child of svgChildren) {
    if (child.tagName === 'text' && !child.getAttribute('class')) {
      const svgWidth = svgElement.viewBox.baseVal.width
      child.setAttribute('x', String(svgWidth / 2))
      child.setAttribute('text-anchor', 'middle')
      child.setAttribute('y', String(TIMELINE_STYLES.TITLE_Y))
      child.setAttribute('font-size', String(TIMELINE_STYLES.TITLE_FONT_SIZE))
      child.setAttribute('font-weight', 'bold')
      break
    }
  }
}

// ==================== 颜色优化 ====================

/**
 * 优化timeline图表颜色
 */
export const optimizeTimelineColors = (svgElement: SVGSVGElement): void => {
  const timelineSections = svgElement.querySelectorAll('[class*="section-"] rect, [class*="section-"] path')
  if (timelineSections.length === 0) return

  timelineSections.forEach((section, index) => {
    if (section.getAttribute('fill')?.includes('hsl')) {
      section.setAttribute('fill', getColor(index))
    }
  })
}