/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'

export interface MentionItem {
  id: string
  name: string
  avatar?: string
  email?: string
}

export interface MentionsConfig {
  trigger: string
  minLength: number
  delay: number
  suggestions: MentionItem[]
  onSelect?: (mention: MentionItem) => void
  styles?: {
    container?: React.CSSProperties
    item?: React.CSSProperties
    highlight?: React.CSSProperties
  }
}

/**
 * Create a mentions extension for CodeMirror 6
 */
export function createMentionsExtension(config: MentionsConfig): Extension {
  const mentions: MentionItem[] = [...config.suggestions]

  // State effect for updating mentions
  const updateMentionsEffect = StateEffect.define<MentionItem[]>()

  // State field for managing mentions
  const mentionsState = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update: (value, tr) => {
      for (const effect of tr.effects) {
        if (effect.is(updateMentionsEffect)) {
          // Handle mentions update
          mentions.length = 0
          mentions.push(...effect.value)
        }
      }

      // Update decorations based on mentions
      const decorations: any[] = []

      // Simple implementation - highlight @ symbols
      const regex = new RegExp(`\\${config.trigger}\\w+`, 'g')
      const doc = tr.newDoc

      let match
      while ((match = regex.exec(doc.toString())) !== null) {
        const from = match.index
        const to = match.index + match[0].length

        decorations.push(
          Decoration.mark({
            class: 'cm-mention',
            attributes: {
              'data-mention': match[0].substring(1),
            },
          }).range(from, to),
        )
      }

      return Decoration.set(decorations)
    },
  })

  // View plugin for handling interactions
  const mentionsPlugin = ViewPlugin.fromClass(
    class {
      private decorations: DecorationSet = Decoration.none

      update(update: ViewUpdate) {
        // Handle mention detection and triggering
        if (update.docChanged) {
          this.detectMentions(update)
        }
      }

      private detectMentions(update: ViewUpdate) {
        // Simple mention detection logic
        const doc = update.state.doc.toString()
        const cursor = update.state.selection.main.head

        // Check if user is typing a mention
        const beforeCursor = doc.slice(Math.max(0, cursor - 20), cursor)
        const mentionMatch = new RegExp(`\\${config.trigger}(\\w*)$`).exec(beforeCursor)

        if (mentionMatch) {
          const query = mentionMatch[1]

          // Trigger suggestions if minimum length is reached
          if (query.length >= config.minLength) {
            this.showSuggestions(query, cursor - query.length - config.trigger.length)
          }
        } else {
          this.hideSuggestions()
        }
      }

      private showSuggestions(query: string, position: number) {
        // Filter suggestions based on query
        const filteredMentions = mentions.filter(mention => mention.name.toLowerCase().includes(query.toLowerCase()))

        // In a real implementation, this would show a dropdown
        console.log('Show suggestions for query:', query, filteredMentions)
      }

      private hideSuggestions() {
        // Hide suggestion dropdown
        console.log('Hide suggestions')
      }

      destroy() {
        // Cleanup
      }
    },
  )

  return [
    mentionsState,
    mentionsPlugin,
    // Add CSS for mentions styling
    EditorView.theme({
      '.cm-mention': {
        backgroundColor: '#e1f5fe',
        color: '#01579b',
        padding: '1px 2px',
        borderRadius: '2px',
        cursor: 'pointer',
      },
      '.cm-mention:hover': {
        backgroundColor: '#b3e5fc',
      },
    }),
  ]
}

export class MentionsManager {
  private config: MentionsConfig
  private mentions: MentionItem[] = []

  constructor(config: MentionsConfig) {
    this.config = config
    this.mentions = [...config.suggestions]
  }

  /**
   * Create the CodeMirror extension
   */
  createExtension(): Extension {
    return createMentionsExtension(this.config)
  }

  /**
   * Get the current mentions
   */
  getMentions(): MentionItem[] {
    return this.mentions
  }

  /**
   * Update mentions dynamically
   */
  async setMentions(mentions: MentionItem[]): Promise<void> {
    this.mentions = mentions
  }

  /**
   * Add a single mention
   */
  addMention(mention: MentionItem): void {
    this.mentions.push(mention)
  }

  /**
   * Remove a mention by ID
   */
  removeMention(id: string): boolean {
    const index = this.mentions.findIndex(m => m.id === id)
    if (index >= 0) {
      this.mentions.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Clear all mentions
   */
  clearMentions(): void {
    this.mentions.length = 0
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MentionsConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

export default createMentionsExtension
