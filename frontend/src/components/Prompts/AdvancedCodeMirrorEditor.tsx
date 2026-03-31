import React, { useCallback, useMemo, useRef } from 'react'
import { Box, InputLabel } from '@mui/material'
import { styled } from '@mui/material/styles'
import CodeMirror, { EditorView, type Extension, Prec } from '@uiw/react-codemirror'
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { isValidVariableName } from '@/utils/prompts/promptEditPageUtils'
import { createMaxLengthExtension } from '@/utils/codemirror/maxLengthExtension'

const JINJA2_KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'endif',
  'for',
  'endfor',
  'while',
  'endwhile',
  'macro',
  'endmacro',
  'set',
  'block',
  'endblock',
  'include',
  'extends',
  'import',
  'in',
  'with',
  'endwith',
  'filter',
  'endfilter',
  'call',
  'endcall',
  'raw',
  'endraw',
])

// 样式化的容器
const EditorContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',

  // CodeMirror 样式覆盖
  '& .cm-editor': {
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    fontSize: '14px',
    fontFamily: '"SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    height: '100%',
    flex: 1,

    '&:hover': {
      borderColor: '#9ca3af',
    },

    '&.cm-focused': {
      borderColor: '#1976d2',
      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
      outline: 'none',
    },
  },

  '& .cm-content': {
    padding: '16px',
    minHeight: '120px',
    maxHeight: '100%',
    lineHeight: '1.6',
    caretColor: '#374151',
    color: '#374151',
    overflow: 'auto',
  },

  // 语法高亮样式 - 直接针对 CodeMirror 的类
  '& .tok-heading': {
    color: '#0891b2 !important',
    fontWeight: 'bold !important',
  },

  '& .tok-list': {
    color: '#2563eb !important',
    fontWeight: '500 !important',
  },

  '& .tok-atom': {
    color: '#e91e63 !important',
    fontWeight: '500 !important',
  },

  '& .tok-variable': {
    color: '#16a34a !important',
    fontWeight: '500 !important',
    backgroundColor: 'rgba(22, 163, 74, 0.1) !important',
    borderRadius: '2px !important',
    padding: '0 2px !important',
  },

  // 有效变量的样式（整个变量包括 {{}} 和内容都是绿色，无背景）
  '& .cm-variable-valid': {
    color: '#16a34a !important',
    fontWeight: '500 !important',
  },

  // 无效变量的括号样式（只有 {{ 和 }} 是绿色）
  '& .cm-variable-bracket': {
    color: '#16a34a !important',
    fontWeight: '500 !important',
  },

  // Jinja2 控制结构样式（粉色）
  '& .cm-jinja2-control': {
    color: '#e91e63 !important',
    fontWeight: '500 !important',
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

// 创建自定义语言定义
const createPromptLanguage = (templateEngine: 'normal' | 'jinja2') =>
  StreamLanguage.define({
    name: 'prompt',
    startState: () => ({
      inVariable: false,
      variableIsValid: false,
      inJinjaControl: false,
    }),
    token: (stream, state) => {
      // normal 模式下禁用 Jinja2 高亮
      const enableJinjaHighlight = templateEngine === 'jinja2'
      if (enableJinjaHighlight) {
        // 使用 tokenizer 直接处理 Jinja2 控制结构，避免依赖 ViewPlugin 生命周期。
        if (state.inJinjaControl) {
          if (stream.eatSpace()) {
            return null
          }

          if (stream.match('%}')) {
            state.inJinjaControl = false
            return 'atom'
          }

          // 在 Jinja2 控制块中，白名单关键字都高亮（如 for/in/endfor）。
          if (stream.match(/[a-zA-Z_][a-zA-Z0-9_]*/)) {
            const keyword = stream.current().toLowerCase()
            return JINJA2_KEYWORDS.has(keyword) ? 'keyword' : null
          }

          stream.next()
          return null
        }

        if (stream.match(/\{%/)) {
          state.inJinjaControl = true
          return 'atom'
        }
      }

      // 变量高亮：无效变量也高亮括号 {{ 和 }}，仅中间内容不高亮
      if (state.inVariable) {
        if (stream.match(/\}\}/)) {
          state.inVariable = false
          return 'bracket'
        }
        if (stream.eatWhile(/[^\}]/)) {
          return state.variableIsValid ? 'variableName' : null
        }
        // 兜底推进，避免卡住
        stream.next()
        return state.variableIsValid ? 'variableName' : null
      }

      if (stream.match(/\{\{/)) {
        const allowSpaces = templateEngine === 'jinja2'
        const closeIndex = stream.string.indexOf('}}', stream.pos)
        const rawVariableName = closeIndex >= 0 ? stream.string.slice(stream.pos, closeIndex) : ''
        state.variableIsValid = isValidVariableName(rawVariableName, allowSpaces)
        state.inVariable = true
        return 'bracket'
      }

      // 处理标题 # 开头 - 必须在行首
      if (stream.sol() && stream.match(/^#+/)) {
        stream.skipToEnd()
        return 'heading'
      }

      // 处理列表项 1. 2. 3. a. b. c. - 必须在行首或前面有空格
      if (stream.sol() || (stream.column() > 0 && stream.string.substring(0, stream.pos).match(/^\s+$/))) {
        if (stream.match(/(\d+\.|[a-zA-Z]\.)/)) {
          return 'strong' // 使用 strong 标签来应用蓝色样式
        }
      }

      stream.next()
      return null
    },
    languageData: {
      commentTokens: { line: '//' },
    },
  })

// 创建语法高亮样式
const promptHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#0891b2', fontWeight: 'bold' },
  { tag: tags.strong, color: '#2563eb', fontWeight: '500' },
  { tag: tags.keyword, color: '#e91e63', fontWeight: '500' },
  { tag: tags.atom, color: '#e91e63', fontWeight: '500' },
  { tag: tags.bracket, color: '#16a34a', fontWeight: '500' },
  { tag: tags.variableName, color: '#16a34a', fontWeight: '500' },
])

