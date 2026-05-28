/**
 * 报告相关工具函数
 */

import { parseMarkdownToCanonical } from '@/pages/Apps/components/ReportPanel/editor/canonical';
import type { ChartMessage, DeepSearchResult, Report } from '@/pages/Apps/types'
import { MESSAGE_TITLES } from '@/stores/useConversationStore'

const CHART_PLACEHOLDER_PATTERN = /\(#insertChart:([^)]+)\)/g
const VLM_CHART_PROTOCOL = 'vlm-chart:'
const CHECKED_CITATION_PATTERN = /\[checked_citation:(\d+)\]\[\[(\d+)\]\]\(([^)\s]+)\)/g

/**
 * 清理报告内容中的引用标记
 */
export function cleanReportContent(content: string): string {
  if (!content) return ''
  return normalizeCheckedCitationLinks(content)
}

export function normalizeCheckedCitationLinks(content: string): string {
  if (!content) return ''

  return content.replace(CHECKED_CITATION_PATTERN, (_match, citationIndex, displayIndex, url) => {
    return `[[${displayIndex}]](${url} "checked_citation:${citationIndex}")`
  })
}

/**
 * 从 Markdown 内容中提取标题
 */
export function extractTitleFromMarkdown(content: string): string {
  if (!content) return ''

  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      return trimmed.substring(2).trim()
    }
  }
  return ''
}

/**
 * 格式化报告标题用于显示
 */
export function formatReportTitleForDisplay(
  title: string | undefined,
  t: (key: string, params?: any) => string,
  fallbackKey: string = 'apps.deepSearch.reportCard'
): string {
  if (title === MESSAGE_TITLES.FINAL_REPORT) {
    return t('apps.deepSearch.finalReport')
  }
  return title || t(fallbackKey)
}

function normalizeChartDataUrl(chart: ChartMessage): string | null {
  const trimmedBase64 = (chart.base64 || '').trim()

  if (!trimmedBase64) {
    return null
  }

  if (trimmedBase64.startsWith('data:image/')) {
    return trimmedBase64
  }

  return `data:image/png;base64,${trimmedBase64}`
}

export function createVLMChartReference(chartId: string): string {
  return `${VLM_CHART_PROTOCOL}${chartId}`
}

export function isVLMChartReference(value: string): boolean {
  return value.startsWith(VLM_CHART_PROTOCOL)
}

export function getChartIdFromReference(value: string): string {
  return value.slice(VLM_CHART_PROTOCOL.length)
}

function escapeMarkdownAltText(value: string): string {
  return value.replace(/[\[\]\r\n]/g, ' ').trim()
}

function getChartAltText(chart: ChartMessage): string {
  return escapeMarkdownAltText(
    chart.chart_title || chart.description || chart.chart_id || 'VLM chart'
  )
}

export function getChartDataUrl(chart: ChartMessage): string | null {
  return normalizeChartDataUrl(chart)
}


/**
 * 将报告中的 VLM 图表占位符替换成 Markdown 图片
 */
export function insertVLMChartsIntoReportContent(
  content: string,
  chartMessages?: ChartMessage[] | null,
  imageSrcResolver: (chart: ChartMessage) => string | null = normalizeChartDataUrl
): string {
  if (!content || !chartMessages?.length) {
    return content
  }

  const chartsById = new Map(chartMessages.map(chart => [chart.chart_id, chart]))

  return content.replace(CHART_PLACEHOLDER_PATTERN, (placeholder, chartId) => {
    const chart = chartsById.get(chartId)
    if (!chart) {
      return placeholder
    }

    const imageSrc = imageSrcResolver(chart)
    if (!imageSrc) {
      return placeholder
    }

    const altText = getChartAltText(chart)

    return `![${altText}](${imageSrc})`
  })
}

/**
 * 从 DeepSearchResult 构造 Report 对象
 */
export function buildReportFromDeepSearch(
  messageId: string,
  messageCreatedAt: number,
  deepSearchResult: DeepSearchResult
): Report {
  const rawResponseContent = deepSearchResult.response_content || '';
  const responseContent = cleanReportContent(rawResponseContent);
  const canonicalDocument = parseMarkdownToCanonical({
    rawMarkdown: rawResponseContent,
    baseVersion: `report:${messageId}`,
    draftRevision: 0,
  });

  const extractedTitle = extractTitleFromMarkdown(responseContent)
  const title = extractedTitle || MESSAGE_TITLES.FINAL_REPORT

  return {
    id: messageId,
    title,
    createdAt: new Date(messageCreatedAt || Date.now()).toISOString(),
    content: responseContent,
    citations: deepSearchResult.citation_messages || null,
    inferMessages: deepSearchResult.infer_messages || [],
    chartMessages: deepSearchResult.chart_messages || [],
    rawContent: rawResponseContent,
    canonicalDocument,
  };
}
