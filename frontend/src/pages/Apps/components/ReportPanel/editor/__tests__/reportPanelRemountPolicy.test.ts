/** @vitest-environment jsdom */

import React, { forwardRef, useEffect, useImperativeHandle } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReportPanel } from '@/pages/Apps/components/ReportPanel/ReportPanel'
import type { Report } from '@/pages/Apps/types'

const reportEditViewMountSpy = vi.fn()
const reportEditViewUnmountSpy = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/useConversationStore', () => ({
  useConversationStore: (selector: (state: { messagesMap: Map<string, unknown> }) => unknown) =>
    selector({ messagesMap: new Map() }),
  isFinalReportMessage: () => true,
}))

vi.mock('@/pages/Apps/components/ReportPanel/ReportContentToolbar', () => ({
  ReportContentToolbar: ({
    onEnterEdit,
    isEditing,
  }: {
    onEnterEdit?: () => void
    isEditing?: boolean
  }) =>
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: onEnterEdit,
      },
      isEditing ? 'editing' : 'enter-edit',
    ),
}))

vi.mock('@/pages/Apps/components/ReportPanel/ReportView', () => ({
  ReportView: ({ report }: { report: Report }) => React.createElement('div', null, report.id),
}))

vi.mock('@/pages/Apps/components/ReportPanel/ReportEditView', () => ({
  ReportEditView: forwardRef(function MockReportEditView(
    { report }: { report: Report },
    ref: React.ForwardedRef<{ getCurrentMarkdown: () => Promise<string> }>,
  ) {
    useImperativeHandle(ref, () => ({
      getCurrentMarkdown: async () => report.rawContent || report.content || '',
    }))

    useEffect(() => {
      reportEditViewMountSpy()
      return () => {
        reportEditViewUnmountSpy()
      }
    }, [])

    return React.createElement('div', { 'data-testid': 'report-edit-view' }, report.id)
  }),
}))

const buildReport = (id: string, rawContent = '# Report\n\nParagraph'): Report => ({
  id,
  title: `Report ${id}`,
  content: rawContent,
  rawContent,
  createdAt: '2026-04-20T00:00:00.000Z',
})

describe('ReportPanel remount policy', () => {
  beforeEach(() => {
    reportEditViewMountSpy.mockClear()
    reportEditViewUnmountSpy.mockClear()
  })

  it('does not remount the edit view when the current report version id changes during editing', () => {
    const initialReport = buildReport('report-1')
    const nextVersionReport = buildReport('report-2', '# Report\n\nUpdated paragraph')
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)

    act(() => {
      root.render(
        React.createElement(ReportPanel, {
          report: initialReport,
          conversationId: 'conversation-1',
          feedbackOptimizationEnabled: true,
          onReportRewrite: vi.fn(),
        }),
      )
    })

    const enterEditButton = container.querySelector('button')
    if (!enterEditButton) {
      throw new Error('enter edit button not found')
    }

    act(() => {
      enterEditButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="report-edit-view"]')?.textContent).toBe('report-1')
    expect(reportEditViewMountSpy).toHaveBeenCalledTimes(1)
    expect(reportEditViewUnmountSpy).toHaveBeenCalledTimes(0)

    act(() => {
      root.render(
        React.createElement(ReportPanel, {
          report: nextVersionReport,
          conversationId: 'conversation-1',
          feedbackOptimizationEnabled: true,
          onReportRewrite: vi.fn(),
        }),
      )
    })

    expect(container.querySelector('[data-testid="report-edit-view"]')?.textContent).toBe('report-2')
    expect(reportEditViewMountSpy).toHaveBeenCalledTimes(1)
    expect(reportEditViewUnmountSpy).toHaveBeenCalledTimes(0)

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
