/**
 * MermaidChart 常量定义
 */

// ==================== 类型枚举 ====================

/** 图表类型枚举 */
export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
}

// ==================== 颜色常量 ====================

/** 图表配色方案 */
export const CHART_COLORS = [
  '#3B82F6', // 蓝色
  '#10B981', // 绿色
  '#F59E0B', // 橙色
  '#EF4444', // 红色
  '#8B5CF6', // 紫色
  '#EC4899', // 粉色
  '#06B6D4', // 青色
  '#84CC16', // 黄绿色
] as const

/** 通用颜色常量 */
export const COLORS = {
  /** 主色（折线图、数据点） */
  PRIMARY: '#3B82F6',
  /** 边框色 */
  STROKE: '#1F2937',
  /** 白色 */
  WHITE: '#fff',
} as const

// ==================== 正则表达式 ====================

/** SVG 路径正则表达式 */
export const REGEX = {
  /** 匹配 xychart-beta 数据 */
  XYCHART_DATA: /(bar|line)\s+\[([\d\s,.-]+)\]/,
  /** 匹配单个 SVG 点坐标 */
  SVG_POINT: /[ML](\d+\.?\d*),(\d+\.?\d*)/,
  /** 匹配所有 SVG 点 */
  SVG_POINTS: /M(\d+\.?\d*),(\d+\.?\d*)|L(\d+\.?\d*),(\d+\.?\d*)/g,
} as const

// ==================== SVG 常量 ====================

/** SVG命名空间 */
export const SVG_NS = 'http://www.w3.org/2000/svg'

// ==================== 图表样式常量 ====================

/** 图表文本样式常量 */
export const CHART_STYLES = {
  /** 柱状图数据标签偏移 */
  BAR_LABEL_OFFSET: 8,
  /** 折线图数据标签偏移 */
  LINE_LABEL_OFFSET: 12,
  /** 折线图数据点圆圈半径 */
  LINE_POINT_RADIUS: 6,
  /** 折线图线条宽度 */
  LINE_STROKE_WIDTH: 4,
  /** 柱状图边框宽度 */
  BAR_STROKE_WIDTH: 1,
  /** 数据点圆圈描边宽度 */
  POINT_STROKE_WIDTH: 2,
  /** 时间线标题字体大小 */
  TIMELINE_TITLE_FONT_SIZE: 18,
  /** 时间线标题Y坐标 */
  TIMELINE_TITLE_Y: 30,
} as const

/** viewBox padding配置 */
export const VIEWBOX_PADDING = {
  top: 50,
  bottom: 50,
  left: 20,
  right: 20,
} as const