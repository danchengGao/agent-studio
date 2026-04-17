/** @vitest-environment jsdom */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ReportContentToolbar } from '@/pages/Apps/components/ReportPanel/ReportContentToolbar'
import type { Report } from '@/pages/Apps/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
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
      }

      return translations[key] ?? key
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
})