// 创建主题扩展
const createPromptTheme = (): Extension[] => {
  return [
    EditorView.theme({
      '&': {
        fontSize: '14px',
        fontFamily: '"SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
      },
      '.cm-content': {
        padding: '16px',
        minHeight: '120px',
        maxHeight: '100%',
        lineHeight: '1.6',
        color: '#374151',
        overflow: 'auto',
      },
      '.cm-scroller': {
        maxHeight: '100%',
        overflow: 'auto',
        overflowX: 'hidden !important',
      },
      '.cm-focused': {
        outline: 'none',
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
      // 语法高亮样式
      '.tok-heading': {
        color: '#0891b2 !important',
        fontWeight: 'bold !important',
      },
      '.tok-list': {
        color: '#2563eb !important',
        fontWeight: '500 !important',
      },
      '.tok-atom': {
        color: '#e91e63 !important',
        fontWeight: '500 !important',
      },
      '.tok-variable': {
        color: '#16a34a !important',
        fontWeight: '500 !important',
        backgroundColor: 'rgba(22, 163, 74, 0.1) !important',
        borderRadius: '2px !important',
        padding: '0 2px !important',
      },
      // 有效变量的样式（整个变量包括 {{}} 和内容都是绿色，无背景）
      '.cm-variable-valid': {
        color: '#16a34a !important',
        fontWeight: '500 !important',
      },
      // 无效变量的括号样式（只有 {{ 和 }} 是绿色）
      '.cm-variable-bracket': {
        color: '#16a34a !important',
        fontWeight: '500 !important',
      },
      // 有效变量的样式（整个变量包括 {{}} 和内容都是绿色）
      '.tok-variable-valid': {
        color: '#16a34a !important',
        fontWeight: '500 !important',
        backgroundColor: 'rgba(22, 163, 74, 0.1) !important',
        borderRadius: '2px !important',
        padding: '0 2px !important',
      },
      // 无效变量的括号样式（只有 {{ 和 }} 是绿色）
      '.tok-variable-bracket': {
        color: '#16a34a !important',
        fontWeight: '500 !important',
      },
      // Jinja2 控制结构样式（粉色）
      '.cm-jinja2-control': {
        color: '#e91e63 !important',
        fontWeight: '500 !important',
      },
    }),
    syntaxHighlighting(promptHighlightStyle),
  ]
}

interface AdvancedCodeMirrorEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  label?: string
  minHeight?: number
  maxHeight?: number
  maxLength?: number // 最大字符长度限制
  className?: string
  fullWidth?: boolean
  multiline?: boolean
  minRows?: number
  maxRows?: number
  sx?: any
  InputProps?: any
  inputProps?: any
  // 新增：文本选中和光标位置事件回调
  onTextSelection?: (selectedText: string, position: { x: number; y: number }, messageId?: string) => void
  onCursorPositionChange?: (position: { x: number; y: number }, cursorPos: number) => void
  messageId?: string // 用于标识消息，传递给回调函数
  templateEngine?: 'normal' | 'jinja2' // 模板引擎模式，用于变量验证
  optimizationSourceType?: 'main' | 'base' | 'control' // 优化来源类型，用于调整按钮位置偏移量
}

/**
 * 高级 CodeMirror 提示词编辑器
 * 提供专业的语法高亮和完美的编辑体验
 */
