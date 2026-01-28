/**
 * MermaidChart 图表处理器
 * 处理不同类型的图表（柱状图、折线图等）
 */

import { SVG_NS, CHART_STYLES, COLORS, REGEX, ChartType, getColor, createSvgText } from './utils'

/**
 * 处理柱状图
 */
export const handleBarChart = (svgElement: SVGSVGElement, values: number[]): void => {
  const barPlotGroup = svgElement.querySelector('.bar-plot-0, [class*="bar-plot"]')
  if (!barPlotGroup) return

  const rects = barPlotGroup.querySelectorAll('rect')
  rects.forEach((rect, index) => {
    if (index >= values.length) return

    rect.setAttribute('fill', getColor(index))
    rect.setAttribute('stroke', COLORS.STROKE)
    rect.setAttribute('stroke-width', String(CHART_STYLES.BAR_STROKE_WIDTH))

    const x = parseFloat(rect.getAttribute('x') || '0')
    const y = parseFloat(rect.getAttribute('y') || '0')
    const width = parseFloat(rect.getAttribute('width') || '0')

    createSvgText(barPlotGroup, x + width / 2, y - CHART_STYLES.BAR_LABEL_OFFSET, String(values[index]))
  })
}

/**
 * 处理折线图
 */
export const handleLineChart = (svgElement: SVGSVGElement, values: number[]): void => {
  const linePlotGroup = svgElement.querySelector('.line-plot-0, [class*="line-plot"]')
  if (!linePlotGroup) return

  const path = linePlotGroup.querySelector('path')
  if (!path) return

  // 优化线条样式
  path.setAttribute('stroke-width', String(CHART_STYLES.LINE_STROKE_WIDTH))
  path.setAttribute('stroke', COLORS.PRIMARY)
  path.setAttribute('fill', 'none')

  const d = path.getAttribute('d')
  if (!d) return

  // 解析路径数据点
  const points = d.match(REGEX.SVG_POINTS)
  if (!points) return

  points.forEach((pointStr, index) => {
    if (index >= values.length) return

    const coords = pointStr.match(REGEX.SVG_POINT)
    if (!coords) return

    const cx = parseFloat(coords[1])
    const cy = parseFloat(coords[2])

    // 创建数据点圆圈
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('cx', String(cx))
    circle.setAttribute('cy', String(cy))
    circle.setAttribute('r', String(CHART_STYLES.LINE_POINT_RADIUS))
    circle.setAttribute('fill', COLORS.PRIMARY)
    circle.setAttribute('stroke', COLORS.WHITE)
    circle.setAttribute('stroke-width', String(CHART_STYLES.POINT_STROKE_WIDTH))
    linePlotGroup.appendChild(circle)

    // 创建数值标签
    createSvgText(linePlotGroup, cx, cy - CHART_STYLES.LINE_LABEL_OFFSET, String(values[index]))
  })
}

/**
 * 处理xychart-beta图表
 */
export const handleXyChart = (svgElement: SVGSVGElement, code: string): void => {
  const match = code.match(REGEX.XYCHART_DATA)
  if (!match) return

  const chartType = match[1] as ChartType
  const values = match[2].split(',').map(v => parseFloat(v.trim()))

  if (chartType === ChartType.BAR) {
    handleBarChart(svgElement, values)
  } else if (chartType === ChartType.LINE) {
    handleLineChart(svgElement, values)
  }
}