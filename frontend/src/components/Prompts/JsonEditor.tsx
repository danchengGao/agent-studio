import React, { useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Box, InputLabel } from '@mui/material'
import { styled } from '@mui/material/styles'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { Extension, EditorState } from '@codemirror/state'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'
import { showTooltip, Tooltip, hoverTooltip, tooltips } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { createMaxLengthExtension } from '@/utils/codemirror/maxLengthExtension'

// 样式化的容器
const JsonEditorContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 999990,

  // CodeMirror 样式覆盖
  '& .cm-editor': {
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: '"SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    height: '100%',
    flex: 1,

    '&:hover': {
      borderColor: '#9ca3af',
    },

    '&.cm-focused': {
      borderColor: '#10b981',
      boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
      outline: 'none',
    },
  },

  '& .cm-content': {
    padding: '8px 12px',
    minHeight: '32px',
    maxHeight: '100%',
    lineHeight: '1.4',
    caretColor: '#374151',
    color: '#374151',
  },

  '& .cm-scroller': {
    maxHeight: '100%',
    fontFamily: 'inherit',
  },

  '& .cm-line': {
    padding: '0',
  },

  // JSON语法高亮样式
  '& .tok-propertyName': {
    color: '#0891b2 !important',
    fontWeight: '500 !important',
  },

  '& .tok-string': {
    color: '#059669 !important',
  },

  '& .tok-number': {
    color: '#dc2626 !important',
    fontWeight: '500 !important',
  },

  '& .tok-keyword': {
    color: '#7c3aed !important',
    fontWeight: 'bold !important',
  },

  '& .tok-null': {
    color: '#6b7280 !important',
    fontStyle: 'italic !important',
  },

  '& .tok-bool': {
    color: '#ea580c !important',
    fontWeight: 'bold !important',
  },

  '& .tok-brace': {
    color: '#374151 !important',
    fontWeight: 'bold !important',
  },

  '& .tok-bracket': {
    color: '#374151 !important',
    fontWeight: 'bold !important',
  },

  // 错误提示样式
  '& .cm-diagnostic': {
    '&.cm-diagnostic-error': {
      borderLeft: '3px solid #ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
  },

  // 错误标记样式
  '& .cm-lintRange-error': {
    textDecoration: 'underline',
    textDecorationColor: '#ef4444',
    textDecorationStyle: 'wavy',
    textUnderlineOffset: '2px',
  },

  '& .cm-tooltip': {
    backgroundColor: '#1f2937',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    zIndex: 9999,
    maxWidth: '400px',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    position: 'fixed !important',
  },

  // 禁用当前行高亮背景
  '& .cm-activeLine': {
    backgroundColor: 'transparent !important',
  },

  '& .cm-activeLineGutter': {
    backgroundColor: 'transparent !important',
  },

  // 占位符样式
  '& .cm-placeholder': {
    color: '#9ca3af',
    opacity: 0.8,
  },
})

// 创建JSON语法高亮样式
const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: '#0891b2', fontWeight: '500' },
  { tag: tags.string, color: '#059669' },
  { tag: tags.number, color: '#dc2626', fontWeight: '500' },
  { tag: tags.keyword, color: '#7c3aed', fontWeight: 'bold' },
  { tag: tags.null, color: '#6b7280', fontStyle: 'italic' },
  { tag: tags.bool, color: '#ea580c', fontWeight: 'bold' },
  { tag: tags.brace, color: '#374151', fontWeight: 'bold' },
  { tag: tags.bracket, color: '#374151', fontWeight: 'bold' },
])