const AdvancedCodeMirrorEditor: React.FC<AdvancedCodeMirrorEditorProps> = ({
  value,
  onChange,
  placeholder = '输入提示词内容...\n\n支持语法：\n# 标题 (蓝绿色加粗)\n1. 列表 (数字蓝色)\n{{变量}} (绿色高亮)',
  disabled = false,
  label,
  minHeight = 120,
  maxHeight,
  maxLength,
  className,
  minRows,
  onTextSelection,
  onCursorPositionChange,
  messageId,
  templateEngine = 'normal',
  optimizationSourceType = 'main',
  sx,
  ...props
}) => {
  const cursorTimerRef = useRef<NodeJS.Timeout | null>(null)
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 根据 minRows 计算实际最小高度
  const calculatedMinHeight = minRows ? minRows * 20 + 32 : minHeight // 每行约20px，加上padding等额外空间

  // 创建事件处理扩展
  const eventExtensions = useMemo(() => {
    const extensions: Extension[] = []

    // 添加选择变化监听器
    if (onTextSelection || onCursorPositionChange) {
      extensions.push(
        EditorView.updateListener.of(update => {
          if (update.selectionSet || update.focusChanged) {
            const state = update.state
            const selection = state.selection.main

            // 处理文本选中
            if (!selection.empty && onTextSelection) {
              const selectedText = state.doc.sliceString(selection.from, selection.to)
              if (selectedText.trim()) {
                // 清除之前的选中定时器
                if (selectionTimerRef.current) {
                  clearTimeout(selectionTimerRef.current)
                }

                // 延迟触发选中回调，确保选中操作已完成（鼠标已释放）
                selectionTimerRef.current = setTimeout(() => {
                  // 再次检查选中状态，确保用户没有取消选中
                  const currentState = update.view.state
                  const currentSelection = currentState.selection.main
                  if (!currentSelection.empty) {
                    const currentSelectedText = currentState.doc.sliceString(currentSelection.from, currentSelection.to)
                    if (currentSelectedText.trim()) {
                      // 获取选中区域的DOM位置
                      const view = update.view

                      // 获取选中区域的起始位置坐标
                      const startCoords = view.coordsAtPos(currentSelection.from)
                      const endCoords = view.coordsAtPos(currentSelection.to)

                      // 获取选中文本所在的行信息
                      const selectionLine = view.state.doc.lineAt(currentSelection.from)
                      const lastLine = view.state.doc.lineAt(currentSelection.to)
                      const isMultiLine = selectionLine.number !== lastLine.number

                      // 获取选中文本所在行在输入框中的实际起始位置
                      // 我们需要找到该行第一个可见字符的位置
                      // 如果该行有前导空格，我们需要找到第一个非空白字符的位置

                      // 获取该行在文档中的起始位置
                      const selectionLineStartPos = selectionLine.from
                      const lineStartCoords = view.coordsAtPos(selectionLineStartPos)

                      // 获取该行的文本内容
                      const lineText = view.state.doc.sliceString(selectionLine.from, selectionLine.to)

                      // 找到该行第一个非空白字符的位置
                      // 如果该行全是空白，使用行起始位置
                      const firstNonWhitespaceIndex = lineText.search(/\S/)
                      let selectionLineStartCoords = lineStartCoords

                      if (firstNonWhitespaceIndex >= 0) {
                        // 找到第一个非空白字符在文档中的位置
                        const firstNonWhitespacePos = selectionLine.from + firstNonWhitespaceIndex
                        const firstNonWhitespaceCoords = view.coordsAtPos(firstNonWhitespacePos)

                        // 如果第一个非空白字符和选中起始位置在同一行，使用第一个非空白字符的x坐标，但y坐标使用选中起始位置的y坐标
                        if (firstNonWhitespaceCoords && startCoords && Math.abs(firstNonWhitespaceCoords.top - startCoords.top) < 1) {
                          // 同一行，使用第一个非空白字符的x坐标作为该行的起始位置
                          selectionLineStartCoords = {
                            left: firstNonWhitespaceCoords.left,
                            top: startCoords.top, // 使用选中起始位置的y坐标
                            right: firstNonWhitespaceCoords.right,
                            bottom: firstNonWhitespaceCoords.bottom,
                          }
                        } else {
                          // 如果不在同一行（不应该发生），使用行起始位置
                          selectionLineStartCoords = lineStartCoords
                        }
                      } else {
                        // 该行全是空白，使用行起始位置
                        selectionLineStartCoords = lineStartCoords
                      }

                      if (selectionLineStartCoords && startCoords) {
                        // 计算一行高度（基于行高1.6和字体大小14px，约22.4px）
                        const lineHeight = 22
                        // 按钮和选中文本之间的间距（希望按钮底部距离选中文本1行）
                        const spacing = lineHeight // 1行间距

                        // 使用选中文本的起始位置（水平方向），而不是该行第一个字符的位置
                        // 这样按钮会显示在选中文本的起始位置上方
                        const selectedStartX = startCoords.left
                        // 使用选中起始位置的y坐标（确保按钮和选中文本在同一行高度）
                        const selectedTop = startCoords.top

                        // 按钮应显示在选中文本起始位置上方 1 行（按钮底部与选中区域间距 1 行）
                        const position = {
                          x: selectedStartX, // 使用选中文本的起始位置（相对于视口）
                          y: selectedTop - spacing, // 按钮底部在 selectedTop - 1 行
                        }

                        onTextSelection(currentSelectedText, position, messageId)
                      }
                    }
                  }
                }, 200) // 200ms 延迟，确保选中操作完成
              }
            } else if (selection.empty && selectionTimerRef.current) {
              // 如果选中被清除，取消延迟回调
              clearTimeout(selectionTimerRef.current)
              selectionTimerRef.current = null
            }

            // 处理光标位置变化
            if (selection.empty && onCursorPositionChange) {
              // 清除之前的定时器
              if (cursorTimerRef.current) {
                clearTimeout(cursorTimerRef.current)
              }

              // 设置1秒后触发光标位置回调
              cursorTimerRef.current = setTimeout(() => {
                const view = update.view
                const coords = view.coordsAtPos(selection.from)

                if (coords) {
                  // 计算一行高度（基于行高1.6和字体大小14px，约22.4px）
                  const lineHeight = 22
                  // IconButton size="small" 的实际高度约26px
                  const buttonHeight = 26
                  const spacing = lineHeight // 1行间距，按钮底部距离光标1行

                  // 调整偏移量：让按钮出现在光标上方一行的位置
                  const extraOffset = 0 // 减少偏移量，让按钮更接近光标
                  const targetButtonBottom = coords.top - spacing // 按钮底部应该在光标上方1行
                  const targetButtonTop = targetButtonBottom - buttonHeight // 按钮顶部位置

                  // 水平位置：使用光标的中心位置，让按钮中心对齐到光标中心
                  const cursorCenterX = (coords.left + coords.right) / 2
                  const calculatedPosition = {
                    x: cursorCenterX,
                    y: targetButtonTop - extraOffset, // 减去额外偏移，让实际位置正确
                  }

                  onCursorPositionChange(calculatedPosition, selection.from)
                }
              }, 1000)
            }
          }
        }),
      )
    }

    return extensions
  }, [onTextSelection, onCursorPositionChange])

  // 清理定时器
  React.useEffect(() => {
    return () => {
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current)
      }
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current)
      }
    }
  }, [])

  // 创建扩展
  const extensions = useMemo(() => {
    const baseExtensions = [
      createPromptLanguage(templateEngine),
      ...createPromptTheme(),
      // 提高优先级，避免被其它扩展覆盖；flex 子项需配合 minWidth:0 才能正确测量换行宽度
      Prec.high(EditorView.lineWrapping),
      ...eventExtensions, // 添加事件处理扩展
      ...createMaxLengthExtension(maxLength, onChange), // 添加最大长度限制扩展
    ]

    // 添加高度约束
    baseExtensions.push(
      EditorView.theme({
        '&': {
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          maxHeight: maxHeight ? `${maxHeight}px` : '100%',
        },
        '.cm-scroller': {
          maxHeight: maxHeight ? `${maxHeight}px` : '100%',
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
        },
      }),
    )

    return baseExtensions
  }, [maxHeight, eventExtensions, templateEngine, maxLength, onChange])

  // 处理值变化
  const handleChange = useCallback(
    (val: string) => {
      onChange(val)
    },
    [onChange],
  )

  return (
    <EditorContainer
      className={className}
      sx={[
        {
          '& .cm-content': {
            minHeight: `${calculatedMinHeight}px`,
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {label && (
        <InputLabel shrink sx={{ mb: 1, color: '#374151', fontWeight: 500 }}>
          {label}
        </InputLabel>
      )}

      <Box sx={{ flex: 1, height: '100%', width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
        <CodeMirror
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          editable={!disabled}
          extensions={extensions}
          width="100%"
          minWidth="0"
          maxWidth="100%"
          height="100%"
          {...(maxHeight != null ? { maxHeight: `${maxHeight}px` } : {})}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: false,
            bracketMatching: false,
            closeBrackets: false,
            autocompletion: false,
            highlightSelectionMatches: false,
            searchKeymap: false,
            tabSize: 2,
            highlightActiveLine: false, // 禁用当前行高亮
          }}
          theme="light"
          style={{
            minHeight: 0,
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
          }}
        />
      </Box>
    </EditorContainer>
  )
}

export default AdvancedCodeMirrorEditor
