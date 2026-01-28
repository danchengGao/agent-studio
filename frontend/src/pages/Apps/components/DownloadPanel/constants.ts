/**
 * 下载格式常量配置
 */

/** 格式选项配置 */
export const FORMAT_OPTIONS: readonly {
  value: 'markdown' | 'html' | 'docx'
  label: string
  extension: string
  mimeType: string
}[] = [
  { value: 'markdown', label: 'Markdown', extension: '.md', mimeType: 'text/markdown' },
  { value: 'html', label: 'HTML', extension: '.html', mimeType: 'text/html' },
  { value: 'docx', label: 'Word 文档', extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
] as const