/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useCallback, useEffect, useState, useRef } from 'react'

import { debounce } from 'lodash-es'
import { useEditor, useEditorEvent } from '../../prompt-editor'

// EditorAPI interface from prompt-editor
interface EditorAPI {
  replaceText: (options: { from: number; to: number; text: string }) => void
  $view: {
    state: {
      doc: {
        sliceString: (from: number, to: number) => string
      }
      selection: {
        main: {
          head: number
        }
      }
    }
  }
}

// Simple Mention component
interface MentionProps {
  triggerCharacters: string[]
  onOpenChange: (e: { value: boolean; state: any }) => void
}

function Mention({ triggerCharacters, onOpenChange }: MentionProps) {
  const editor = useEditor<EditorAPI>()

  // 使用 React Context 的事件系统
  const handleEditorChange = useCallback(
    (update: any) => {
      if (!update.docChanged) return

      const view = editor?.$view
      const state = update.state || view?.state

      if (!state || !state.selection) {
        return
      }

      const selection = state.selection.main || state.selection
      const pos = selection && selection.head

      if (pos === undefined || pos === null) {
        return
      }

      let triggerFound = false

      for (const trigger of triggerCharacters) {
        const startPos = pos - trigger.length
        if (startPos >= 0 && state?.doc) {
          const charsBefore = state.doc.sliceString(startPos, pos)

          if (charsBefore === trigger) {
            triggerFound = true
            onOpenChange({ value: true, state })
            break
          }
        }
      }

      if (!triggerFound) {
        onOpenChange({ value: false, state })
      }
    },
    [editor, triggerCharacters, onOpenChange],
  )

  // 使用 React Context 的事件监听
  useEditorEvent(handleEditorChange)

  // Mention组件不渲染任何内容，只处理逻辑
  return null
}


// Helper function to get mention replace range
function getCurrentMentionReplaceRange(state: any) {
  if (!state || !state.selection) {
    return null
  }

  const selection = state.selection.main || state.selection
  if (!selection || selection.head === undefined) {
    return null
  }

  const pos = selection.head
  const text = state.doc.toString()

  // Find trigger characters before current position
  let from = pos
  let to = pos
  let triggerLength = 0

  // Check {{ and { trigger characters
  if (pos >= 2 && text.slice(pos - 2, pos) === '{{') {
    from = pos - 2
    triggerLength = 2
  } else if (pos >= 1 && text.slice(pos - 1, pos) === '{') {
    from = pos - 1
    triggerLength = 1

    // Check if there's an auto-completed } after
    if (text.length > pos && text.slice(pos, pos + 1) === '}') {
      // Include auto-completed } in replacement range
      to = pos + 1
    }
  } else if (pos >= 1 && text.slice(pos - 1, pos) === '@') {
    from = pos - 1
    triggerLength = 1
  } else {
    return null
  }

  return { from, to, triggerLength }
}

// Type alias for MentionOpenChangeEvent
type MentionOpenChangeEvent = { value: boolean; state: any }

import { Tree } from '@douyinfe/semi-ui'

import { useVariableTree } from '../../../'

const DEFAULT_TRIGGER_CHARACTER = ['{', '{}', '@']

export function VariableTree({ triggerCharacters = DEFAULT_TRIGGER_CHARACTER }: { triggerCharacters?: string[] }) {
  const [posKey, setPosKey] = useState('')
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState(-1)
  const [coords, setCoords] = useState({ left: 0, top: 0 })
  const [savedRange, setSavedRange] = useState<{ from: number; to: number } | null>(null)
  const editor = useEditor<EditorAPI>()

  function insert(variablePath: string) {
    if (!editor) {
      return
    }

    // Use saved range as cursor position may have changed during variable selection
    if (!savedRange) {
      return
    }

    const { from, to } = savedRange
    const insertText = '{{' + variablePath + '}}'

    // Use original dispatch method
    editor.$view.dispatch({
      changes: {
        from,
        to,
        insert: insertText,
      },
      selection: { anchor: from + insertText.length, head: from + insertText.length },
    })

    setVisible(false)
    setSavedRange(null)
  }

  function handleOpenChange(e: MentionOpenChangeEvent) {
    if (e.state && e.state.selection) {
      const selection = e.state.selection.main || e.state.selection
      if (selection && selection.head !== undefined) {
        setPosition(selection.head)
        // Force position update by changing posKey
        setPosKey(String(Math.random()))

        if (e.value && editor) {
          const range = getCurrentMentionReplaceRange(e.state)
          if (range) {
            setSavedRange({ from: range.from, to: range.to })
          }
        }
      }
    }
    setVisible(e.value)
  }

  useEffect(() => {
    if (!editor) {
      return
    }
  }, [editor, visible])

  // Update cursor coordinates when position changes
  useEffect(() => {
    if (editor && position >= 0 && visible) {
      const view = editor.getView()
      if (view) {
        try {
          // CodeMirror 6 standard API: get coordinates for cursor position
          const rect = view.coordsAtPos(position)
          if (rect) {
            const editorElement = view.dom.parentElement
            if (editorElement) {
              const editorRect = editorElement.getBoundingClientRect()
              const newCoords = {
                left: rect.left - editorRect.left,
                top: rect.bottom - editorRect.top
              }
              setCoords(newCoords)
            }
          }
        } catch (error) {
          console.warn('Failed to get cursor coordinates:', error)
        }
      }
    }
  }, [editor, position, visible])

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (visible && !event.defaultPrevented) {
        setVisible(false)
      }
    }

    if (visible) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [visible])

  const treeData = useVariableTree({})

  const debounceUpdatePosKey = useCallback(
    debounce(() => setPosKey(String(Math.random())), 100),
    [],
  )

  return (
    <>
      <Mention triggerCharacters={triggerCharacters} onOpenChange={handleOpenChange} />

      {visible && (
        <div
          style={{
            position: 'absolute',
            left: coords.left,
            top: coords.top,
            zIndex: 1000,
          }}
          onClick={e => {
            e.stopPropagation()
          }}
        >
          <div
            style={{
              width: 300,
              maxHeight: 300,
              overflowY: 'auto',
              backgroundColor: 'white',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              boxShadow: '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08), 0 9px 28px 8px rgba(0,0,0,.05)',
            }}
          >
            <Tree
              treeData={treeData}
              onExpand={() => {
                debounceUpdatePosKey()
              }}
              onSelect={(selectedKeys, info) => {
                const selectedKey = Array.isArray(selectedKeys) ? selectedKeys[0] : selectedKeys
                if (selectedKey) {
                  insert(selectedKey.toString())
                }
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
