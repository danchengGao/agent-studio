/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import { Extension } from '@codemirror/state'
import { ViewPlugin, ViewUpdate } from '@codemirror/view'

export interface MentionOptions {
  triggerCharacters?: string[]
  onTrigger?: (view: EditorView, from: number, to: number, trigger: string) => void
}

const DEFAULT_TRIGGER_CHARACTERS = ['{', '@', '{{']

export function mentionExtension(options: MentionOptions = {}): Extension {
  const { triggerCharacters = DEFAULT_TRIGGER_CHARACTERS, onTrigger } = options

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = Decoration.none
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          const { view } = update
          const { state } = view

          // Get current cursor position
          const selection = state.selection.main
          const pos = selection.head

          // Check if we're at a trigger character (after auto-completion)
          const text = state.doc.toString()
          const line = state.doc.lineAt(pos)
          const lineStart = line.from
          const relativePos = pos - lineStart
          const lineText = text.slice(lineStart, line.to)

          // Look for trigger patterns in the current line up to cursor position
          const cursorText = lineText.slice(0, relativePos)
          const triggers: { from: number; to: number; trigger: string }[] = []

          // Check for patterns: {, @, {{
          for (let i = cursorText.length - 1; i >= 0; i--) {
            const remainingText = cursorText.slice(i)

            if (remainingText.startsWith('{{')) {
              triggers.push({
                from: pos - (cursorText.length - i) - 2,
                to: pos,
                trigger: '{{'
              })
              break
            } else if (triggerCharacters.includes(remainingText[0])) {
              const trigger = remainingText[0]
              triggers.push({
                from: pos - (cursorText.length - i) - 1,
                to: pos,
                trigger
              })
              break
            }

            // Only check a reasonable number of characters back
            if (cursorText.length - i > 10) {
              break
            }
          }

          // Trigger callback for each found trigger
          if (triggers.length > 0 && onTrigger) {
            // Use the last trigger (most specific match)
            const { from, to, trigger } = triggers[triggers.length - 1]
            onTrigger(view, from, to, trigger)
          }
        }
      }
    },
    {
      decorations: (v) => v.decorations
    }
  )
}