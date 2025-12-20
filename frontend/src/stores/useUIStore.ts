import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// UI相关状态类型定义
interface UIState {
  // 插件管理页面显示模式
  pluginViewMode: 'grid' | 'list'

  // 其他可以扩展的UI状态
  // 例如：主题模式、侧边栏状态、面板大小等
  theme: 'light' | 'dark' | 'auto'
  sidebarCollapsed: boolean
  mainLayoutSize: number
}

interface UIActions {
  // 插件显示模式操作
  setPluginViewMode: (mode: 'grid' | 'list') => void

  // 主题相关操作
  setTheme: (theme: 'light' | 'dark' | 'auto') => void

  // 侧边栏操作
  setSidebarCollapsed: (collapsed: boolean) => void

  // 布局大小操作
  setMainLayoutSize: (size: number) => void

  // 重置所有UI状态
  resetUIState: () => void
}

const initialState: UIState = {
  pluginViewMode: 'grid', // 默认为网格模式
  theme: 'light',
  sidebarCollapsed: false,
  mainLayoutSize: 100,
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 设置插件显示模式
      setPluginViewMode: (mode: 'grid' | 'list') => {
        console.log(`🎨 [UIStore] Plugin view mode changed to: ${mode}`)
        set({ pluginViewMode: mode })
      },

      // 设置主题
      setTheme: (theme: 'light' | 'dark' | 'auto') => {
        console.log(`🎨 [UIStore] Theme changed to: ${theme}`)
        set({ theme })
      },

      // 设置侧边栏折叠状态
      setSidebarCollapsed: (collapsed: boolean) => {
        console.log(`🎨 [UIStore] Sidebar collapsed changed to: ${collapsed}`)
        set({ sidebarCollapsed: collapsed })
      },

      // 设置主布局大小
      setMainLayoutSize: (size: number) => {
        console.log(`🎨 [UIStore] Main layout size changed to: ${size}%`)
        set({ mainLayoutSize: size })
      },

      // 重置UI状态
      resetUIState: () => {
        console.log('🎨 [UIStore] Resetting all UI state to initial values')
        set(initialState)
      },
    }),
    {
      name: 'ui-storage', // 在localStorage中的键名
      partialize: state => ({
        // 只持久化需要保存的状态
        pluginViewMode: state.pluginViewMode,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        mainLayoutSize: state.mainLayoutSize,
      }),
      version: 1, // 版本号，用于状态迁移
      onRehydrateStorage: () => state => {
        console.log('🎨 [UIStore] UI state rehydrated from storage:', state)
      },
    },
  ),
)

// 便捷的hooks
export const usePluginViewMode = () => {
  const viewMode = useUIStore(state => state.pluginViewMode)
  const setViewMode = useUIStore(state => state.setPluginViewMode)

  return [viewMode, setViewMode] as const
}

export const useTheme = () => {
  const theme = useUIStore(state => state.theme)
  const setTheme = useUIStore(state => state.setTheme)

  return [theme, setTheme] as const
}

// 默认导出
export default useUIStore
