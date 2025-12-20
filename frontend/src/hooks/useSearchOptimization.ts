import { useState, useEffect, useRef, useCallback } from 'react'

interface UseOptimizedSearchOptions {
  debounceDelay?: number
  minChars?: number
  enabled?: boolean
  immediateOnEmpty?: boolean
  respectComposition?: boolean // 是否尊重输入法组合状态
}

interface UseOptimizedSearchReturn {
  searchTerm: string
  debouncedSearchTerm: string
  isSearching: boolean
  isComposing: boolean
  setSearchTerm: (term: string) => void
  immediateSearch: () => void
  resetSearch: () => void
  cancelPendingSearch: () => void
  handleCompositionStart: () => void
  handleCompositionEnd: () => void
}

export const useOptimizedSearch = (onSearch?: (searchTerm: string) => void, options: UseOptimizedSearchOptions = {}): UseOptimizedSearchReturn => {
  const { debounceDelay = 300, minChars = 2, enabled = true, immediateOnEmpty = true, respectComposition = true } = options

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // 验证搜索条件是否满足
  const isValidSearchTerm = useCallback(
    (term: string): boolean => {
      return term.length >= minChars || (term.length === 0 && immediateOnEmpty)
    },
    [minChars, immediateOnEmpty],
  )

  // 执行搜索的核心函数
  const executeSearch = useCallback(
    (term: string) => {
      if (!enabled || !isValidSearchTerm(term)) return

      setIsSearching(true)

      try {
        onSearch?.(term)
      } catch (error) {
        console.error('Search callback error:', error)
      } finally {
        setIsSearching(false)
      }
    },
    [enabled, isValidSearchTerm, onSearch],
  )

  // 防抖处理和搜索执行
  useEffect(() => {
    if (!enabled) {
      setDebouncedSearchTerm(searchTerm)
      return
    }

    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // 输入法组合期间不触发搜索
    if (respectComposition && isComposing) {
      return
    }

    // 设置防抖定时器
    timeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      executeSearch(searchTerm)
    }, debounceDelay)

    // 清理函数
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [searchTerm, debounceDelay, enabled, executeSearch, isComposing, respectComposition])

  // 清除待处理的搜索定时器
  const clearPendingSearch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  // 立即搜索（跳过防抖）
  const immediateSearch = useCallback(() => {
    clearPendingSearch()
    setDebouncedSearchTerm(searchTerm)
    executeSearch(searchTerm)
  }, [searchTerm, executeSearch, clearPendingSearch])

  // 重置搜索状态
  const resetSearch = useCallback(() => {
    clearPendingSearch()
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setIsSearching(false)

    // 执行空搜索（如果启用）
    if (immediateOnEmpty && isValidSearchTerm('')) {
      executeSearch('')
    }
  }, [clearPendingSearch, immediateOnEmpty, executeSearch, isValidSearchTerm])

  // 取消待处理的搜索
  const cancelPendingSearch = useCallback(() => {
    clearPendingSearch()
    setIsSearching(false)
  }, [clearPendingSearch])

  // 设置搜索词
  const handleSearchTermChange = useCallback((term: string) => {
    setSearchTerm(term)
  }, [])

  // 处理输入法组合开始
  const handleCompositionStart = useCallback(() => {
    if (respectComposition) {
      setIsComposing(true)
      clearPendingSearch() // 组合开始时取消待处理的搜索
    }
  }, [respectComposition, clearPendingSearch])

  // 处理输入法组合结束
  const handleCompositionEnd = useCallback(() => {
    if (respectComposition) {
      setIsComposing(false)

      // 组合结束后立即执行搜索
      setDebouncedSearchTerm(searchTerm)
      executeSearch(searchTerm)
    }
  }, [respectComposition, searchTerm, executeSearch])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    searchTerm,
    debouncedSearchTerm,
    isSearching,
    isComposing,
    setSearchTerm: handleSearchTermChange,
    immediateSearch,
    resetSearch,
    cancelPendingSearch,
    handleCompositionStart,
    handleCompositionEnd,
  }
}
