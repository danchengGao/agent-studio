import React, { useCallback, useMemo, useState } from 'react'
import { Box, InputLabel, FormControl, Select, MenuItem, IconButton, Tooltip, Snackbar } from '@mui/material'
import { styled } from '@mui/material/styles'
import { Copy } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { sql } from '@codemirror/lang-sql'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { xml } from '@codemirror/lang-xml'
import { php } from '@codemirror/lang-php'
import { rust } from '@codemirror/lang-rust'
import { go } from '@codemirror/lang-go'
import { createMaxLengthExtension } from '@/utils/codemirror/maxLengthExtension'

// 样式化的容器
const CodeEditorContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',

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
      borderColor: '#1976d2',
      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
      outline: 'none',
    },
  },

  '& .cm-content': {
    padding: '8px 12px', // 恢复正常padding
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

  // 禁用当前行高亮背景
  '& .cm-activeLine': {
    backgroundColor: 'rgba(25, 118, 210, 0.05) !important',
  },

  '& .cm-activeLineGutter': {
    backgroundColor: 'rgba(25, 118, 210, 0.05) !important',
  },

  // 占位符样式
  '& .cm-placeholder': {
    color: '#9ca3af',
    opacity: 0.8,
  },
})

// 创建代码语法高亮样式
const codeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#0000ff', fontWeight: 'bold' },
  { tag: tags.string, color: '#008000' },
  { tag: tags.comment, color: '#808080', fontStyle: 'italic' },
  { tag: tags.number, color: '#ff0000' },
  { tag: tags.operator, color: '#000000', fontWeight: 'bold' },
  { tag: tags.function(tags.variableName), color: '#795e26' },
  { tag: tags.className, color: '#267f99' },
  { tag: tags.typeName, color: '#267f99' },
])

// 支持的编程语言列表
const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'xml', label: 'XML' },
  { value: 'php', label: 'PHP' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'json', label: 'JSON' },
]

// 语言扩展映射
const getLanguageExtension = (language: string) => {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'jsx':
      return javascript({ jsx: true })
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'python':
    case 'py':
      return python()
    case 'java':
      return java()
    case 'cpp':
    case 'c++':
    case 'c':
      return cpp()
    case 'sql':
      return sql()
    case 'html':
      return html()
    case 'css':
      return css()
    case 'xml':
      return xml()
    case 'php':
      return php()
    case 'rust':
    case 'rs':
      return rust()
    case 'go':
      return go()
    default:
      return javascript() // 默认使用JavaScript语法
  }
}

