/**
 * MermaidChart 工具函数
 */

import type { MermaidCodeBlockProps } from '../types'
import { CHART_COLORS, SVG_NS, VIEWBOX_PADDING, CHART_STYLES, COLORS, REGEX, ChartType } from './constants'
import mermaid from 'mermaid'

// 重新导出常量供其他模块使用
export { CHART_COLORS, SVG_NS, VIEWBOX_PADDING, CHART_STYLES, COLORS, REGEX, ChartType } from './constants'

// ==================== Mermaid 初始化管理器 ====================

/**
 * Mermaid 初始化管理器
 * 使用依赖注入模式提高可测试性
 */
class MermaidManager {
  private initialized: boolean = false

  /**
   * 初始化 mermaid（仅首次调用生效）
   */
  initialize(): void {
    if (this.initialized) return

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        logLevel: 'error',
      })
      this.initialized = true
    } catch (err) {
      console.error('[MermaidChart] Initialization error:', err)
    }
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 重置初始化状态（仅用于测试）
   */
  reset(): void {
    this.initialized = false
  }
}

// 导出单例实例
export const mermaidManager = new MermaidManager()

// 向后兼容的导出函数
export const initMermaid = (): void => mermaidManager.initialize()

// ==================== 颜色工具 ====================

/**
 * 获取图表颜色
 * @param index 索引
 * @returns 颜色值
 */
export const getColor = (index: number): string => {
  return CHART_COLORS[index % CHART_COLORS.length]
}

// ==================== SVG 操作 ====================

/**
 * 调整SVG的viewBox增加padding
 */
export const adjustViewBox = (svgElement: SVGSVGElement): void => {
  const viewBox = svgElement.getAttribute('viewBox')
  if (!viewBox) return

  const parts = viewBox.split(' ').map(v => parseFloat(v))
  if (parts.length !== 4) return

  const [x, y, width, height] = parts
  svgElement.setAttribute(
    'viewBox',
    `${x - VIEWBOX_PADDING.left} ${y - VIEWBOX_PADDING.top} ${width + VIEWBOX_PADDING.left + VIEWBOX_PADDING.right} ${height + VIEWBOX_PADDING.top + VIEWBOX_PADDING.bottom}`
  )
}

/**
 * 创建SVG text元素
 */
export const createSvgText = (
  container: Element,
  x: number,
  y: number,
  text: string,
  options: {
    fontSize?: string
    fontWeight?: string
    fill?: string
    textAnchor?: string
  } = {}
): void => {
  const textEl = document.createElementNS(SVG_NS, 'text')
  textEl.setAttribute('x', String(x))
  textEl.setAttribute('y', String(y))
  textEl.setAttribute('text-anchor', options.textAnchor || 'middle')
  textEl.setAttribute('font-size', options.fontSize || '14px')
  textEl.setAttribute('font-weight', options.fontWeight || 'bold')
  textEl.setAttribute('fill', options.fill || '#1F2937')
  textEl.textContent = text
  container.appendChild(textEl)
}

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
      child.setAttribute('y', String(CHART_STYLES.TIMELINE_TITLE_Y))
      child.setAttribute('font-size', String(CHART_STYLES.TIMELINE_TITLE_FONT_SIZE))
      child.setAttribute('font-weight', 'bold')
      break
    }
  }
}

/**
 * 居中饼图标题
 */
export const centerPieTitle = (svgElement: SVGSVGElement): void => {
  const pieTitle = svgElement.querySelector('.pieTitleText')
  if (pieTitle) {
    pieTitle.setAttribute('text-anchor', 'middle')
  }
}

/**
 * 居中xychart-beta标题
 */
export const centerXyTitle = (svgElement: SVGSVGElement): void => {
  const xyTitle = svgElement.querySelector('.title')
  if (xyTitle && xyTitle.tagName === 'text') {
    const svgWidth = svgElement.viewBox.baseVal.width
    xyTitle.setAttribute('text-anchor', 'middle')
    xyTitle.setAttribute('x', String(svgWidth / 2))
  }
}

// ==================== 颜色优化 ====================

/**
 * 优化饼图颜色（包括扇区和角标）
 */
export const optimizePieColors = (svgElement: SVGSVGElement): void => {
  const pieCharts = svgElement.querySelectorAll('.pieCircle')
  if (pieCharts.length === 0) return

  // 1. 修改饼图扇区颜色
  pieCharts.forEach((pie, index) => {
    pie.setAttribute('fill', getColor(index))
    pie.setAttribute('stroke', '#fff')
    pie.setAttribute('stroke-width', '2')
  })

  // 2. 修改角标（legend）颜色 - 使用 SVG 属性控制
  const legendGroups = svgElement.querySelectorAll('g.legend')
  if (legendGroups.length === 0) return

  // 每个 legend group 对应一个颜色，使用外层索引
  legendGroups.forEach((legendGroup, groupIndex) => {
    const legendRects = legendGroup.querySelectorAll('rect')
    legendRects.forEach((rect) => {
      rect.setAttribute('fill', getColor(groupIndex))

      // 移除可能的 style 属性（避免 CSS 样式覆盖）
      rect.removeAttribute('style')

      // 移除可能的 class（避免 CSS 类样式）
      const classList = rect.getAttribute('class') || ''
      if (classList.includes('pie') || classList.includes('legend')) {
        rect.removeAttribute('class')
      }
    })
  })
}

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