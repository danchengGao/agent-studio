import { useState, useEffect } from 'react'
import { usePluginGetMarket } from '@test-agentstudio/api-client'
import { useAuthStore } from '../stores/useAuthStore'
import { ENV_CONFIG } from '../config/environment'
import { getAvailablePluginsFromMarket, transformConfigToMarketPlugin, clearPluginConfigCache, loadPluginConfigs } from '../utils/pluginConfig'

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

interface UsePluginMarketConfigsReturn {
  marketPlugins: Plugin[]
  loading: boolean
  error: string | null
  refreshMarketPlugins: () => Promise<void>
  marketConfigUrl: string | null
}

export const usePluginMarketConfigs = (): UsePluginMarketConfigsReturn => {
  const [marketPlugins, setMarketPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marketConfigUrl, setMarketConfigUrl] = useState<string | null>(null)

  const getPluginMarketMutation = usePluginGetMarket()
  const { user } = useAuthStore()

  const getDefaultSpaceId = () => {
    return user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID
  }

  const loadMarketPlugins = async () => {
    setLoading(true)
    setError(null)

    try {
      // First try to get market data from API
      const marketResponse = await getPluginMarketMutation.mutateAsync({
        space_id: getDefaultSpaceId(),
        page: 1,
        size: 100,
      })

      if (marketResponse.code === 200 && marketResponse.data) {
        // Parse market data and transform it
        const pluginConfigs = await getAvailablePluginsFromMarket(marketResponse.data)
        const transformedPlugins = Object.entries(pluginConfigs).map(([key, config]) => transformConfigToMarketPlugin(config, key))
        setMarketPlugins(transformedPlugins)

        // Extract the market config URL from the market data
        try {
          const configData = JSON.parse(marketResponse.data)
          if (configData.VITE_PLUGIN_SERVICE_URL) {
            setMarketConfigUrl(configData.VITE_PLUGIN_SERVICE_URL)
          } else {
            // Fallback to environment variable if market doesn't have the URL
            setMarketConfigUrl(ENV_CONFIG.PLUGIN_SERVICE_URL)
          }
        } catch (parseError) {
          console.warn('Failed to parse market data for config URL, using environment variable')
          setMarketConfigUrl(ENV_CONFIG.PLUGIN_SERVICE_URL)
        }
      } else {
        throw new Error(marketResponse.message || 'Failed to fetch market data')
      }
    } catch (marketError) {
      console.warn('Failed to load market plugins from API, falling back to local config:', marketError)

      // Fallback to local config if market API fails
      try {
        clearPluginConfigCache()
        const pluginConfigs = await getAvailablePlugins()
        const transformedPlugins = pluginConfigs.map(config =>
          transformConfigToMarketPlugin(config, Object.keys(pluginConfigs).find(key => pluginConfigs[key as keyof typeof pluginConfigs] === config) || ''),
        )
        setMarketPlugins(transformedPlugins)
        // Use environment variable as fallback for local config
        setMarketConfigUrl(ENV_CONFIG.PLUGIN_SERVICE_URL)
      } catch (localError) {
        console.error('Failed to load plugin configurations from both market API and local config:', localError)
        setError('加载插件配置失败，请稍后重试')
        setMarketPlugins([])
        setMarketConfigUrl(ENV_CONFIG.PLUGIN_SERVICE_URL)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMarketPlugins()
  }, [])

  const refreshMarketPlugins = async () => {
    await loadMarketPlugins()
  }

  return {
    marketPlugins,
    loading,
    error,
    refreshMarketPlugins,
    marketConfigUrl,
  }
}