// 创建主题扩展
const createJsonTheme = (minHeight?: number, maxHeight?: number): Extension[] => {
  return [
    EditorView.theme({
      '&': {
        fontSize: '13px',
        fontFamily: '"SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
      },
      '.cm-content': {
        padding: '8px 12px',
        minHeight: minHeight ? `${minHeight}px` : '32px',
        maxHeight: maxHeight ? `${maxHeight}px` : '100%',
        lineHeight: '1.4',
        color: '#374151',
      },
      '.cm-scroller': {
        maxHeight: maxHeight ? `${maxHeight}px` : '100%',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-line': {
        padding: '0',
      },
      '.cm-placeholder': {
        color: '#9ca3af',
        opacity: 0.8,
      },
      // 禁用当前行高亮
      '.cm-activeLine': {
        backgroundColor: 'transparent !important',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent !important',
      },
      // 错误tooltip样式
      '.cm-tooltip': {
        backgroundColor: '#1f2937 !important',
        color: 'white !important',
        border: 'none !important',
        borderRadius: '6px !important',
        fontSize: '12px !important',
        zIndex: '9999 !important',
        maxWidth: '300px !important',
        wordWrap: 'break-word !important',
        whiteSpace: 'pre-wrap !important',
        padding: '8px 12px !important',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3) !important',
        position: 'fixed !important',
        pointerEvents: 'none !important',
        transform: 'translateZ(0) !important',
        willChange: 'transform !important',
      },
      '.cm-tooltip.cm-tooltip-above': {
        marginBottom: '8px !important',
      },
      '.cm-tooltip.cm-tooltip-below': {
        marginTop: '8px !important',
      },
    }),
    syntaxHighlighting(jsonHighlightStyle),
  ]
}

interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  label?: string
  minHeight?: number
  maxHeight?: number
  maxLength?: number
  className?: string
  error?: boolean
  helperText?: string
}

/**
 * JSON编辑器组件
 * 基于CodeMirror，提供JSON语法高亮、错误检测和自动格式化功能
 */
