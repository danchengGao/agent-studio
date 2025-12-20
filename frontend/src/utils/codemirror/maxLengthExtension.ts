import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

/**
 * 创建 CodeMirror 最大长度限制扩展
 *
 * 该扩展提供以下功能:
 * 1. 在用户编辑或粘贴时，如果总文本数超过 maxLength，自动截断文本
 * 2. 处理粘贴事件，自动截断超出部分
 * 3. 处理 IME 输入（中文输入法等），在输入完成后截断超出部分
 *
 * @param maxLength 最大字符长度限制
 * @param onChange 可选的值变化回调函数,用于在截断时通知外部组件
 * @returns CodeMirror Extension 数组
 *
 * @example
 * ```typescript
 * import { createMaxLengthExtension } from '@/utils/codemirror/maxLengthExtension'
 *
 * const extensions = [
 *   javascript(),
 *   ...createMaxLengthExtension(1000, (truncatedValue) => {
 *     console.log('Value truncated:', truncatedValue)
 *   })
 * ]
 * ```
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export const createMaxLengthExtension = (maxLength?: number, onChange?: { (value: string): void }): Extension[] => {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  if (!maxLength) return []

  // 跟踪是否正在进行 IME 输入（中文输入法等）
  let isComposing = false

  /**
   * 截断文档到最大长度
   */
  const truncateDocument = (view: EditorView) => {
    const currentValue = view.state.doc.toString()
    const currentLength = currentValue.length

    if (currentLength > maxLength) {
      const truncated = currentValue.slice(0, maxLength)
      const currentSelection = view.state.selection.main

      // 确保选择位置不超过截断后的文档长度
      const safeAnchor = Math.min(currentSelection.anchor, truncated.length)
      const safeHead = Math.min(currentSelection.head, truncated.length)

      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: truncated,
        },
        selection: {
          anchor: safeAnchor,
          head: safeHead,
        },
      })

      // 通知外部组件
      if (onChange) {
        onChange(truncated)
      }
    }
  }

  return [
    // 监听 IME 组合事件和粘贴事件
    EditorView.domEventHandlers({
      compositionstart() {
        isComposing = true
      },
      compositionupdate() {
        isComposing = true
      },
      compositionend(_event, view) {
        isComposing = false
        // IME 输入完成后，检查并截断
        setTimeout(() => {
          truncateDocument(view)
        }, 0)
      },
      paste(event, view) {
        const clipboardData = event.clipboardData
        if (!clipboardData) return

        const pastedText = clipboardData.getData('text/plain')
        if (!pastedText) return

        // 阻止默认粘贴行为
        event.preventDefault()

        const docLength = view.state.doc.length
        const selection = view.state.selection.main

        // 确保选择范围在文档范围内
        const safeFrom = Math.max(0, Math.min(selection.from, docLength))
        const safeTo = Math.max(safeFrom, Math.min(selection.to, docLength))

        // 计算将被删除的文本长度
        const deletedLength = safeTo - safeFrom

        // 计算删除后的文档长度
        const afterDeleteLength = docLength - deletedLength

        // 计算剩余可用空间
        const remainingSpace = maxLength - afterDeleteLength

        // 计算可以粘贴的文本长度
        // 注意：由于 CodeMirror 可能会进行字符规范化（如 \r\n -> \n），
        // 实际插入的字符数可能少于我们计算的字符数。
        // 因此，我们插入稍多一些的文本（多插入一些以确保有足够的字符），
        // 然后统一截断到 maxLength
        const allowedLength = Math.max(0, remainingSpace)
        // 为了应对字符规范化，我们多插入一些文本（比如多插入 10% 或至少 100 个字符）
        // 这样可以确保即使有字符被规范化，也能有足够的字符
        const bufferSize = Math.max(100, Math.floor(allowedLength * 0.1))
        const textToInsert = pastedText.slice(0, allowedLength + bufferSize)

        // 如果没有任何文本可以粘贴，直接返回
        if (textToInsert.length === 0 && deletedLength === 0) {
          return
        }

        // 先应用 changes，不设置选择位置，让 CodeMirror 自动处理
        try {
          view.dispatch({
            changes: {
              from: safeFrom,
              to: safeTo,
              insert: textToInsert,
            },
          })

          // 在下一个事件循环中，统一截断到 maxLength 并设置光标位置
          setTimeout(() => {
            const actualDocLength = view.state.doc.length

            // 统一截断到 maxLength（truncateDocument 会处理）
            if (actualDocLength > maxLength) {
              truncateDocument(view)
            } else {
              // 如果文档长度未超过限制，设置光标位置
              const actualInsertedLength = actualDocLength - afterDeleteLength
              const correctCursorPos = Math.min(safeFrom + actualInsertedLength, actualDocLength)
              view.dispatch({
                selection: {
                  anchor: correctCursorPos,
                  head: correctCursorPos,
                },
              })
            }
          }, 0)
        } catch (error) {
          // 如果出错，使用备用方案：不设置选择位置
          console.warn('粘贴操作出错，使用备用方案:', error)
          try {
            // 备用方案：只插入允许的长度
            const safeTextToInsert = pastedText.slice(0, allowedLength)
            view.dispatch({
              changes: {
                from: safeFrom,
                to: safeTo,
                insert: safeTextToInsert,
              },
            })
            // 备用方案后也检查并截断
            setTimeout(() => {
              const finalLength = view.state.doc.length
              if (finalLength > maxLength) {
                truncateDocument(view)
              }
            }, 0)
          } catch (fallbackError) {
            console.error('粘贴操作完全失败:', fallbackError)
          }
        }
      },
    }),

    // 监听文档更新，在非 IME 输入时检查并截断
    EditorView.updateListener.of(update => {
      // 如果正在进行 IME 输入，跳过（IME 输入在 compositionend 中处理）
      if (isComposing) {
        return
      }

      // 如果文档发生变化，检查并截断
      if (update.docChanged) {
        const newValue = update.state.doc.toString()
        if (newValue.length > maxLength) {
          setTimeout(() => {
            truncateDocument(update.view)
          }, 0)
        }
      }
    }),
  ]
}
