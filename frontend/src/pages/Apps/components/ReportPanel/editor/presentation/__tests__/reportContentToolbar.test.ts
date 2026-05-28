/** @vitest-environment jsdom */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ReportContentToolbar } from '@/pages/Apps/components/ReportPanel/ReportContentToolbar'
import type { Report } from '@/pages/Apps/types'

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'apps.report.edit': 'Edit',
        'apps.report.exitEdit': 'Exit Edit',
        'apps.report.browseMode': 'Browse',
        'apps.report.editMode': 'Edit Mode',
        'apps.report.recoveryNeeded': 'Recovery needed',
        'apps.clipboard.copy': 'Copy',
        'apps.clipboard.copied': 'Copied',
        'apps.clipboard.copyReport': 'Copy report',
        'apps.clipboard.copiedToClipboard': 'Copied to clipboard',
        'apps.download.downloadReport': 'Download report',
        'apps.download.downloading': 'Downloading',
        'apps.download.downloadingReport': 'Downloading report',
        'apps.report.undo': '撤销',
        'apps.report.redo': '重做',
      }

      return translations[key] ?? options?.defaultValue ?? key
    },
  }),
}))

vi.mock('@/pages/Apps/components/ClipboardPanel/hooks', () => ({
  useClipboard: () => ({
    copied: false,
    copy: vi.fn(),
    copyButtonRef: { current: null },
  }),
}))

vi.mock('@/pages/Apps/components/DownloadPanel/hooks', () => ({
  useDownload: () => ({
    downloadFormat: 'markdown',
    isDownloading: false,
    selectFormat: vi.fn(),
  }),
}))

vi.mock('@/pages/Apps/components/DownloadPanel/components/FormatMenu', () => ({
  FormatMenu: () => null,
}))

vi.mock('@radix-ui/react-dropdown-menu', () => ({
  Root: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  Trigger: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

const report: Report = {
  id: 'report-1',
  title: 'Test report',
  content: 'Body',
  createdAt: '2026-04-04T00:00:00.000Z',
}

describe('ReportContentToolbar', () => {
  it('does not render mode labels in browse or edit mode', () => {
    const browseMarkup = renderToStaticMarkup(
      React.createElement(ReportContentToolbar, {
        report,
        isEditing: false,
        editingEnabled: true,
        onEnterEdit: vi.fn(),
        onExitEdit: vi.fn(),
        isFinalReport: true,
        mode: 'browse',
      }),
    )

    expect(browseMarkup).not.toContain('Browse')
    expect(browseMarkup).not.toContain('Edit Mode')

    const editMarkup = renderToStaticMarkup(
      React.createElement(ReportContentToolbar, {
        report,
        isEditing: true,
        editingEnabled: true,
        onEnterEdit: vi.fn(),
        onExitEdit: vi.fn(),
        isFinalReport: true,
        mode: 'edit',
      }),
    )

    expect(editMarkup).not.toContain('Browse')
    expect(editMarkup).not.toContain('Edit Mode')
  })

  it('renders undo and redo buttons in edit mode and disables them from controller state', () => {
    const editMarkup = renderToStaticMarkup(
      React.createElement(ReportContentToolbar, {
        report,
        isEditing: true,
        editingEnabled: true,
        onEnterEdit: vi.fn(),
        onExitEdit: vi.fn(),
        onManualSync: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        canUndo: false,
        canRedo: true,
        isFinalReport: true,
        mode: 'edit',
      }),
    )

    expect(editMarkup).toContain('撤销')
    expect(editMarkup).toContain('重做')
    expect(editMarkup).toContain('disabled')
  })

  it('hides copy and download in edit mode and keeps undo/redo before sync', () => {
    const editMarkup = renderToStaticMarkup(
      React.createElement(ReportContentToolbar, {
        report,
        isEditing: true,
        editingEnabled: true,
        onEnterEdit: vi.fn(),
        onExitEdit: vi.fn(),
        onManualSync: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        canUndo: true,
        canRedo: true,
        isFinalReport: true,
        mode: 'edit',
      }),
    )

    expect(editMarkup).not.toContain('Copy')
    expect(editMarkup).not.toContain('Download report')
    expect(editMarkup.indexOf('aria-label="撤销"')).toBeLessThan(editMarkup.indexOf('aria-label="手动同步报告"'))
    expect(editMarkup.indexOf('aria-label="重做"')).toBeLessThan(editMarkup.indexOf('aria-label="手动同步报告"'))
  })
})
