import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

// 单词级别的差异检测
const getWordDiff = (oldText: string, newText: string) => {
  if (!oldText && !newText) return { oldParts: [], newParts: [] }
  if (!oldText) return { oldParts: [], newParts: [{ type: 'add', text: newText }] }
  if (!newText) return { oldParts: [{ type: 'delete', text: oldText }], newParts: [] }

  // 智能分割文本 - 支持中英文混合
  const splitIntoTokens = (text: string) => {
    const tokens: string[] = []
    let current = ''
    let currentType: 'chinese' | 'english' | 'space' | 'punctuation' | null = null

    // 判断字符类型
    const getCharType = (char: string): 'chinese' | 'english' | 'space' | 'punctuation' => {
      const code = char.charCodeAt(0)

      // 空格和制表符
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        return 'space'
      }

      // 中文字符范围（包括中文标点符号）
      if (
        (code >= 0x4e00 && code <= 0x9fff) || // 基本汉字
        (code >= 0x3400 && code <= 0x4dbf) || // 扩展A
        (code >= 0x20000 && code <= 0x2a6df) || // 扩展B
        (code >= 0x2a700 && code <= 0x2b73f) || // 扩展C
        (code >= 0x2b740 && code <= 0x2b81f) || // 扩展D
        (code >= 0x2b820 && code <= 0x2ceaf) || // 扩展E
        (code >= 0xf900 && code <= 0xfaff) || // 兼容汉字
        (code >= 0x2f800 && code <= 0x2fa1f)
      ) {
        // 兼容扩展
        return 'chinese'
      }

      // 英文字母和数字
      if (
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        (code >= 48 && code <= 57)
      ) {
        // 0-9
        return 'english'
      }

      // 其他字符视为标点符号
      return 'punctuation'
    }

    const pushCurrentToken = () => {
      if (current) {
        tokens.push(current)
        current = ''
      }
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const charType = getCharType(char)

      if (charType === 'space') {
        // 遇到空格，先推送当前token，然后推送空格
        pushCurrentToken()
        tokens.push(char)
        currentType = null
      } else if (charType === 'chinese') {
        // 中文字符，每个字符作为独立token
        pushCurrentToken()
        tokens.push(char)
        currentType = null
      } else if (charType === 'english') {
        // 英文字符，组成单词
        if (currentType === 'english') {
          current += char
        } else {
          pushCurrentToken()
          current = char
          currentType = 'english'
        }
      } else if (charType === 'punctuation') {
        // 标点符号，每个符号作为独立token
        pushCurrentToken()
        tokens.push(char)
        currentType = null
      }
    }

    // 推送最后的token
    pushCurrentToken()

    return tokens
  }

  const oldTokens = splitIntoTokens(oldText)
  const newTokens = splitIntoTokens(newText)

  // 使用动态规划计算最长公共子序列
  const oldLen = oldTokens.length
  const newLen = newTokens.length
  const dp = Array(oldLen + 1)
    .fill(null)
    .map(() => Array(newLen + 1).fill(0))

  for (let i = 1; i <= oldLen; i++) {
    for (let j = 1; j <= newLen; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // 回溯生成差异
  const oldParts: Array<{ type: 'same' | 'delete'; text: string }> = []
  const newParts: Array<{ type: 'same' | 'add'; text: string }> = []

  let i = oldLen,
    j = newLen

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      // 相同的token
      oldParts.unshift({ type: 'same', text: oldTokens[i - 1] })
      newParts.unshift({ type: 'same', text: newTokens[j - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // 新增的token
      newParts.unshift({ type: 'add', text: newTokens[j - 1] })
      j--
    } else if (i > 0) {
      // 删除的token
      oldParts.unshift({ type: 'delete', text: oldTokens[i - 1] })
      i--
    }
  }

  return { oldParts, newParts }
}

// 渲染带有差异高亮的文本
const renderDiffText = (parts: Array<{ type: string; text: string }>, isOldVersion: boolean) => {
  return parts.map((part, index) => {
    if (part.type === 'same') {
      return <span key={index}>{part.text}</span>
    } else if (part.type === 'add' && !isOldVersion) {
      return (
        <span key={index} className="bg-green-200 text-green-800 px-0.5 rounded">
          {part.text}
        </span>
      )
    } else if (part.type === 'delete' && isOldVersion) {
      return (
        <span key={index} className="bg-red-200 text-red-800 px-0.5 rounded">
          {part.text}
        </span>
      )
    }
    return null
  })
}

// DiffViewer组件 - 实现GitHub风格的Split对比视图和expand功能
interface DiffViewerProps {
  oldContent: string
  newContent: string
  autoScroll?: boolean // 新增：是否自动滚动到底部
}

const DiffViewer: React.FC<DiffViewerProps> = ({ oldContent, newContent, autoScroll = false }) => {
  const { t } = useTranslation()
  const [expandedSections, setExpandedSections] = useState(new Set<string>())
  const containerRef = useRef<HTMLDivElement>(null)

  // 智能差异检测算法 - 类似Git diff，支持修改行检测
  const generateDiff = (oldLines: string[], newLines: string[]) => {
    const oldLen = oldLines.length
    const newLen = newLines.length

    // 动态规划矩阵，计算最长公共子序列(LCS)
    const dp = Array(oldLen + 1)
      .fill(null)
      .map(() => Array(newLen + 1).fill(0))

    // 填充DP表
    for (let i = 1; i <= oldLen; i++) {
      for (let j = 1; j <= newLen; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }

    // 回溯生成差异，并尝试配对连续的删除和添加为修改
    const rawDiff: any[] = []
    let i = oldLen,
      j = newLen

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        // 相同行
        rawDiff.unshift({
          type: 'same',
          oldLine: oldLines[i - 1],
          newLine: newLines[j - 1],
          oldLineNum: i,
          newLineNum: j,
        })
        i--
        j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        // 新增行
        rawDiff.unshift({
          type: 'add',
          oldLine: null,
          newLine: newLines[j - 1],
          oldLineNum: null,
          newLineNum: j,
        })
        j--
      } else if (i > 0) {
        // 删除行
        rawDiff.unshift({
          type: 'delete',
          oldLine: oldLines[i - 1],
          newLine: null,
          oldLineNum: i,
          newLineNum: null,
        })
        i--
      }
    }

    // 后处理：将连续的删除和添加合并为修改
    const diff: any[] = []
    let k = 0

    while (k < rawDiff.length) {
      const current = rawDiff[k]

      if (current.type === 'delete') {
        // 查找紧邻的添加行
        const deleteItems = []
        let deleteIndex = k

        while (deleteIndex < rawDiff.length && rawDiff[deleteIndex].type === 'delete') {
          deleteItems.push(rawDiff[deleteIndex])
          deleteIndex++
        }

        const addItems = []
        let addIndex = deleteIndex

        while (addIndex < rawDiff.length && rawDiff[addIndex].type === 'add') {
          addItems.push(rawDiff[addIndex])
          addIndex++
        }

        // 如果删除和添加的数量相等，则视为修改
        if (deleteItems.length > 0 && addItems.length > 0 && deleteItems.length === addItems.length) {
          for (let m = 0; m < deleteItems.length; m++) {
            diff.push({
              type: 'modify',
              oldLine: deleteItems[m].oldLine,
              newLine: addItems[m].newLine,
              oldLineNum: deleteItems[m].oldLineNum,
              newLineNum: addItems[m].newLineNum,
            })
          }
          k = addIndex
        } else {
          // 否则保持原样
          deleteItems.forEach(item => diff.push(item))
          addItems.forEach(item => diff.push(item))
          k = addIndex
        }
      } else {
        diff.push(current)
        k++
      }
    }

    return diff
  }

  // 处理上下文显示和折叠逻辑
  const processContextDiff = (diff: any[], contextLines = 3) => {
    const result: any[] = []
    let i = 0
    let sectionId = 0

    // 如果文件开头有相同行且超过上下文行数，添加expand按钮
    if (diff.length > 0 && diff[0].type === 'same') {
      let sameCount = 0
      while (sameCount < diff.length && diff[sameCount].type === 'same') {
        sameCount++
      }

      if (sameCount > contextLines) {
        const currentSectionId = `start-${sectionId++}`
        const isExpanded = expandedSections.has(currentSectionId)

        if (isExpanded) {
          // 显示所有开头的相同行
          for (let j = 0; j < sameCount; j++) {
            result.push(diff[j])
          }
        } else {
          // 只显示最后几行作为上下文
          const startContext = Math.max(0, sameCount - contextLines)
          result.push({
            type: 'expand',
            expandType: 'down',
            hiddenCount: startContext,
            sectionId: currentSectionId,
            onExpand: () => {
              setExpandedSections(prev => new Set([...prev, currentSectionId]))
            },
          })
          for (let j = startContext; j < sameCount; j++) {
            result.push(diff[j])
          }
        }
        i = sameCount
      } else {
        // 相同行数量不多，直接显示
        for (let j = 0; j < sameCount; j++) {
          result.push(diff[j])
        }
        i = sameCount
      }
    }

    while (i < diff.length) {
      // 添加变更行（包括delete, add, modify）
      while (i < diff.length && diff[i].type !== 'same') {
        result.push(diff[i])
        i++
      }

      if (i >= diff.length) break

      // 处理变更后的相同行
      const sameStart = i
      while (i < diff.length && diff[i].type === 'same') {
        i++
      }
      const sameCount = i - sameStart

      if (i >= diff.length) {
        // 文件末尾的相同行
        if (sameCount > contextLines) {
          const currentSectionId = `end-${sectionId++}`
          const isExpanded = expandedSections.has(currentSectionId)

          if (isExpanded) {
            // 显示所有末尾的相同行
            for (let j = sameStart; j < i; j++) {
              result.push(diff[j])
            }
          } else {
            // 只显示开头几行作为上下文
            const endContext = Math.min(sameStart + contextLines, i)
            for (let j = sameStart; j < endContext; j++) {
              result.push(diff[j])
            }
            result.push({
              type: 'expand',
              expandType: 'up',
              hiddenCount: sameCount - contextLines,
              sectionId: currentSectionId,
              onExpand: () => {
                setExpandedSections(prev => new Set([...prev, currentSectionId]))
              },
            })
          }
        } else {
          // 相同行数量不多，直接显示
          for (let j = sameStart; j < i; j++) {
            result.push(diff[j])
          }
        }
      } else {
        // 中间的相同行
        if (sameCount > contextLines * 2) {
          const currentSectionId = `middle-${sectionId++}`
          const isExpanded = expandedSections.has(currentSectionId)

          if (isExpanded) {
            // 显示所有中间的相同行
            for (let j = sameStart; j < i; j++) {
              result.push(diff[j])
            }
          } else {
            // 显示前后上下文，中间用expand按钮
            for (let j = sameStart; j < sameStart + contextLines; j++) {
              result.push(diff[j])
            }

            const hiddenCount = sameCount - contextLines * 2
            result.push({
              type: 'expand',
              expandType: 'all',
              hiddenCount: hiddenCount,
              sectionId: currentSectionId,
              onExpand: () => {
                setExpandedSections(prev => new Set([...prev, currentSectionId]))
              },
            })

            for (let j = i - contextLines; j < i; j++) {
              result.push(diff[j])
            }
          }
        } else {
          // 相同行数量不多，直接显示
          for (let j = sameStart; j < i; j++) {
            result.push(diff[j])
          }
        }
      }
    }

    return result
  }

  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const diffResult = generateDiff(oldLines, newLines)
  const contextDiff = processContextDiff(diffResult)

  // 自动滚动到底部（当内容更新且启用自动滚动时）
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      const scrollToBottom = () => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }

      // 延迟滚动，确保DOM已更新
      const timer = setTimeout(scrollToBottom, 10)
      return () => clearTimeout(timer)
    }
  }, [newContent, autoScroll])

  return (
    <div ref={containerRef} className="flex h-full overflow-auto">
      {/* 左侧：旧版本 */}
      <div className="flex-1 border-r border-gray-300">
        <div className="font-mono text-sm">
          {contextDiff.map((diffItem, index) => {
            const { type, oldLine, oldLineNum, expandType, hiddenCount, onExpand } = diffItem

            if (type === 'expand') {
              return (
                <div
                  key={`expand-old-${index}`}
                  className="flex min-h-[32px] bg-blue-50 hover:bg-blue-100 cursor-pointer border-y border-blue-200"
                  onClick={onExpand}
                >
                  <div className="w-12 bg-blue-100 text-blue-600 text-center py-2 text-xs font-mono border-r border-blue-200 select-none">⋮</div>
                  <div className="flex-1 px-3 py-2 flex items-center justify-center">
                    <div className="flex items-center space-x-2 text-blue-600 hover:text-blue-800">
                      {expandType === 'up' && (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <span className="text-xs font-medium">{t('components.prompts.diffViewer.expandDown', { count: hiddenCount })}</span>
                        </>
                      )}
                      {expandType === 'down' && (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          <span className="text-xs font-medium">{t('components.prompts.diffViewer.expandUp', { count: hiddenCount })}</span>
                        </>
                      )}
                      {expandType === 'all' && (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                          </svg>
                          <span className="text-xs font-medium">{t('components.prompts.diffViewer.expandAll', { count: hiddenCount })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={`old-${index}`}
                className={`flex min-h-[24px] ${
                  type === 'add' ? 'bg-gray-100' : type === 'delete' ? 'bg-red-50' : type === 'modify' ? 'bg-red-50' : 'bg-white'
                }`}
              >
                <div
                  className={`w-12 text-center py-1 text-xs font-mono select-none ${
                    type === 'add'
                      ? 'bg-gray-200 text-gray-400'
                      : type === 'delete'
                        ? 'bg-red-100 text-red-600'
                        : type === 'modify'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-500'
                  } border-r border-gray-200`}
                >
                  {type === 'add' ? '' : oldLineNum || ''}
                </div>
                <div className="flex-1 px-3 py-1">
                  {type === 'add' ? (
                    <span className="text-gray-400 select-none">&nbsp;</span>
                  ) : type === 'delete' ? (
                    <span className="text-red-600">
                      <span className="text-red-500 select-none">-</span>
                      <span className="whitespace-pre-wrap ml-1">{oldLine}</span>
                    </span>
                  ) : type === 'modify' ? (
                    <span className="text-red-600">
                      <span className="text-red-500 select-none">-</span>
                      <span className="whitespace-pre-wrap ml-1">
                        {(() => {
                          const { oldParts } = getWordDiff(oldLine || '', diffItem.newLine || '')
                          return renderDiffText(oldParts, true)
                        })()}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-700 whitespace-pre-wrap">{oldLine}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 右侧：新版本 */}
      <div className="flex-1">
        <div className="font-mono text-sm">
          {contextDiff.map((diffItem, index) => {
            const { type, newLine, newLineNum, expandType, hiddenCount, onExpand } = diffItem

            if (type === 'expand') {
              return (
                <div
                  key={`expand-new-${index}`}
                  className="flex min-h-[32px] bg-blue-50 hover:bg-blue-100 cursor-pointer border-y border-blue-200"
                  onClick={onExpand}
                >
                  <div className="w-12 bg-blue-100 text-blue-600 text-center py-2 text-xs font-mono border-r border-blue-200 select-none">⋮</div>
                  <div className="flex-1 px-3 py-2 flex items-center justify-center">
                    <div className="flex items-center space-x-2 text-blue-600 hover:text-blue-800">
                      {expandType === 'up' && (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <span className="text-xs font-medium">{t('components.prompts.diffViewer.expandDown', { count: hiddenCount })}</span>
                        </>
                      )}
                      {expandType === 'down' && (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          <span className="text-xs font-medium">{t('components.prompts.diffViewer.expandUp', { count: hiddenCount })}</span>
                        </>
                      )}
                      {expandType === 'all' && (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                          </svg>
                          <span className="text-xs font-medium">{t('components.prompts.diffViewer.expandAll', { count: hiddenCount })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={`new-${index}`}
                className={`flex min-h-[24px] ${
                  type === 'delete' ? 'bg-gray-100' : type === 'add' ? 'bg-green-50' : type === 'modify' ? 'bg-green-50' : 'bg-white'
                }`}
              >
                <div
                  className={`w-12 text-center py-1 text-xs font-mono select-none ${
                    type === 'delete'
                      ? 'bg-gray-200 text-gray-400'
                      : type === 'add'
                        ? 'bg-green-100 text-green-600'
                        : type === 'modify'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-500'
                  } border-r border-gray-200`}
                >
                  {type === 'delete' ? '' : newLineNum || ''}
                </div>
                <div className="flex-1 px-3 py-1">
                  {type === 'delete' ? (
                    <span className="text-gray-400 select-none">&nbsp;</span>
                  ) : type === 'add' ? (
                    <span className="text-green-600">
                      <span className="text-green-500 select-none">+</span>
                      <span className="whitespace-pre-wrap ml-1">{newLine}</span>
                    </span>
                  ) : type === 'modify' ? (
                    <span className="text-green-600">
                      <span className="text-green-500 select-none">+</span>
                      <span className="whitespace-pre-wrap ml-1">
                        {(() => {
                          const { newParts } = getWordDiff(diffItem.oldLine || '', newLine || '')
                          return renderDiffText(newParts, false)
                        })()}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-700 whitespace-pre-wrap">{newLine}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default DiffViewer
