import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Download, Check, AlertTriangle } from 'lucide-react'
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
    tools?: unknown[]
  }
  permissions?: string[]
  size?: string
  // Reference to original market plugin ID for tracking installation state
  original_market_plugin_id?: string
}

interface MarketPluginCardProps {
  plugin: Plugin
  viewMode: 'grid' | 'list'
  isInstalled: boolean
  onView: (_plugin: Plugin) => void
  onInstall: (_plugin: Plugin) => void
  onMenuAction: (_plugin: Plugin, _anchorEl: HTMLElement) => void
  index?: number
}

const MarketPluginCard: React.FC<MarketPluginCardProps> = ({ plugin, viewMode, isInstalled, onView, onInstall, index = 0 }) => {
  const { t } = useTranslation()
  const [installLoading, setLoading] = useState(false)

  // Helper function to get plugin type text
  const getPluginTypeText = (pluginType: number) => {
    switch (pluginType) {
      case 1:
        return '云侧服务'
      case 2:
        return '代码插件'
      default:
        return `插件类型${pluginType}`
    }
  }

  // Helper function to render plugin icon (supports both emoji and image URLs)
  const renderPluginIcon = (
    iconUri: string,
    className: string = 'w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-200',
  ) => {
    const isUrl =
      typeof iconUri === 'string' && (iconUri.startsWith('http://') || iconUri.startsWith('https://') || iconUri.startsWith('/') || iconUri.includes('.'))

    if (isUrl) {
      return (
        <div className={className}>
          <img
            src={iconUri}
            alt="Plugin icon"
            className="w-full h-full object-cover rounded-xl"
            onError={e => {
              e.currentTarget.style.display = 'none'
              const fallback = document.createElement('span')
              fallback.textContent = '📦'
              fallback.className = 'w-full h-full flex items-center justify-center text-2xl'
              e.currentTarget.parentElement?.appendChild(fallback)
            }}
          />
        </div>
      )
    }

    return <div className={className}>{iconUri}</div>
  }

  const handleInstall = async () => {
    setLoading(true)
    try {
      await onInstall(plugin)
    } finally {
      setLoading(false)
    }
  }

  // 列表视图
  if (viewMode === 'list') {
    return (
      <div key={plugin.plugin_id} className="bg-white rounded-xl shadow-sm hover:shadow-sm transition-all duration-300 border border-gray-100 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              {renderPluginIcon(plugin.icon_uri)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-1">
                  <h4
                    className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-blue-800 truncate max-w-[300px]"
                    title={plugin.name}
                  >
                    {plugin.name}
                  </h4>
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
                    {plugin.category || getPluginTypeText(plugin.plugin_type)}
                  </span>
                  {isInstalled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full flex-shrink-0">
                      {t('plugins.actions.installed')}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed truncate max-w-[500px]" title={plugin.desc}>
                  {plugin.desc || '暂无描述'}
                </p>
                {(plugin.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(plugin.tags || []).slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                        {tag}
                      </span>
                    ))}
                    {(plugin.tags || []).length > 3 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">+{(plugin.tags || []).length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => onView(plugin)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
                title="查看详情"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={handleInstall}
                disabled={isInstalled || installLoading}
                className={`inline-flex items-center space-x-1 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                  isInstalled
                    ? 'bg-green-100 text-green-700 cursor-default'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-sm'
                } disabled:opacity-50`}
              >
                {isInstalled ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>{installLoading ? '安装中...' : isInstalled ? '已安装' : '安装'}</span>
              </button>
            </div>
          </div>

          {plugin.status === 'error' && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <div className="flex items-center text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4 mr-2" />
                插件运行异常，请检查配置或重新安装
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 网格视图 - 与智能体和工作流卡片统一
  return (
    <div
      key={plugin.plugin_id}
      className="group bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100 overflow-hidden"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Gradient top border - 与智能体和工作流卡片统一 */}
      <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />

      {/* Plugin header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 w-full">
            {renderPluginIcon(
              plugin.icon_uri,
              'w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-r from-blue-50 to-indigo-100 group-hover:scale-110 transition-transform duration-300 border border-blue-200',
            )}
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-blue-800 overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]"
                  title={plugin.name}
                >
                  {plugin.name}
                </h3>
                {isInstalled && <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full flex-shrink-0">已安装</span>}
              </div>
              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-full">
                {plugin.category || getPluginTypeText(plugin.plugin_type)}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-3 leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap max-w-full" title={plugin.desc}>
          {plugin.desc || '暂无描述'}
        </p>

        {/* Tags */}
        {(plugin.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {(plugin.tags || []).slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {tag}
              </span>
            ))}
            {(plugin.tags || []).length > 3 && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">+{(plugin.tags || []).length - 3}</span>
            )}
          </div>
        )}

        {/* Error Alert */}
        {plugin.status === 'error' && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4 mr-2" />
              插件运行异常
            </div>
          </div>
        )}
      </div>

      {/* Actions - 与智能体和工作流卡片统一 */}
      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onView(plugin)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
            title="查看详情"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={handleInstall}
            disabled={isInstalled || installLoading}
            className={`inline-flex items-center space-x-1 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              isInstalled
                ? 'bg-green-100 text-green-700 cursor-default'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-sm hover:shadow-sm transform hover:scale-105'
            } disabled:opacity-50`}
          >
            {isInstalled ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span>{installLoading ? '安装中...' : isInstalled ? '已安装' : '安装'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default MarketPluginCard
