import { useEffect, RefObject, useMemo } from 'react'

/**
 * 自定义 Hook：检测点击是否在指定元素外部
 * 只在 enabled 为 true 时添加监听器，性能更优
 *
 * @param refs - 需要排除的元素 ref 数组（点击这些元素不会触发回调）
 * @param handler - 点击外部时的回调函数
 * @param enabled - 是否启用监听（默认 true）
 */
export function useClickOutside(refs: Array<RefObject<HTMLElement | null>>, handler: (event: MouseEvent) => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // 检查点击是否在任何排除的元素内部
      const isInsideAnyRef = refs.some(ref => {
        const element = ref.current
        if (!element) return false
        return element.contains(target) || element === target
      })

      // 如果点击在排除元素外部，触发回调
      if (!isInsideAnyRef) {
        handler(event)
      }
    }

    // 使用捕获阶段，确保在其他事件处理器之前执行
    document.addEventListener('mousedown', handleClick, true)

    return () => {
      document.removeEventListener('mousedown', handleClick, true)
    }
  }, [refs, handler, enabled])
}

/**
 * 自定义 Hook：检测点击是否在指定选择器匹配的元素外部
 * 使用选择器字符串而不是 ref，适用于动态元素
 *
 * @param selectors - 需要排除的选择器数组（点击这些元素不会触发回调）
 * @param handler - 点击外部时的回调函数
 * @param enabled - 是否启用监听（默认 true）
 */
export function useClickOutsideSelectors(selectors: string[], handler: (event: MouseEvent) => void, enabled: boolean = true) {
  // 使用 useMemo 稳定选择器数组的引用，避免不必要的重新创建监听器
  const stableSelectors = useMemo(() => selectors, [selectors.join(',')])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // 检查点击是否匹配任何排除的选择器
      const isInsideAnySelector = stableSelectors.some(selector => {
        try {
          // 先检查元素本身
          if (target.matches && target.matches(selector)) {
            return true
          }
          // 再检查父元素
          if (target.closest(selector)) {
            return true
          }
        } catch (e) {
          // 忽略无效选择器
        }
        return false
      })

      // 如果点击在排除元素外部，触发回调
      if (!isInsideAnySelector) {
        handler(event)
      }
    }

    // 使用捕获阶段，确保在其他事件处理器之前执行
    document.addEventListener('mousedown', handleClick, true)

    return () => {
      document.removeEventListener('mousedown', handleClick, true)
    }
  }, [stableSelectors, handler, enabled])
}
