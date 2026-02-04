/**
 * 报告相关工具函数
 */

import type { InferMessage, DeepSearchResult, Report } from '@/pages/Apps/types';
import { MESSAGE_TITLES } from '@/stores/useConversationStore';

// ==================== 标题提取 ====================

/**
 * 从 Markdown 内容中提取标题
 * 提取第一个 # 开头的行作为标题
 *
 * @param content - Markdown 格式的内容
 * @returns 提取的标题，未找到返回空字符串
 */
export function extractTitleFromMarkdown(content: string): string {
  if (!content) return '';

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.substring(2).trim();
    }
  }
  return '';
}

// ==================== 标题格式化（国际化） ====================

/**
 * 格式化报告标题用于显示（处理国际化）
 * 当 title 为 MESSAGE_TITLES.FINAL_REPORT 时，返回翻译后的文本
 *
 * @param title - 原始标题
 * @param t - i18n 翻译函数
 * @param fallbackKey - 当 title 为空时的备用翻译键，默认为 'apps.deepSearch.reportCard'
 * @returns 格式化后的显示文本
 */
export function formatReportTitleForDisplay(
  title: string | undefined,
  t: (key: string, params?: any) => string,
  fallbackKey: string = 'apps.deepSearch.reportCard'
): string {
  if (title === MESSAGE_TITLES.FINAL_REPORT) {
    return t('apps.deepSearch.finalReport');
  }
  return title || t(fallbackKey);
}

/**
 * 从 DeepSearchResult 构造 Report 对象
 * 字段名保持一致，直接赋值无需映射
 *
 * @param messageId - 消息 ID
 * @param messageCreatedAt - 消息创建时间
 * @param deepSearchResult - DeepSearch 结果数据
 * @returns 构造的 Report 对象
 */
export function buildReportFromDeepSearch(
  messageId: string,
  messageCreatedAt: number,
  deepSearchResult: DeepSearchResult
): Report {
  // 提取标题，如果没有则使用语言无关的常量标识
  const extractedTitle = extractTitleFromMarkdown(deepSearchResult.response_content || '');
  const title = extractedTitle || MESSAGE_TITLES.FINAL_REPORT;

  return {
    id: messageId,
    title,
    createdAt: new Date(messageCreatedAt || Date.now()).toISOString(),
    response_content: deepSearchResult.response_content || '',
    citation_messages: deepSearchResult.citation_messages || null,
    infer_messages: deepSearchResult.infer_messages || [],
  };
}