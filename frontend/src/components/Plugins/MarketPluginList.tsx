import React from 'react'
import { useTranslation } from 'react-i18next'
import { CircularProgress } from '@mui/material'
import { Search, Grid, List, RefreshCw, Plug } from 'lucide-react'
import MarketPluginCard from './MarketPluginCard'
import { PluginInfo } from '@agent-studio/api-client'

interface Plugin extends PluginInfo {
  // Extend PluginInfo with UI-specific fields
  status?: 'active' | 'inactive' | 'error' | 'updating'
  category?: string
  version?: string
  author?: string
  installDate?: string
  lastUpdate?: string
  usageCount?: number
  rating?: number
  downloadCount?: number
  tags?: string[]
  dependencies?: string[]
  config?: {
    apiKey?: string
    baseUrl?: string
    timeout?: number
    retryCount?: number
    url?: string
    authMethod?: string
    tools?: any[]
  }
  permissions?: string[]
  size?: string
  // Reference to original market plugin ID for tracking installation state
  original_market_plugin_id?: string
}

interface MarketPluginListProps {
  activeTab: number
  marketPlugins: Plugin[]
  plugins: Plugin[]
  searchTerm: string
  categoryFilter: string
  viewMode: 'grid' | 'list'
  loading: boolean
  categories: string[]
  onSearchChange: (value: string) => void
  onCategoryFilterChange: (value: string) => void
  onViewModeChange: (mode: 'grid' | 'list') => void
  onRefresh: () => void
  onPluginAction: (action: string, plugin: Plugin) => void
  onInstallPlugin: (plugin: Plugin) => void
  getPluginTypeText: (pluginType: number) => string
}

const MarketPluginList: React.FC<MarketPluginListProps> = ({
  activeTab,
  marketPlugins,
  plugins,
  searchTerm,
  categoryFilter,
  viewMode,
  loading,
  categories,
  onSearchChange,
  onCategoryFilterChange,
  onViewModeChange,
  onRefresh,
  onPluginAction,
  onInstallPlugin,
  getPluginTypeText,
}) => {
  const { t } = useTranslation()

  // Debug logging to help identify any issues
  console.log('MarketPluginList render:', {
    marketPluginsCount: (marketPlugins || []).length,
    pluginsCount: (plugins || []).length,
    activeTab,
    searchTerm,
    categoryFilter,
    viewMode,
    loading,
  })

  // Filter market plugins
  // Add defensive checks to prevent runtime errors
  const filteredMarketPlugins = (marketPlugins || []).filter(plugin => {
    if (!plugin) return false
    const matchesSearch =
      (plugin.name?.toLowerCase() || '').includes((searchTerm || '').toLowerCase()) ||
      (plugin.desc?.toLowerCase() || '').includes((searchTerm || '').toLowerCase()) ||
      (plugin.tags || []).some(tag => tag?.toLowerCase().includes((searchTerm || '').toLowerCase()))
    const matchesCategory = categoryFilter === 'all' || getPluginTypeText(plugin.plugin_type) === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Check if plugin is installed using both original plugin_id and name for better tracking
  const isPluginInstalled = (plugin: Plugin) => {
    if (!plugin) return false
    return (plugins || []).some(
      p =>
        p &&
        // Check by plugin_id for direct matches
        (p.plugin_id === plugin.plugin_id ||
          // Check by original market plugin ID reference
          (p as any).original_market_plugin_id === plugin.plugin_id ||
          // Check by name and type for market plugins that might have different IDs after installation
          (p.name === plugin.name && p.plugin_type === plugin.plugin_type)),
    )
  }

  // Handle plugin menu action
  const handleMenuAction = (plugin: Plugin) => {
    // Add defensive check
    if (!plugin) return
    // This would open a menu, for now we'll just view details
    onPluginAction('view', plugin)
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters - 与智能体和工作流页面统一 */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
            <input
              type="text"
              placeholder={t('plugins.searchPlaceholder')}
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200 bg-gray-50 focus:bg-white"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="sm:w-48">
          <select
            value={categoryFilter}
            onChange={e => onCategoryFilterChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200 bg-gray-50 focus:bg-white"
          >
            <option value="all">{t('plugins.filters.allCategories')}</option>
            {categories.slice(1).map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode & Refresh */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-3 rounded-xl transition-all duration-200 ${
              viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            title="网格视图"
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-3 rounded-xl transition-all duration-200 ${
              viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            title="列表视图"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-3 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
            title="刷新"
          >
            {loading ? <CircularProgress size={20} /> : <RefreshCw className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Market Plugins Grid/List */}
      {filteredMarketPlugins.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <Plug className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-gray-900 mb-3">未找到匹配的插件</h3>
          <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">请尝试调整搜索条件或分类筛选</p>
          <button
            onClick={() => {
              onSearchChange('')
              onCategoryFilterChange('all')
            }}
            className="inline-flex items-center space-x-2 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 transition-all duration-300"
          >
            <span>清除筛选</span>
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-3'}>
          {filteredMarketPlugins
            .filter(plugin => plugin && plugin.plugin_id)
            .map((plugin, index) => (
              <MarketPluginCard
                key={plugin.plugin_id}
                plugin={plugin}
                viewMode={viewMode}
                isInstalled={isPluginInstalled(plugin)}
                onView={plugin => onPluginAction('view', plugin)}
                onInstall={onInstallPlugin}
                onMenuAction={handleMenuAction}
                index={index}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export default MarketPluginList