// 创建主题扩展
const createCodeTheme = (minHeight?: number, maxHeight?: number): Extension[] => {
  return [
    EditorView.theme({
      '&': {
        fontSize: '13px',
        fontFamily: '"SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
      },
      '.cm-content': {
        padding: '8px 12px', // 恢复正常padding
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
      // 当前行高亮
      '.cm-activeLine': {
        backgroundColor: 'rgba(25, 118, 210, 0.05) !important',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(25, 118, 210, 0.05) !important',
      },
    }),
    syntaxHighlighting(codeHighlightStyle),
  ]
}

interface CodeEditorProps {
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
  language?: string // 编程语言类型
  showLanguageSelector?: boolean // 是否显示语言选择器
  onLanguageChange?: (language: string) => void // 语言变化回调
}

/**
 * 代码编辑器组件
 * 基于CodeMirror，提供多种编程语言的语法高亮
 */
const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  placeholder = '请输入代码...',
  disabled = false,
  label,
  minHeight = 40,
  maxHeight = 200,
  maxLength,
  className,
  error = false,
  helperText,
  language = 'javascript',
  showLanguageSelector = true,
  onLanguageChange,
}) => {
  // 内部语言状态，如果没有外部控制则使用内部状态
  const [internalLanguage, setInternalLanguage] = useState(language)
  const currentLanguage = onLanguageChange ? language : internalLanguage

  // 复制功能状态
  const [copySuccess, setCopySuccess] = useState(false)

  // 处理语言变化
  const handleLanguageChange = useCallback(
    (newLanguage: string) => {
      if (onLanguageChange) {
        onLanguageChange(newLanguage)
      } else {
        setInternalLanguage(newLanguage)
      }
    },
    [onLanguageChange],
  )

  // 创建扩展
  const extensions = useMemo(() => {
    const baseExtensions = [
      getLanguageExtension(currentLanguage),
      ...createCodeTheme(minHeight, maxHeight),
      EditorView.lineWrapping,
      ...createMaxLengthExtension(maxLength, onChange),
    ]

    return baseExtensions
  }, [currentLanguage, minHeight, maxHeight, maxLength, onChange])

  // 处理值变化
  const handleChange = useCallback(
    (val: string) => {
      // 长度限制统一在 maxLengthExtension 中处理，这里直接传递值
      onChange(val)
    },
    [onChange],
  )

  // 处理复制代码
  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopySuccess(true)
    } catch (err) {
      // 如果现代API不可用，使用备用方法
      const textArea = document.createElement('textarea')
      textArea.value = value
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        setCopySuccess(true)
      } catch (err) {
        console.error('复制失败:', err)
      }
      document.body.removeChild(textArea)
    }
  }, [value])

  // 关闭复制成功提示
  const handleCloseCopySuccess = useCallback(() => {
    setCopySuccess(false)
  }, [])

  return (
    <CodeEditorContainer className={className}>
      {label && (
        <InputLabel shrink sx={{ mb: 1, color: error ? '#ef4444' : '#374151', fontWeight: 500 }}>
          {label}
        </InputLabel>
      )}

      {/* 语言选择器 */}
      {showLanguageSelector && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '4px 4px 0 0',
              border: '1px solid #d1d5db',
              borderBottom: 'none',
              minHeight: '44px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>语言:</span>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={currentLanguage}
                  onChange={e => handleLanguageChange(e.target.value)}
                  variant="outlined"
                  displayEmpty
                  sx={{
                    fontSize: '13px',
                    height: '32px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#d1d5db',
                    },
                    '& .MuiSelect-select': {
                      padding: '6px 10px',
                      fontWeight: 500,
                      color: '#374151',
                    },
                    '& .MuiSelect-icon': {
                      color: '#64748b',
                      fontSize: '18px',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#9ca3af',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#1976d2',
                      borderWidth: '2px',
                    },
                  }}
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <MenuItem
                      key={lang.value}
                      value={lang.value}
                      sx={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#374151',
                        padding: '8px 12px',
                        '&:hover': {
                          backgroundColor: '#f1f5f9',
                        },
                        '&.Mui-selected': {
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          '&:hover': {
                            backgroundColor: '#bae6fd',
                          },
                        },
                      }}
                    >
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* 复制按钮 */}
            <Tooltip title="复制代码" arrow>
              <IconButton
                size="small"
                onClick={handleCopyCode}
                disabled={!value.trim()}
                sx={{
                  padding: '6px',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  color: '#64748b',
                  '&:hover': {
                    backgroundColor: '#f8fafc',
                    borderColor: '#94a3b8',
                    color: '#475569',
                  },
                  '&:disabled': {
                    backgroundColor: '#f8fafc',
                    borderColor: '#e2e8f0',
                    color: '#cbd5e1',
                  },
                }}
              >
                <Copy size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* 分隔线 */}
          <Box
            sx={{
              height: '1px',
              backgroundColor: '#d1d5db',
              width: '100%',
            }}
          />
        </>
      )}

      {/* 如果没有语言选择器，在编辑器顶部显示复制按钮 */}
      {!showLanguageSelector && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '8px 12px',
            backgroundColor: '#f8fafc',
            borderRadius: '4px 4px 0 0',
            border: '1px solid #d1d5db',
            borderBottom: 'none',
            minHeight: '40px',
          }}
        >
          <Tooltip title="复制代码" arrow>
            <IconButton
              size="small"
              onClick={handleCopyCode}
              disabled={!value.trim()}
              sx={{
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                color: '#64748b',
                '&:hover': {
                  backgroundColor: '#f8fafc',
                  borderColor: '#94a3b8',
                  color: '#475569',
                },
                '&:disabled': {
                  backgroundColor: '#f8fafc',
                  borderColor: '#e2e8f0',
                  color: '#cbd5e1',
                },
              }}
            >
              <Copy size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
          borderRadius: showLanguageSelector ? '0 0 4px 4px' : '0 0 4px 4px',
          borderTop: showLanguageSelector ? 'none' : 'none',
        }}
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
            highlightActiveLine: true,
          }}
          theme="light"
          style={{
            height: '100%',
            maxHeight: '100%',
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

      {/* 复制成功提示 */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={handleCloseCopySuccess}
        message="代码已复制到剪贴板"
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: '#10b981',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '8px',
          },
        }}
      />
    </CodeEditorContainer>
  )
}

export default CodeEditor
