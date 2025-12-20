/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import { ViewPlugin, ViewUpdate } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'

// Markdown highlighting decoration extension for CodeMirror 6
function markdownHighlight(): Extension {
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

          treeObj.iterate({
            enter: (node: SyntaxNode) => {
              const from = node.from
              const to = node.to

              // # heading
              if (node.name.startsWith('ATXHeading')) {
                decorations.push(
                  Decoration.mark({
                    class: 'heading',
                  }).range(from, to)
                )
              }

              // *italic*
              if (node.name === 'Emphasis') {
                decorations.push(
                  Decoration.mark({
                    class: 'emphasis',
                  }).range(from, to)
                )
              }

              // **bold**
              if (node.name === 'StrongEmphasis') {
                decorations.push(
                  Decoration.mark({
                    class: 'strong-emphasis',
                  }).range(from, to)
                )
              }

              // -
              // 1.
              // >
              if (node.name === 'ListMark' || node.name === 'QuoteMark') {
                decorations.push(
                  Decoration.mark({
                    class: 'mark',
                  }).range(from, to)
                )
              }
            },
          })

          return Decoration.set(decorations)
        }
      },
      {
        decorations: v => v.decorations
      }
    ),
    EditorView.theme({
      '.heading': {
        color: '#00818C',
        fontWeight: 'bold',
      },
      '.emphasis': {
        fontStyle: 'italic',
      },
      '.strong-emphasis': {
        fontWeight: 'bold',
      },
      '.mark': {
        color: '#4E40E5',
      },
    }),
  ]
}

// React component that returns the extension
function MarkdownHighlight() {
  // Return the extension object that can be consumed by BaseEditor
  return markdownHighlight()
}

export default MarkdownHighlight
