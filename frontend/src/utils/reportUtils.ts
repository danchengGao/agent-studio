/**
 * 报告相关工具函数
 */

import type { InferMessage, DeepSearchResult, Report } from '@/pages/Apps/types';

/**
 * 从报告内容中提取标题
 * 提取第一个 # 开头的行作为标题
 *
 * @param content - 报告内容（Markdown 格式）
 * @returns 提取的标题，如果没有则返回 "最终报告"
 */
export function extractReportTitle(content: string): string {
  if (!content) return '最终报告';

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.substring(2).trim();
    }
  }
  return '最终报告';
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
  return {
    id: messageId,
    title: extractReportTitle(deepSearchResult.response_content || ''),
    createdAt: new Date(messageCreatedAt || Date.now()).toISOString(),
    response_content: deepSearchResult.response_content || '',
    citation_messages: deepSearchResult.citation_messages || null,
    infer_messages: deepSearchResult.infer_messages || [],
  };
}