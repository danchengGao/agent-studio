import { describe, expect, it } from 'vitest'

import type { CanonicalDocument } from '@/pages/Apps/components/ReportPanel/editor/canonical'
import { resolveEditorBootstrapCanonical } from '@/pages/Apps/components/ReportPanel/editor/editorBootstrapPolicy'

const buildCanonical = (baseVersion: string, rawMarkdown: string): CanonicalDocument => ({
  meta: {
    baseVersion,
    draftRevision: 0,
  },
  rawMarkdown,
  blocks: [],
})

describe('resolveEditorBootstrapCanonical', () => {
  it('keeps the original bootstrap seed after the editor has mounted once', () => {
    const bootstrap = buildCanonical('report:1', '# original')
    const incoming = buildCanonical('report:2', '# rewritten')

    expect(
      resolveEditorBootstrapCanonical({
        existingBootstrap: bootstrap,
        incomingCanonical: incoming,
        buildFallback: () => incoming,
      }),
    ).toBe(bootstrap)
  })

  it('uses the incoming canonical snapshot on first mount when available', () => {
    const incoming = buildCanonical('report:1', '# incoming')

    expect(
      resolveEditorBootstrapCanonical({
        existingBootstrap: null,
        incomingCanonical: incoming,
        buildFallback: () => buildCanonical('fallback', '# fallback'),
      }),
    ).toBe(incoming)
  })

  it('falls back to parsing raw markdown on first mount when no canonical snapshot exists', () => {
    const fallback = buildCanonical('fallback', '# fallback')

    expect(
      resolveEditorBootstrapCanonical({
        existingBootstrap: null,
        incomingCanonical: null,
        buildFallback: () => fallback,
      }),
    ).toBe(fallback)
  })
})
