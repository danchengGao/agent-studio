import { ENV_CONFIG } from '../config/environment'

export interface PluginToolConfig {
  name: string
  path: string
  method: string
  description: string
  request_params: Record<string, any>
  response_params?: Record<string, any>
  headers?: Record<string, any> | Array<Record<string, any>>
  parameters?: Record<string, any>
  input_params?: Record<string, any>
  output_params?: Record<string, any>
  inputSchema?: Record<string, any>
  input_schema?: Record<string, any>
  output_schema?: Record<string, any>
  available?: boolean
}

export interface PluginConfig {
  name: string
  description: string
  display_name?: string
  detail_desc?: string
  desc_mk?: string
  api_prefix: string
  icon_uri?: string
  icon?: string
  version?: string
  tags?: string[]
  author?: string
  external_plugin_type?: string
  category?: string
  category_name?: string
  ready?: boolean
  tools: PluginToolConfig[]
}

const normalizeRequestParams = (tool: PluginToolConfig) => {
  if (tool.request_params && typeof tool.request_params === 'object') return tool.request_params
  if (tool.parameters && typeof tool.parameters === 'object') return tool.parameters
  const inputSchema = (tool.inputSchema || tool.input_schema || tool.input_params) as Record<string, any> | undefined
  if (inputSchema?.properties && typeof inputSchema.properties === 'object') return inputSchema.properties
  return {}
}

const normalizeResponseParams = (tool: PluginToolConfig) => {
  if (tool.response_params && typeof tool.response_params === 'object') return tool.response_params
  const outputSchema = (tool.output_schema || tool.output_params) as Record<string, any> | undefined
  if (outputSchema?.properties && typeof outputSchema.properties === 'object') return outputSchema.properties
  return {}
}

export function resolvePluginIconUrl(uri: string | null | undefined): string {
  return typeof uri === 'string' ? uri.trim() : ''
}

const getPluginIconValue = (config: PluginConfig, key: string): string => {
  const rawIcon = (config as any).icon_uri || (config as any).icon
  if (typeof rawIcon === 'string' && rawIcon.trim()) {
    return resolvePluginIconUrl(rawIcon)
  }
  if (key.includes('mcp')) return '🔌'
  if (key.includes('skill')) return '✨'
  if (key.includes('rest') || key.includes('http') || key.includes('api')) return '🌐'
  if (key.includes('weather')) return '🌤️'
  if (key.includes('image')) return '🎨'
  if (key.includes('translation')) return '🌐'
  if (key.includes('text')) return '📝'
  if (key.includes('link')) return '🔗'
  if (key.includes('qa')) return '❓'
  if (key.includes('nlp')) return '🧠'
  if (key.includes('map')) return '🗺️'
  if (key.includes('system')) return '⚙️'
  if (key.includes('twitter') || key.includes('social')) return '𝕏'
  return '📦'
}

const inferPluginType = (config: PluginConfig, key: string): number => {
  const explicitType = Number((config as any).plugin_type)
  if (Number.isFinite(explicitType) && explicitType > 0) return explicitType
  const externalType = String((config as any).external_plugin_type || (config as any).plugin_type || '').toLowerCase()
  if (externalType === 'mcp-stdio') return 3
  return 1
}

const normalizeTools = (tools: PluginToolConfig[] | undefined) =>
  Array.isArray(tools)
    ? tools.map(tool => {
        const normalizedInputSchema = tool.inputSchema || tool.input_schema || tool.input_params
        const normalizedOutputSchema = tool.output_schema || tool.output_params
        return {
          ...tool,
          input_params: tool.input_params || normalizedInputSchema,
          output_params: tool.output_params || normalizedOutputSchema,
          inputSchema: normalizedInputSchema,
          input_schema: normalizedInputSchema,
          output_schema: normalizedOutputSchema,
          request_params: normalizeRequestParams(tool),
          response_params: normalizeResponseParams(tool),
        }
      })
    : []

const getPluginName = (config: PluginConfig) => String((config as any).display_name || config.name)
const getPluginDesc = (config: PluginConfig) => String((config as any).description || (config as any).short_desc || '')
const getPluginDescMk = (config: PluginConfig) => String((config as any).desc_mk || (config as any).detail_desc || '')
const getPluginVersion = (config: PluginConfig) => String((config as any).version || '')
const getPluginTags = (config: PluginConfig) => Array.isArray((config as any).tags) ? (config as any).tags : []
const getPluginAuthor = (config: PluginConfig) => String((config as any).author || '')
const getPluginCategory = (config: PluginConfig) => String((config as any).category || 'other')
const getPluginCategoryName = (config: PluginConfig) => String((config as any).category_name || getPluginCategory(config))
const getPluginUrl = (config: PluginConfig) => String((config as any).api_prefix || '')
const getExternalPluginType = (config: PluginConfig) => typeof (config as any).external_plugin_type === 'string' ? (config as any).external_plugin_type : undefined
const isPluginReady = (config: PluginConfig) => (config as any).ready !== false