const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  placeholder = '请输入有效的JSON对象，如：{"key": "value"}',
  disabled = false,
  label,
  minHeight = 40,
  maxHeight = 200,
  maxLength,
  className,
  error = false,
  helperText,
}) => {
  const editorRef = useRef<any>(null)
  // 自动格式化JSON
  const formatJson = useCallback((jsonString: string): string => {
    if (!jsonString.trim()) return jsonString

    try {
      const parsed = JSON.parse(jsonString)
      return JSON.stringify(parsed, null, 2)
    } catch (error) {
      // 如果解析失败，返回原始字符串
      return jsonString
    }
  }, [])

  // 创建自定义tooltip扩展
  const customTooltipExtension = useMemo(() => {
    return EditorView.theme({
      '.cm-tooltip': {
        position: 'fixed !important',
        zIndex: '9999 !important',
        backgroundColor: '#1f2937 !important',
        color: 'white !important',
        border: 'none !important',
        borderRadius: '6px !important',
        fontSize: '12px !important',
        maxWidth: '300px !important',
        wordWrap: 'break-word !important',
        whiteSpace: 'pre-wrap !important',
        padding: '8px 12px !important',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3) !important',
        lineHeight: '1.4 !important',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
        pointerEvents: 'none !important',
        transform: 'translateZ(0) !important',
      },
      '.cm-tooltip-arrow': {
        display: 'block !important',
        position: 'absolute !important',
        width: '0 !important',
        height: '0 !important',
        borderStyle: 'solid !important',
      },
      '.cm-tooltip.cm-tooltip-above .cm-tooltip-arrow': {
        bottom: '-6px !important',
        left: '50% !important',
        marginLeft: '-6px !important',
        borderWidth: '6px 6px 0 6px !important',
        borderColor: '#1f2937 transparent transparent transparent !important',
      },
      '.cm-tooltip.cm-tooltip-below .cm-tooltip-arrow': {
        top: '-6px !important',
        left: '50% !important',
        marginLeft: '-6px !important',
        borderWidth: '0 6px 6px 6px !important',
        borderColor: 'transparent transparent #1f2937 transparent !important',
      },
      '.cm-tooltip.cm-tooltip-above': {
        marginBottom: '8px !important',
      },
      '.cm-tooltip.cm-tooltip-below': {
        marginTop: '8px !important',
      },
    })
  }, [])

  // 创建扩展
  const extensions = useMemo(() => {
    const baseExtensions = [
      json(),
      linter(jsonParseLinter()),
      // 自定义tooltip配置 - 挂载到body下突破面板z-index限制
      tooltips({
        position: 'fixed',
        parent: document.body,
      }),
      customTooltipExtension,
      ...createJsonTheme(minHeight, maxHeight),
      EditorView.lineWrapping,
      // 使用公共的最大长度限制扩展
      ...createMaxLengthExtension(maxLength, onChange),
    ]

    // 添加tooltip显示/隐藏监听器
    baseExtensions.push(
      EditorView.updateListener.of(update => {
        // 查找最近的json-editor-container
        const editorElement = update.view.dom
        const container = editorElement.closest('.json-editor-container')

        if (container) {
          // 检查是否有tooltip显示
          const hasTooltip = document.body.querySelector('.cm-tooltip')

          if (hasTooltip) {
            container.classList.add('tooltip-active')
          } else {
            container.classList.remove('tooltip-active')
          }
        }
      }),
    )

    // 添加自动格式化功能(与长度限制分开)
    baseExtensions.push(
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString()

          // 检查是否是粘贴操作或者内容显著变化(可能需要格式化)
          const transaction = update.transactions[0]
          if (transaction && transaction.changes.inserted.length > 0) {
            const insertedText = transaction.changes.inserted.join('')

            // 如果插入的文本包含JSON结构标识符,尝试格式化
            if (insertedText.includes('{') || insertedText.includes('[') || insertedText.includes('"')) {
              try {
                const parsed = JSON.parse(newValue)
                const formatted = JSON.stringify(parsed, null, 2)

                // 只有当格式化后的内容与当前内容不同时才更新
                // 长度限制由 maxLengthExtension 处理
                if (formatted !== newValue) {
                  // 延迟格式化,避免干扰用户输入
                  setTimeout(() => {
                    onChange(formatted)
                  }, 100)
                  return
                }
              } catch (error) {
                // 解析失败,不进行格式化
              }
            }
          }
        }
      }),
    )

    return baseExtensions
  }, [minHeight, maxHeight, maxLength, onChange, customTooltipExtension])

  // 处理值变化
  // 长度限制由 maxLengthExtension 处理,这里只需要传递值
  const handleChange = useCallback(
    (val: string) => {
      onChange(val)
    },
    [onChange],
  )

  // 处理粘贴事件,自动格式化
  // 长度限制由 maxLengthExtension 处理
  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const pastedText = event.clipboardData.getData('text')
      if (pastedText.trim()) {
        try {
          const parsed = JSON.parse(pastedText)
          const formatted = JSON.stringify(parsed, null, 2)

          event.preventDefault()
          onChange(formatted)
        } catch (error) {
          // 如果不是有效JSON,让默认粘贴行为处理(会被 maxLengthExtension 限制长度)
        }
      }
    },
    [onChange],
  )

  return (
    <JsonEditorContainer className={className}>
      {label && (
        <InputLabel shrink sx={{ mb: 1, color: error ? '#ef4444' : '#374151', fontWeight: 500 }}>
          {label}
        </InputLabel>
      )}

      <Box
        sx={{
          flex: 1,
          height: '100%',
          border: error ? '1px solid #ef4444' : 'none',
          borderRadius: error ? '4px' : 'none',
        }}
        onPaste={handlePaste}
      >
        <CodeMirror
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          editable={!disabled}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: false,
            searchKeymap: true,
            tabSize: 2,
            highlightActiveLine: false,
          }}
          theme="light"
          style={{
            height: '100%',
          }}
        />
      </Box>

      {helperText && (
        <Box sx={{ mt: 0.5 }}>
          <span
            style={{
              fontSize: '12px',
              color: error ? '#ef4444' : '#6b7280',
              lineHeight: '1.4',
            }}
          >
            {helperText}
          </span>
        </Box>
      )}
    </JsonEditorContainer>
  )
}

export default JsonEditor
