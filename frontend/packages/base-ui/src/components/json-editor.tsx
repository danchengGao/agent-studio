import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent } from './ui/card'
import { RotateCcw, Zap } from 'lucide-react'
import { FixedSizeList as List } from 'react-window'

interface JsonEditorProps {
  value?: string
  initialValue?: string
  onChange?: (value: any, isValid: boolean) => void
  schema?: any // JSON Schema for validation
  showLineNumbers?: boolean
  readOnly?: boolean
  enableVirtualScroll?: boolean
  estimatedLineHeight?: number
  outputs?: any // outputs字段用于生成默认值
}

interface AutocompleteItem {
  label: string
  type: 'key' | 'value' | 'schema'
  insertText: string
  detail?: string
}

export function JsonEditor({
  value,
  initialValue = '',
  onChange,
  schema,
  showLineNumbers = true,
  readOnly = false,
  enableVirtualScroll = false,
  estimatedLineHeight = 24,
  outputs,
}: JsonEditorProps) {
  // 完全基于outputs字段生成默认值
  const generateDefaultValue = useCallback(() => {
    if (outputs && outputs.properties) {
      const defaultObj: Record<string, any> = {}
      Object.keys(outputs.properties).forEach(key => {
        const prop = outputs.properties[key]
        if (prop.type === 'string') {
          defaultObj[key] = ''
        } else if (prop.type === 'number') {
          defaultObj[key] = 0
        } else if (prop.type === 'boolean') {
          defaultObj[key] = false
        } else if (prop.type === 'array') {
          defaultObj[key] = []
        } else if (prop.type === 'object') {
          defaultObj[key] = {}
        } else {
          defaultObj[key] = ''
        }
      })
      return JSON.stringify(defaultObj, null, 2)
    }

    // 如果没有outputs，返回空对象
    return '{}'
  }, [outputs])

  const [jsonInput, setJsonInput] = useState(() => {
    // 如果有value，优先使用value
    if (value) return value
    // 如果有initialValue，使用initialValue
    if (initialValue) return initialValue
    // 否则生成默认值
    return generateDefaultValue()
  })
  const [error, setError] = useState<string | null>(null)
  const [isValid, setIsValid] = useState(true)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([])
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [schemaErrors, setSchemaErrors] = useState<string[]>([])
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 当value发生变化时，更新JsonEditor内容
  useEffect(() => {
    if (value !== undefined) {
      setJsonInput(value)
    }
  }, [value])

  // 只在没有value且当前没有内容时，根据outputs生成默认值
  useEffect(() => {
    if (value === undefined && !jsonInput.trim()) {
      const newDefaultValue = generateDefaultValue()
      setJsonInput(newDefaultValue)
    }
  }, [outputs, generateDefaultValue, value])

  const validateJson = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setError(null)
        setIsValid(true)
        setSchemaErrors([])
        onChange?.({}, true)
        return
      }

      // 基础 JSON 格式验证
      try {
        const parsed = JSON.parse(value)
        setError(null)
        setIsValid(true)

        // JSON Schema 验证
        if (schema) {
          const schemaValidationErrors = validateJsonSchema(parsed, schema)
          setSchemaErrors(schemaValidationErrors)
          if (schemaValidationErrors.length > 0) {
            setError(`Schema validation failed: ${schemaValidationErrors[0]}`)
          }
        } else {
          setSchemaErrors([])
        }

        onChange?.(parsed, !schema || schemaValidationErrors.length === 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid JSON')
        setIsValid(false)
        setSchemaErrors([])
        onChange?.(null, false)
      }
    },
    [onChange, schema],
  )

  const validateJsonSchema = (data: any, schema: any): string[] => {
    const errors: string[] = []

    // 基础类型验证
    if (schema.type && typeof data !== schema.type) {
      errors.push(`Expected ${schema.type}, got ${typeof data}`)
    }

    // 必需字段验证
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach((field: string) => {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`)
        }
      })
    }

    // 属性验证
    if (schema.properties && typeof data === 'object') {
      Object.keys(schema.properties).forEach(key => {
        if (key in data) {
          const propErrors = validateJsonSchema(data[key], schema.properties[key])
          errors.push(...propErrors.map((e: string) => `${key}: ${e}`))
        }
      })
    }

    return errors
  }

  useEffect(() => {
    validateJson(jsonInput)
  }, [jsonInput])

  const handleInputChange = (value: string) => {
    setJsonInput(value)
  }

  // 自动补全功能
  const generateAutocompleteItems = (context: string, position: number): AutocompleteItem[] => {
    const items: AutocompleteItem[] = []

    // 基础 JSON 值补全
    const basicValues: AutocompleteItem[] = [
      { label: 'string', type: 'value', insertText: '"string"', detail: '字符串' },
      { label: 'number', type: 'value', insertText: '0', detail: '数字' },
      { label: 'boolean', type: 'value', insertText: 'true', detail: '布尔值' },
      { label: 'null', type: 'value', insertText: 'null', detail: '空值' },
      { label: 'array', type: 'value', insertText: '[]', detail: '数组' },
      { label: 'object', type: 'value', insertText: '{}', detail: '对象' },
    ]

    // Schema 相关补全
    if (schema) {
      if (schema.properties) {
        Object.keys(schema.properties).forEach(key => {
          items.push({
            label: key,
            type: 'schema',
            insertText: `"${key}"`,
            detail: `Schema property: ${schema.properties[key].type || 'any'}`,
          })
        })
      }
    }

    return [...items, ...basicValues]
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && showAutocomplete) {
      e.preventDefault()
      const selectedItem = autocompleteItems[selectedAutocompleteIndex]
      if (selectedItem) {
        insertAutocompleteItem(selectedItem)
      }
    } else if (e.key === 'ArrowDown' && showAutocomplete) {
      e.preventDefault()
      setSelectedAutocompleteIndex(prev => Math.min(prev + 1, autocompleteItems.length - 1))
    } else if (e.key === 'ArrowUp' && showAutocomplete) {
      e.preventDefault()
      setSelectedAutocompleteIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false)
    }
  }

  const handleCursorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const cursorPos = e.target.selectionStart
    setCursorPosition(cursorPos)

    // 检查是否应该显示自动补全
    const textBeforeCursor = e.target.value.substring(0, cursorPos)
    const lastToken = getLastToken(textBeforeCursor)

    if (lastToken && (lastToken.startsWith('"') || lastToken === '')) {
      const items = generateAutocompleteItems(textBeforeCursor, cursorPos)
      if (items.length > 0) {
        setAutocompleteItems(items)
        setShowAutocomplete(true)
        setSelectedAutocompleteIndex(0)
      }
    } else {
      setShowAutocomplete(false)
    }
  }

  const getLastToken = (text: string): string => {
    const match = text.match(/["\w]*$/)
    return match ? match[0] : ''
  }

  const insertAutocompleteItem = (item: AutocompleteItem) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = textarea.value.substring(0, start)
    const lastToken = getLastToken(textBefore)
    const tokenStart = start - lastToken.length

    const newValue = textarea.value.substring(0, tokenStart) + item.insertText + textarea.value.substring(end)

    setJsonInput(newValue)
    setShowAutocomplete(false)

    // 设置光标位置
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = tokenStart + item.insertText.length
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleReset = () => {
    const defaultValue = generateDefaultValue()
    setJsonInput(defaultValue)
    // 重新验证以确保状态正确
    validateJson(defaultValue)
  }

  const handleFormat = () => {
    if (jsonInput.trim()) {
      try {
        const parsed = JSON.parse(jsonInput)
        const formatted = JSON.stringify(parsed, null, 2)
        setJsonInput(formatted)
      } catch (err) {
        console.error('Cannot format invalid JSON')
      }
    }
  }

  const syntaxHighlight = (json: string) => {
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],])/g, match => {
      let cls = 'json-number'
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key'
        } else {
          cls = 'json-string'
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean'
      } else if (/null/.test(match)) {
        cls = 'json-null'
      } else if (/[{}[\],]/.test(match)) {
        cls = 'json-punctuation'
      }
      return `<span class="${cls}">${match}</span>`
    })
  }

  const addLineNumbers = (content: string) => {
    const lines = content.split('\n')
    return lines.map((line, index) => ({
      number: index + 1,
      content: line,
    }))
  }

  const linesWithNumbers = addLineNumbers(jsonInput)

  // 虚拟滚动支持
  const getVisibleLines = () => {
    if (!enableVirtualScroll) {
      return linesWithNumbers
    }

    return linesWithNumbers.slice(visibleRange.start, visibleRange.end)
  }

  const handleItemsRendered = ({ visibleStartIndex, visibleStopIndex }: any) => {
    setVisibleRange({
      start: Math.max(0, visibleStartIndex - 10),
      end: Math.min(linesWithNumbers.length, visibleStopIndex + 10),
    })
  }

  const VirtualizedLine = ({ index, style }: { index: number; style: any }) => {
    const line = linesWithNumbers[index]
    if (!line) return null

    const handleLineClick = () => {
      if (textareaRef.current) {
        // 计算点击位置在文本中的偏移量
        const lines = jsonInput.split('\n')
        let offset = 0
        for (let i = 0; i < index; i++) {
          offset += lines[i].length + 1 // +1 for newline
        }

        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(offset, offset)
        setCursorPosition(offset)
      }
    }

    return (
      <div style={style} className="flex">
        {showLineNumbers && (
          <div className="flex flex-col bg-muted/20 text-muted-foreground text-xs font-mono leading-6 px-3 select-none border-r border-border flex-shrink-0">
            <div className="flex items-center justify-end">
              <div className="text-right min-w-[2ch]">{line.number}</div>
            </div>
          </div>
        )}
        <div className="flex-1 relative min-h-[24px]" onClick={handleLineClick} style={{ zIndex: 1 }}>
          <div className="absolute inset-0 p-4 font-mono text-sm leading-6 cursor-text">
            <pre
              className="whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{
                __html: syntaxHighlight(line.content),
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const visibleLines = getVisibleLines()

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="border border-border">
        <CardContent className="p-0">
          <div className="relative bg-muted/10" ref={containerRef}>
            {/* 紧凑的工具栏 */}
            <div className="absolute top-2 right-2 z-50 flex items-center gap-1 pointer-events-auto">
              <button
                onClick={handleReset}
                className="w-5 h-5 rounded-md bg-background/90 backdrop-blur-sm border border-border hover:bg-background transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-sm pointer-events-auto"
                title="重置"
              >
                <RotateCcw className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />
              </button>
              <button
                onClick={handleFormat}
                className="w-5 h-5 rounded-md bg-background/90 backdrop-blur-sm border border-border hover:bg-background transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-sm pointer-events-auto"
                title="格式化"
              >
                <Zap className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            {enableVirtualScroll ? (
              // 虚拟滚动模式
              <div className="flex">
                {/* 虚拟滚动编辑器 */}
                <div className="flex-1">
                  {/* 隐藏的文本输入区域 */}
                  <textarea
                    ref={textareaRef}
                    value={jsonInput}
                    onChange={e => {
                      handleInputChange(e.target.value)
                      handleCursorChange(e)
                    }}
                    onKeyDown={handleKeyDown}
                    className="absolute w-full h-full opacity-0 pointer-events-none"
                    style={{ height: '192px' }}
                    spellCheck={false}
                    readOnly={readOnly}
                  />

                  {/* 虚拟滚动列表 */}
                  <List height={192} itemCount={linesWithNumbers.length} itemSize={estimatedLineHeight} onItemsRendered={handleItemsRendered} overscanCount={5}>
                    {VirtualizedLine}
                  </List>
                </div>

                {/* Autocomplete popup */}
                {showAutocomplete && autocompleteItems.length > 0 && (
                  <div
                    className="absolute bg-background border border-border rounded-md shadow-sm z-10 max-h-60 overflow-y-auto"
                    style={{
                      top: `${(cursorPosition / 50) * 20 + 80}px`,
                      left: `${(cursorPosition % 50) * 8 + 20}px`,
                    }}
                  >
                    {autocompleteItems.map((item, index) => (
                      <div
                        key={index}
                        className={`px-3 py-2 cursor-pointer text-sm ${
                          index === selectedAutocompleteIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                        onClick={() => insertAutocompleteItem(item)}
                      >
                        <div className="font-medium">{item.label}</div>
                        {item.detail && <div className="text-xs text-muted-foreground">{item.detail}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // 传统模式
              <div className="flex">
                {/* Line numbers */}
                {showLineNumbers && (
                  <div className="flex flex-col bg-muted/20 text-muted-foreground text-xs font-mono leading-6 py-4 px-3 select-none border-r border-border">
                    {linesWithNumbers.map(line => (
                      <div key={line.number} className="flex items-center justify-end">
                        <div className="text-right min-w-[2ch]">{line.number}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Editor content */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={jsonInput}
                    onChange={e => {
                      handleInputChange(e.target.value)
                      handleCursorChange(e)
                    }}
                    onKeyDown={handleKeyDown}
                    className={`w-full h-[192px] p-4 bg-transparent border-none outline-none resize-none font-mono text-sm leading-6 text-foreground`}
                    spellCheck={false}
                    readOnly={readOnly}
                  />

                  {/* Syntax highlighted overlay */}
                  <div className="absolute inset-0 p-4 pointer-events-none font-mono text-sm leading-6 overflow-auto">
                    <pre
                      className="whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{
                        __html: syntaxHighlight(jsonInput),
                      }}
                    />
                  </div>

                  {/* Autocomplete popup */}
                  {showAutocomplete && autocompleteItems.length > 0 && (
                    <div
                      className="absolute bg-background border border-border rounded-md shadow-sm z-10 max-h-60 overflow-y-auto"
                      style={{
                        top: `${(cursorPosition / 50) * 20 + 80}px`,
                        left: `${(cursorPosition % 50) * 8 + 20}px`,
                      }}
                    >
                      {autocompleteItems.map((item, index) => (
                        <div
                          key={index}
                          className={`px-3 py-2 cursor-pointer text-sm ${
                            index === selectedAutocompleteIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                          onClick={() => insertAutocompleteItem(item)}
                        >
                          <div className="font-medium">{item.label}</div>
                          {item.detail && <div className="text-xs text-muted-foreground">{item.detail}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
