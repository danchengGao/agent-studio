import { useState, useEffect, useRef } from 'react'
import { usePluginGetMarket } from '@test-agentstudio/api-client'
import { useAuthStore } from '../stores/useAuthStore'
import { ENV_CONFIG } from '../config/environment'
import { getAvailablePluginsFromMarket, loadPluginConfigs, transformConfigToMarketPlugin } from '../utils/pluginConfig'

interface Plugin {
  space_id: string
  plugin_id: string
  plugin_version: string
  name: string
  desc: string
  plugin_type: number
  published: boolean
  url: string
  icon_uri: string
  status: 'active' | 'inactive' | 'error' | 'updating'
  config?: any
  tags?: string[]
  original_market_plugin_id?: string
}

interface MarketCategory {
  key: string
  name: string
  icon?: string
  total?: number
}

interface UsePluginMarketConfigsReturn {
  marketPlugins: Plugin[]
  marketCategories: MarketCategory[]
  loading: boolean
  error: string | null
  refreshMarketPlugins: () => Promise<void>
}

export const usePluginMarketConfigs = (
  marketSource: 'local' | 'agent-tools' = 'local',
  page = 1,
  size = 100,
  fetchAll = false,
): UsePluginMarketConfigsReturn => {
  const [marketPlugins, setMarketPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marketCategories, setMarketCategories] = useState<MarketCategory[]>([])
  const hasLoadedRef = useRef(false)
  const loadedMarketSourceRef = useRef<'local' | 'agent-tools' | null>(null)
  const requestKeyRef = useRef('')
  const hasData = marketPlugins.length > 0
  const isInitialLoad = !hasLoadedRef.current && !hasData
  const shouldKeepPreviousData = hasLoadedRef.current && hasData && loadedMarketSourceRef.current === marketSource
  const requestKey = `${marketSource}:${page}:${size}:${fetchAll}`
  requestKeyRef.current = requestKey

  const getPluginMarketMutation = usePluginGetMarket()
  const { user } = useAuthStore()

  const getDefaultSpaceId = () => {
    return user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID
  }

  const loadMarketPlugins = async () => {
    const activeRequestKey = requestKey
    setLoading(true)
    setError(null)

    try {
      const requestPage = marketSource === 'agent-tools' && fetchAll ? 1 : page
      const requestSize = marketSource === 'agent-tools' && fetchAll ? 100 : size

      const marketResponse = await getPluginMarketMutation.mutateAsync({
        space_id: getDefaultSpaceId(),
        page: requestPage,
        size: requestSize,
        market_source: marketSource,
      })

      if (marketResponse.code !== 200 || !marketResponse.data) {
        throw new Error(marketResponse.message || 'Failed to fetch market data')
      }

      const pluginConfigs = await getAvailablePluginsFromMarket(marketResponse.data)
      const transformedPlugins = Object.entries(pluginConfigs).map(([key, config]) => transformConfigToMarketPlugin(config, key))

      if (requestKeyRef.current !== activeRequestKey) {
        return
      }

      setMarketPlugins(transformedPlugins)
      hasLoadedRef.current = true
      loadedMarketSourceRef.current = marketSource

      try {
        const configData = JSON.parse(marketResponse.data)
        const categories = Object.entries(configData.categories || {}).map(([key, value]) => {
          const category = value as Record<string, unknown>
          return {
            key,
            name: String(category.name || key),
            icon: typeof category.icon === 'string' ? category.icon : undefined,
            total: typeof category.total === 'number' ? category.total : undefined,
          }
        })
        setMarketCategories(categories)
      } catch (parseError) {
        console.warn('Failed to parse market data for config URL, using environment variable')
        if (requestKeyRef.current !== activeRequestKey) {
          return
        }
        setMarketCategories([])
      }
    } catch (marketError) {
      if (requestKeyRef.current !== activeRequestKey) {
        return
      }

      if (marketSource === 'agent-tools') {
        console.error('Failed to load agent-tools market plugins:', marketError)
        setError('加载 Agent Tools 插件市场失败，请稍后重试')
        if (!shouldKeepPreviousData) {
          setMarketPlugins([])
          setMarketCategories([])
        }
      } else {
        console.warn('Failed to load local market plugins from API, falling back to local config:', marketError)
        try {
          const pluginConfigs = await loadPluginConfigs()
          const transformedPlugins = Object.entries(pluginConfigs.plugins || {}).map(([key, config]) =>
            transformConfigToMarketPlugin(config, key),
          )

          if (requestKeyRef.current !== activeRequestKey) {
            return
          }

          setMarketPlugins(transformedPlugins)
          hasLoadedRef.current = true
          loadedMarketSourceRef.current = marketSource
        } catch (localError) {
          console.error('Failed to load plugin configurations from both market API and local config:', localError)
          setError('加载插件市场失败，请稍后重试')
          if (!shouldKeepPreviousData) {
            setMarketPlugins([])
            setMarketCategories([])
          }
        }
      }
    } finally {
      if (requestKeyRef.current === activeRequestKey) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (isInitialLoad) {
      setLoading(true)
    }
  }, [isInitialLoad])

  useEffect(() => {
    loadMarketPlugins()
  }, [fetchAll, marketSource, page, size])

  const refreshMarketPlugins = async () => {
    await loadMarketPlugins()
  }

  return {
    marketPlugins,
    marketCategories,
    loading,
    error,
    refreshMarketPlugins,
  }
}
