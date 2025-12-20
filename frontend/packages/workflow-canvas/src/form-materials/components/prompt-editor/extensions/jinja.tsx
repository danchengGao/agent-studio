/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import { ViewPlugin, ViewUpdate } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'

// Jinja template highlighting decoration extension for CodeMirror 6
function jinjaHighlight(): Extension {
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
          const treeObj = syntaxTree(view.state)
          const text = view.state.doc.toString()

          // Simple regex-based Jinja highlighting as fallback
          // {{ variable }}
          const expressionRegex = /\{\{([^}]*)\}\}/g
          let match

          while ((match = expressionRegex.exec(text)) !== null) {
            const from = match.index
            const to = match.index + match[0].length

            // Highlight the entire expression
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

            // Highlight the brackets differently
            const bracketLength = match[0].indexOf(match[1].trim()) - 2
            if (bracketLength > 0) {
              // Opening bracket
              decorations.push(
                Decoration.mark({
                  class: 'jinja-statement-bracket',
                }).range(from, from + bracketLength + 2)
              )
              // Closing bracket
              decorations.push(
                Decoration.mark({
                  class: 'jinja-statement-bracket',
                }).range(to - bracketLength - 2, to)
              )
            }
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
      '.jinja-statement-bracket': {
        color: '#D1009D',
      },
      '.jinja-comment': {
        color: '#0607094D',
      },
      '.jinja-expression': {
        color: '#4E40E5',
      },
    }),
  ]
}

// React component that returns the extension
function JinjaHighlight() {
  // Return the extension object that can be consumed by BaseEditor
  return jinjaHighlight()
}

export default JinjaHighlight
