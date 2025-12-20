/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import { ViewPlugin, ViewUpdate } from '@codemirror/view'

export function createCustomLanguageExtension(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = this.buildDecorations(view)
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view)
          }
        }

        buildDecorations(view: EditorView): DecorationSet {
          const decorations: any[] = []
          const text = view.state.doc.toString()

          // {{ variable }}
          const expressionRegex = /\{\{([^}]*)\}\}/g
          let match

          while ((match = expressionRegex.exec(text)) !== null) {
            const from = match.index
            const to = match.index + match[0].length

            decorations.push(
              Decoration.mark({
                class: 'jinja-expression',
              }).range(from, to)
            )
          }

          // {% statement %}
          const statementRegex = /\{%([^%]*)%\}/g
          while ((match = statementRegex.exec(text)) !== null) {
            const from = match.index
            const to = match.index + match[0].length

            decorations.push(
              Decoration.mark({
                class: 'jinja-statement',
              }).range(from, to)
            )
          }

          // {# comment #}
          const commentRegex = /\{#([^#]*)#\}/g
          while ((match = commentRegex.exec(text)) !== null) {
            const from = match.index
            const to = match.index + match[0].length

            decorations.push(
              Decoration.mark({
                class: 'jinja-comment',
              }).range(from, to)
            )
          }

          return Decoration.set(decorations)
        }
      },
      {
        decorations: v => v.decorations
      }
    ),
    EditorView.theme({
      '.jinja-statement': {
        color: '#D1009D',
        fontWeight: 500,
      },
      '.jinja-comment': {
        color: '#6b7280',
        fontStyle: 'italic',
      },
      '.jinja-expression': {
        color: '#4E40E5',
        backgroundColor: 'rgba(78, 64, 229, 0.1)',
        borderRadius: '2px',
        padding: '1px 2px',
      },
    }),
  ]
}