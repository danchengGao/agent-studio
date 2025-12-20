import { ENV_CONFIG } from '../config/environment'

export interface PluginToolConfig {
  name: string
  path: string
  method: string
  description: string
  request_params: Record<string, any>
}

export interface PluginConfig {
  name: string
  description: string
  api_prefix: string
  icon_uri?: string
  tools: PluginToolConfig[]
}

export interface PluginConfigs {
  PLUGIN_SERVICE_URL: string
  plugins: Record<string, PluginConfig>
}

let cachedPluginConfigs: PluginConfigs | null = null

/**
 * Load plugin configurations from the config file specified in environment variables
 * @returns Promise<PluginConfigs> The plugin configuration object
 */
export async function loadPluginConfigs(): Promise<PluginConfigs> {
  if (cachedPluginConfigs) {
    return cachedPluginConfigs
  }

  try {
    const configPath = ENV_CONFIG.PLUGIN_CONFIG_PATH

    // For Vite development, we need to fetch from the public directory
    // or use an API endpoint to serve the config file
    const response = await fetch(configPath)

    if (!response.ok) {
      throw new Error(`Failed to load plugin config from ${configPath}: ${response.statusText}`)
    }

    const configData = await response.json()

    // Override PLUGIN_SERVICE_URL with environment variable if available
    if (ENV_CONFIG.PLUGIN_SERVICE_URL) {
      configData.PLUGIN_SERVICE_URL = ENV_CONFIG.PLUGIN_SERVICE_URL
    }

    cachedPluginConfigs = configData

    return configData
  } catch (error) {
    console.error('Error loading plugin configurations:', error)

    // Return fallback configuration
    const fallbackConfig: PluginConfigs = {
      PLUGIN_SERVICE_URL: ENV_CONFIG.PLUGIN_SERVICE_URL,
      plugins: {},
    }

    return fallbackConfig
  }
}

/**
 * Load plugin configurations from market data returned by the API
 * @param marketData The JSON string data from the plugin market API
 * @returns Promise<PluginConfigs> The plugin configuration object
 */
export async function loadPluginConfigsFromMarket(marketData: string): Promise<PluginConfigs> {
  if (cachedPluginConfigs) {
    return cachedPluginConfigs
  }

  try {
    // Parse the market data JSON string
    let configData: PluginConfigs

    try {
      configData = JSON.parse(marketData)
    } catch (parseError) {
      console.error('Failed to parse market data JSON:', parseError)
      throw new Error('Invalid market data format')
    }

    // Override PLUGIN_SERVICE_URL with environment variable if available
    if (configData.VITE_PLUGIN_SERVICE_URL) {
      configData.PLUGIN_SERVICE_URL = configData.VITE_PLUGIN_SERVICE_URL
    }

    // Validate the structure
    if (!configData.plugins || typeof configData.plugins !== 'object') {
      console.warn('Market data has invalid plugins structure, using empty object')
      configData.plugins = {}
    }

    cachedPluginConfigs = configData

    return configData
  } catch (error) {
    console.error('Error loading plugin configurations from market:', error)

    // Return fallback configuration
    const fallbackConfig: PluginConfigs = {
      PLUGIN_SERVICE_URL: ENV_CONFIG.PLUGIN_SERVICE_URL,
      plugins: {},
    }

    return fallbackConfig
  }
}

/**
 * Get all available plugins from the configuration
 * @returns Promise<PluginConfig[]> Array of plugin configurations
 */
export async function getAvailablePlugins(): Promise<PluginConfig[]> {
  const configs = await loadPluginConfigs()
  return Object.values(configs.plugins)
}

/**
 * Get all available plugins from market data
 * @param marketData The JSON string data from the plugin market API
 * @returns Promise<PluginConfig[]> Array of plugin configurations
 */
export async function getAvailablePluginsFromMarket(marketData: string): Promise<PluginConfig[]> {
  const configs = await loadPluginConfigsFromMarket(marketData)
  return Object.values(configs.plugins)
}

/**
 * Get a specific plugin configuration by name
 * @param pluginName The name of the plugin to retrieve
 * @returns Promise<PluginConfig | null> The plugin configuration or null if not found
 */
export async function getPluginConfig(pluginName: string): Promise<PluginConfig | null> {
  const configs = await loadPluginConfigs()
  return configs.plugins[pluginName] || null
}

/**
 * Clear the cached plugin configurations (useful for refresh scenarios)
 */
export function clearPluginConfigCache(): void {
  cachedPluginConfigs = null
}

/**
 * Transform plugin config to market plugin format for display
 * @param pluginConfig The raw plugin configuration
 * @returns Transformed plugin object for UI display
 */
export function transformConfigToMarketPlugin(pluginConfig: PluginConfig, pluginKey: string) {
  // Determine plugin type based on the plugin key
  const pluginType = pluginKey.includes('system') ? 2 : 1

  // Determine status (could be extended to include health checks)
  const status: 'active' | 'inactive' | 'error' | 'updating' = 'active'

  // Use icon_uri from configuration if available, otherwise fallback to generated icon
  const getIconForPlugin = (config: PluginConfig, key: string): string => {
    // Use icon_uri from configuration if it exists
    if ('icon_uri' in config && config.icon_uri) {
      return config.icon_uri
    }

    // Fallback to generated icon based on plugin key/description
    if (key.includes('weather')) return '🌤️'
    if (key.includes('image')) return '🎨'
    if (key.includes('translation')) return '🌐'
    if (key.includes('text')) return '📝'
    if (key.includes('link')) return '🔗'
    if (key.includes('qa')) return '❓'
    if (key.includes('nlp')) return '🧠'
    if (key.includes('map')) return '🗺️'
    if (key.includes('system')) return '⚙️'
    return '📦'
  }

  const generateVersion = (): string => {
    return `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`
  }

  return {
    space_id: '',
    plugin_id: pluginKey,
    plugin_version: generateVersion(),
    name: pluginConfig.name,
    desc: pluginConfig.description,
    plugin_type: pluginType,
    published: true,
    url: '',
    icon_uri: getIconForPlugin(pluginConfig, pluginKey),
    status,
    // Include original config data for installation use
    config: pluginConfig,
  }
}
