import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ThemeContextType {
  isDarkMode: boolean
  toggleDarkMode: () => void
  setDarkMode: (isDark: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // 从localStorage读取保存的主题设置，默认为浅色模式
    const savedTheme = localStorage.getItem('theme')
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    // 保存主题设置到localStorage
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')

    // 更新HTML根元素的class以支持Tailwind CSS的深色模式
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark:bg-gray-900')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark:bg-gray-900')
    }
  }, [isDarkMode])

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev)
  }

  const setDarkMode = (isDark: boolean) => {
    setIsDarkMode(isDark)
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}