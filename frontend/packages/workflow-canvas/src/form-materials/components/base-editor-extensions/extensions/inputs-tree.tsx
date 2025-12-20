/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useMemo, useEffect, useState, useCallback, forwardRef } from 'react'
import { isPlainObject, last } from 'lodash-es'
import { type ArrayType, ASTMatch, type BaseType, type BaseVariableField, useCurrentScope } from '@flowgram.ai/editor'
import { type TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree'
import { Tree, Popover } from '@douyinfe/semi-ui'

import { IInputsValues } from '../../../'
import { FlowValueUtils } from '../../../'
import { useEditor, useEditorEvent } from '../../prompt-editor'

// EditorAPI interface from prompt-editor
interface EditorAPI {
  replaceText: (_options: { from: number; to: number; text: string }) => void
  $view: {
    state: {
      doc: {
        sliceString: (_from: number, _to: number) => string
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
  onOpenChange: (e: { value: boolean; state: unknown }) => void
}

function Mention({ triggerCharacters, onOpenChange }: MentionProps) {
  const editor = useEditor<EditorAPI>()

  // 使用 React Context 的事件系统
  const handleEditorChange = useCallback(
    (update: { docChanged: boolean; selectionSet?: boolean; state: unknown }) => {
      // 检查文档变化或选择变化，都应该触发变量选择检查
      if (!update.docChanged && !update.selectionSet) return

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

// Simple PositionMirror component
interface PositionMirrorProps {
  position: number
}

const PositionMirror = forwardRef<HTMLDivElement, PositionMirrorProps>(function PositionMirror({ position }, ref) {
  const editor = useEditor<EditorAPI>()
  const [coords, setCoords] = useState({ left: 0, top: 0 })

  useEffect(() => {
    if (editor && position >= 0) {
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
                top: rect.bottom - editorRect.top,
              }
              setCoords(newCoords)
            }
          }
        } catch (error) {
          console.warn('Failed to get cursor coordinates:', error)
        }
      }
    }
  }, [editor, position])

  return <div ref={ref} style={{ position: 'absolute', left: coords.left, top: coords.top, width: 1, height: 1 }} />
})

// Helper function to get mention replace range
interface EditorState {
  doc: {
    toString(): string
  }
  selection: {
    main?: {
      head: number
    }
    head?: number
  }
}

function getCurrentMentionReplaceRange(state: EditorState) {
  if (!state || !state.selection) {
    return null
  }

  const selection = state.selection.main || state.selection
  if (!selection || selection.head === undefined) {
    return null
  }

  const pos = selection.head

  // Check if state.doc is available and has the expected methods
  if (!state.doc || typeof state.doc.toString !== 'function') {
    return null
  }

  const text = state.doc.toString()

  // Check if text is valid
  if (!text || pos < 0 || pos > text.length) {
    return null
  }

  // 从当前位置向前查找触发字符，同时检查是否有自动补全的 }
  let from = pos
  let to = pos
  let triggerLength = 0

  // 检查 {{ 和 { 触发符
  // 获取各个位置的字符片段
  const sliceMinus2 = text.slice(pos - 2, pos)
  const sliceMinus1 = text.slice(pos - 1, pos)
  const sliceCurrent = text.slice(pos, pos + 1)

  if (pos >= 2 && text.slice(pos - 2, pos) === '{{') {
    from = pos - 2
    triggerLength = 2
  } else if (pos >= 1 && text.slice(pos - 1, pos) === '{') {
    from = pos - 1
    triggerLength = 1

    // 检查是否后面有自动补全的 }
    if (text.length > pos && text.slice(pos, pos + 1) === '}') {
      // 如果有自动补全的 }，将其也包含在替换范围内
      to = pos + 1
    }
  } else if (pos >= 1 && text.slice(pos - 1, pos) === '@') {
    from = pos - 1
    triggerLength = 1
  } else if (pos >= 1 && sliceMinus1 === '{' && sliceCurrent === '}') {
    // 新增支持：输入法输入{}后光标在{和}中间的情况
    from = pos - 1
    to = pos + 1
    triggerLength = 1
    console.log('检测到光标在{}中间，设置替换范围', { from, to, triggerLength })
  } else if (pos >= 2 && sliceMinus2 === '{}' && sliceCurrent !== '}') {
    // 新增支持：输入法输入{}后光标在}后面的情况
    from = pos - 2
    to = pos
    triggerLength = 2
    console.log('检测到光标在{}后面，设置替换范围', { from, to, triggerLength })
  } else {
    return null
  }

  return { from, to, triggerLength }
}

type VariableField = BaseVariableField<{ icon?: string | JSX.Element; title?: string }>

export function InputsPicker({ inputsValues, onSelect }: { inputsValues: IInputsValues; onSelect: (v: string) => void }) {
  const scope = useCurrentScope()

  const getArrayDrilldown = (type: ArrayType, depth = 1): { type: BaseType; depth: number } => {
    if (ASTMatch.isArray(type.items)) {
      return getArrayDrilldown(type.items, depth + 1)
    }

    return { type: type.items, depth: depth }
  }

  const renderVariable = (variable: VariableField, keyPath: string[]): TreeNodeData => {
    const type = variable?.type

    let children: TreeNodeData[] | undefined

    if (ASTMatch.isObject(type)) {
      children = (type.properties || [])
        .map(_property => renderVariable(_property as VariableField, [...keyPath, _property.key]))
        .filter(Boolean) as TreeNodeData[]
    }

    if (ASTMatch.isArray(type)) {
      const drilldown = getArrayDrilldown(type)

      if (ASTMatch.isObject(drilldown.type)) {
        children = (drilldown.type.properties || [])
          .map(_property => renderVariable(_property as VariableField, [...keyPath, ...new Array(drilldown.depth).fill('[0]'), _property.key]))
          .filter(Boolean) as TreeNodeData[]
      }
    }

    const key = keyPath.map((_key, idx) => (_key === '[0]' || idx === 0 ? _key : `.${_key}`)).join('')

    return {
      key: key,
      label: last(keyPath),
      value: key,
      children,
    }
  }

  const getTreeData = (value: unknown, keyPath: string[]): TreeNodeData | undefined => {
    const currKey = keyPath.join('.')

    if (FlowValueUtils.isFlowValue(value)) {
      if (FlowValueUtils.isRef(value)) {
        const variable = scope?.available?.getByKeyPath(value.content || [])
        if (variable) {
          return renderVariable(variable, keyPath)
        }
      }
      return {
        key: currKey,
        value: currKey,
        label: last(keyPath),
      }
    }

    if (isPlainObject(value)) {
      return {
        key: currKey,
        value: currKey,
        label: last(keyPath),
        children: Object.entries(value)
          .map(([key, value]) => getTreeData(value, [...keyPath, key])!)
          .filter(Boolean),
      }
    }
  }

  const treeData: TreeNodeData[] = useMemo(
    () =>
      Object.entries(inputsValues)
        .map(([key, value]) => getTreeData(value, [key])!)
        .filter(Boolean),
    [],
  )

  return (
    <Tree
      treeData={treeData}
      onSelect={(selectedKeys, _info) => {
        const selectedKey = Array.isArray(selectedKeys) ? selectedKeys[0] : selectedKeys
        if (selectedKey) {
          onSelect(selectedKey.toString())
        }
      }}
    />
  )
}

const DEFAULT_TRIGGER_CHARACTERS = ['{', '{}', '@']

export function InputsTree({ inputsValues, triggerCharacters = DEFAULT_TRIGGER_CHARACTERS }: { inputsValues: IInputsValues; triggerCharacters?: string[] }) {
  const [posKey, setPosKey] = useState('')
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState(-1)
  const [savedRange, setSavedRange] = useState<{ from: number; to: number } | null>(null)
  const editor = useEditor<EditorAPI>()

  function insert(variablePath: string) {
    if (!editor) {
      return
    }
    // 使用保存的范围，因为变量选择时光标位置可能已经改变
    if (!savedRange) {
      return
    }

    const { from, to } = savedRange
    const insertText = '{{' + variablePath + '}}'

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

  function handleOpenChange(e: { value: boolean; state: EditorState }) {
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

  return (
    <>
      <Mention triggerCharacters={triggerCharacters} onOpenChange={handleOpenChange} />

      <Popover
        visible={visible}
        trigger="custom"
        position="bottomLeft"
        rePosKey={posKey}
        clickToHide={false}
        content={
          <div
            style={{ width: 300, maxHeight: 300, overflowY: 'auto' }}
            onClick={e => {
              e.stopPropagation()
            }}
          >
            <InputsPicker
              inputsValues={inputsValues}
              onSelect={v => {
                insert(v)
              }}
            />
          </div>
        }
      >
        <PositionMirror position={position} onChange={() => setPosKey(String(Math.random()))} />
      </Popover>
    </>
  )
}
