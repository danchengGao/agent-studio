import { describe, expect, it } from 'vitest'
import { buildReportFromDeepSearch } from '@/utils/reportUtils'

describe('buildReportFromDeepSearch', () => {
  it('attaches canonical document seed for final-report edit mode', () => {
    const report = buildReportFromDeepSearch('message-1', Date.now(), {
      response_content:
        '# 标题\n\n京东集团2025年经济状况呈现“整体稳健、结构分化”特征，全年总收入达**13091亿元**。',
      citation_messages: null,
      infer_messages: [],
    })

    expect(report.rawContent).toContain('13091亿元')
    expect(report.canonicalDocument).toBeDefined()
    expect(report.canonicalDocument?.rawMarkdown).toContain('13091亿元')
    expect(report.canonicalDocument?.blocks[0]?.kind).toBe('heading')
    expect(report.canonicalDocument?.blocks[1]?.kind).toBe('paragraph')
  })
})