const EXTERNAL_PLUGIN_TYPE_META: Record<string, { displayName: string; icon: string }> = {
  'restful-api': { displayName: 'RESTful API', icon: '🌐' },
  'mcp-stdio': { displayName: 'MCP STDIO', icon: '🔌' },
  tools: { displayName: 'Tools', icon: '🧰' },
  skill: { displayName: 'Skill', icon: '✨' },
}

export function getExternalPluginTypeMeta(externalPluginType?: string): { displayName: string; icon: string } | null {
  const key = (externalPluginType || '').trim().toLowerCase()
  return EXTERNAL_PLUGIN_TYPE_META[key] || null
}

export interface PluginConfigs {
  PLUGIN_SERVICE_URL: string
  VITE_PLUGIN_SERVICE_URL?: string
  plugins: Record<string, PluginConfig>
}

let cachedPluginConfigs: PluginConfigs | null = null

const prepareMarketPluginConfigs = (configData: PluginConfigs): PluginConfigs => {
  if (configData.VITE_PLUGIN_SERVICE_URL) {
    configData.PLUGIN_SERVICE_URL = configData.VITE_PLUGIN_SERVICE_URL
  }

  if (!configData.plugins || typeof configData.plugins !== 'object') {
    console.warn('Market data has invalid plugins structure, using empty object')
    configData.plugins = {}
  }

  return configData
}

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

    const response = await fetch(configPath)

    if (!response.ok) {
      throw new Error(`Failed to load plugin config from ${configPath}: ${response.statusText}`)
    }

    const configData = await response.json()

    if (ENV_CONFIG.PLUGIN_SERVICE_URL) {
      configData.PLUGIN_SERVICE_URL = ENV_CONFIG.PLUGIN_SERVICE_URL
    }

    cachedPluginConfigs = configData

    return configData
  } catch (error) {
    console.error('Error loading plugin configurations:', error)

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
  try {
    let configData: PluginConfigs

    try {
      configData = prepareMarketPluginConfigs(JSON.parse(marketData))
    } catch (parseError) {
      console.error('Failed to parse market data JSON:', parseError)
      throw new Error('Invalid market data format')
    }

    return configData
  } catch (error) {
    console.error('Error loading plugin configurations from market:', error)

    const fallbackConfig: PluginConfigs = {
      PLUGIN_SERVICE_URL: ENV_CONFIG.PLUGIN_SERVICE_URL,
      plugins: {},
    }

    return fallbackConfig
  }
}

export function clearPluginConfigCache(): void {
  cachedPluginConfigs = null
}

export async function getAvailablePluginsFromMarket(marketData: string): Promise<Record<string, PluginConfig>> {
  const configs = await loadPluginConfigsFromMarket(marketData)
  return configs.plugins || {}
}

export function getExternalPluginTypeDisplayName(externalPluginType?: string, fallbackCategoryName?: string): string {
  const meta = getExternalPluginTypeMeta(externalPluginType)
  if (meta) return meta.displayName
  if (fallbackCategoryName?.trim()) return fallbackCategoryName
  return ''
}

export function transformConfigToMarketPlugin(pluginConfig: PluginConfig, pluginKey: string) {
  const status: 'active' | 'inactive' | 'error' | 'updating' = 'active'
  return {
    space_id: '',
    plugin_id: (pluginConfig as any).plugin_id || pluginKey,
    plugin_version: getPluginVersion(pluginConfig),
    name: getPluginName(pluginConfig),
    desc: getPluginDesc(pluginConfig),
    desc_mk: getPluginDescMk(pluginConfig),
    plugin_type: inferPluginType(pluginConfig, pluginKey),
    published: true,
    url: getPluginUrl(pluginConfig),
    icon_uri: getPluginIconValue(pluginConfig, pluginKey),
    status,
    category: getPluginCategory(pluginConfig),
    category_name: getPluginCategoryName(pluginConfig),
    tags: getPluginTags(pluginConfig),
    ready: isPluginReady(pluginConfig),
    author: getPluginAuthor(pluginConfig),
    external_plugin_type: getExternalPluginType(pluginConfig),
    config: {
      ...pluginConfig,
      tools: normalizeTools(pluginConfig.tools),
    },
  }
}
