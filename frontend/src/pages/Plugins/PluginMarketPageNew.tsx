import React, { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useInstallMarketPlugin, usePluginGetMarketDetail, usePluginList, PluginInfo } from '@test-agentstudio/api-client'
import { useAuthStore } from '../../stores/useAuthStore'
import { usePluginMarketSource, usePluginMarketViewMode } from '../../stores/useUIStore'
import { ENV_CONFIG } from '../../config/environment'
import UnifiedSnackbar, { useUnifiedSnackbar } from '../../Common/UnifiedSnackbar'
import { usePluginMarketConfigs } from '../../hooks/usePluginMarketConfigs'
import ReactMarkdown from 'react-markdown'
import { Eye, Download, Check, RefreshCw } from 'lucide-react'
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, CircularProgress, IconButton, Tooltip } from '@mui/material'
import { CommonPageLayout, SearchInput } from '../../components/Common/common-page'
import type { ViewType } from '../../components/Common/common-page'
import { ConfigCard, type EditingState } from '../../components/Common/common-grid'
import { ConfigTable, type TableColumn } from '../../components/Common/common-table'
import { Empty } from '../../components/Common/Empty'
import { resolvePluginIconUrl } from '../../utils/pluginConfig'

interface PluginHeaderConfigEntry {
  value?: string
  description?: string
}

interface PluginToolDetail {
  name?: string
  description?: string
  path?: string
  method?: string
  request_params?: Record<string, unknown>
  response_params?: Record<string, unknown>
  input_params?: Record<string, unknown>
  output_params?: Record<string, unknown>
  inputSchema?: Record<string, unknown>
  input_schema?: Record<string, unknown>
  output_schema?: Record<string, unknown>
  headers?: Record<string, unknown> | Array<Record<string, unknown>>
  available?: boolean
}

interface Plugin {
  space_id: string
  plugin_id: string
  plugin_version: string
  name: string
  desc: string
  desc_mk?: string
  plugin_type: number
  published?: boolean
  url?: string
  icon_uri: string
  status?: 'active' | 'inactive' | 'error' | 'updating'
  config?: Record<string, unknown>
  tags?: string[]
  ready?: boolean
  category?: string
  category_name?: string
  author?: string
  external_plugin_type?: string
  market_source?: string
  original_market_plugin_id?: string
}

const getPluginCategory = (plugin: Plugin): string => String(plugin.category || '')
const getPluginCategoryName = (plugin: Plugin): string => String(plugin.category_name || getPluginCategory(plugin))
const isPluginReady = (plugin: Plugin): boolean => plugin.ready !== false

const normalizeToolRequestParams = (tool: PluginToolDetail): Record<string, unknown> => {
  const requestParams = tool.request_params
  if (requestParams && typeof requestParams === 'object') return requestParams
  const inputSchema = (tool.inputSchema || tool.input_schema || tool.input_params) as Record<string, unknown> | undefined
  const properties = inputSchema?.properties as Record<string, unknown> | undefined
  if (properties && typeof properties === 'object') return properties
  return {}
}

const normalizeHeaderConfiguration = (raw: unknown): Record<string, PluginHeaderConfigEntry> => {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      raw
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !!item.name)
        .map(item => [String(item.name), { value: String(item.value ?? ''), description: String(item.description ?? '') }]),
    )
  }
  if (typeof raw === 'object') {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const details = value as PluginHeaderConfigEntry
          return [key, { value: details.value ?? '', description: details.description ?? '' }]
        }
        return [key, { value: String(value ?? ''), description: '' }]
      }),
    )
  }
  return {}
}

const getPluginDetailTools = (plugin: Plugin): PluginToolDetail[] => {
  const config = (plugin.config as Record<string, unknown> | undefined) || {}
  return Array.isArray(config.tools) ? (config.tools as PluginToolDetail[]) : []
}

const getPluginDetailHeaders = (plugin: Plugin): Array<[string, PluginHeaderConfigEntry]> => {
  const config = (plugin.config as Record<string, unknown> | undefined) || {}
  const rawHeaders = config.header_configuration || config.headers
  return Object.entries(normalizeHeaderConfiguration(rawHeaders))
}

const getPluginDetailMarkdown = (plugin: Plugin): string => {
  const directMarkdown = plugin.desc_mk?.trim()
  if (directMarkdown) return directMarkdown
  const config = (plugin.config as Record<string, unknown> | undefined) || {}
  const values = [config.desc_mk, config.detail_desc]
  return String(values.find(value => typeof value === 'string' && value.trim()) || '').trim()
}

const getAgentToolsDetailConfig = (detail: Record<string, unknown>): Record<string, unknown> =>
  detail.config && typeof detail.config === 'object' ? (detail.config as Record<string, unknown>) : {}

const getAgentToolsDetailMarkdown = (detail: Record<string, unknown>): string => {
  const detailConfig = getAgentToolsDetailConfig(detail)
  const values = [detail.desc_mk, detail.detail_desc, detailConfig.desc_mk, detailConfig.detail_desc]
  return String(values.find(value => typeof value === 'string' && value.trim()) || '').trim()
}

const mergeAgentToolsDetail = (plugin: Plugin, detail: Record<string, unknown>): Plugin => {
  const existingConfig = ((plugin.config as Record<string, unknown>) || {})
  const detailConfig = getAgentToolsDetailConfig(detail)
  const markdown = getAgentToolsDetailMarkdown(detail)

  const apiPrefix =
    (typeof detailConfig.api_prefix === 'string' && detailConfig.api_prefix.trim() ? detailConfig.api_prefix : '') ||
    (typeof detail.api_base_url === 'string' && detail.api_base_url.trim() ? String(detail.api_base_url).trim() : '') ||
    (typeof detail.base_url === 'string' && detail.base_url.trim() ? String(detail.base_url).trim() : '')

  const detailTools = Array.isArray(detail.tools) ? detail.tools : []
  const detailHeaders = detail.header_configuration || detail.headers || null

  return {
    ...plugin,
    plugin_id: String(detail.plugin_id || plugin.plugin_id || '').trim(),
    name: String(detail.display_name || detail.name || plugin.name || plugin.plugin_id),
    desc: String(detail.short_desc || detail.description || plugin.desc || '').trim() || '—',
    desc_mk: markdown || plugin.desc_mk,
    plugin_version: String(detail.version || plugin.plugin_version || '').trim(),
    icon_uri: String(detail.icon_uri || plugin.icon_uri || ''),
    author: String(detail.publisher_name || detail.author || plugin.author || '').trim() || plugin.author,
    tags: Array.isArray(detail.tags) && detail.tags.length > 0 ? (detail.tags as string[]) : (plugin.tags || []),
    config: {
      ...existingConfig,
      ...(markdown ? { desc_mk: markdown, detail_desc: markdown } : {}),
      ...(apiPrefix ? { api_prefix: apiPrefix } : {}),
      ...(detailHeaders ? { header_configuration: detailHeaders, headers: detailHeaders } : {}),
      ...(detailTools.length > 0 ? { tools: detailTools } : {}),
    },
  }
}

const getDetailPluginFromMarketPayload = (
  payload: { plugins?: Record<string, Record<string, unknown>> },
  pluginId: string,
): Record<string, unknown> | undefined => {
  if (!payload.plugins) return undefined
  return (
    payload.plugins[pluginId] ||
    Object.entries(payload.plugins).find(([key, candidate]) => {
      const candidateId = String(candidate?.plugin_id || candidate?.asset_id || key || '').trim()
      return candidateId === pluginId
    })?.[1]
  )
}

const getPluginStableId = (plugin: Plugin): string => {
  const config = (plugin.config as Record<string, unknown> | undefined) || {}
  return String(
    plugin.original_market_plugin_id ||
    config.original_market_plugin_id ||
    config.asset_id ||
    config.plugin_id ||
    plugin.plugin_id ||
    '',
  ).trim()
}

const parseMarketDetailPayload = (raw: string): { plugins?: Record<string, Record<string, unknown>> } | null => {
  try {
    const parsed = JSON.parse(raw) as { plugins?: Record<string, Record<string, unknown>> }
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (error) {
    console.error('Failed to parse plugin market detail payload', error)
    return null
  }
}

const extractAgentToolsDetailPayload = (raw: string, plugin: Plugin): Record<string, unknown> | null => {
  const parsed = parseMarketDetailPayload(raw)
  if (!parsed) return null
  const rawDetailPlugin = getDetailPluginFromMarketPayload(parsed, getPluginStableId(plugin))
  if (!rawDetailPlugin || typeof rawDetailPlugin !== 'object') return null
  return rawDetailPlugin as Record<string, unknown>
}

const PluginMarketPageNew: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { snackbar, showSuccess, showError, showWarning, closeSnackbar } = useUnifiedSnackbar()

  const [viewMode, setViewMode] = usePluginMarketViewMode()
  const [marketSource, setMarketSource] = usePluginMarketSource()
  const viewType: ViewType = viewMode === 'grid' ? 'grid' : 'table'

  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null)
  const [showUnderDevelopment, setShowUnderDevelopment] = useState(false)
  const [devConfirmDialogOpen, setDevConfirmDialogOpen] = useState(false)
  const [pendingInstallPlugin, setPendingInstallPlugin] = useState<Plugin | null>(null)

  const editingState: EditingState = {
    id: null,
    field: null,
    value: '',
    isEditing: false,
  }

  const { marketPlugins, loading: marketLoading, error: marketError, refreshMarketPlugins } = usePluginMarketConfigs(marketSource)
  const marketPluginMap = useMemo(() => {
    return new Map((marketPlugins || []).map(plugin => [getPluginStableId(plugin), plugin]))
  }, [marketPlugins])

  const installMarketPluginMutation = useInstallMarketPlugin()
  const getMarketDetailMutation = usePluginGetMarketDetail()

  const getDefaultSpaceId = () => user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID
  const currentSpaceId = getDefaultSpaceId()

  const { data: pluginListData, isLoading: pluginListLoading, refetch: refetchPluginList } = usePluginList({
    space_id: currentSpaceId,
    page: 1,
    size: 100,
  })

  const transformPluginData = (pluginInfo: PluginInfo): Plugin => ({
    space_id: String(pluginInfo.space_id || ''),
    plugin_id: String(pluginInfo.plugin_id || ''),
    plugin_version: String(pluginInfo.plugin_version || ''),
    name: String(pluginInfo.name || ''),
    desc: String(pluginInfo.desc || ''),
    desc_mk: String((pluginInfo as unknown as Record<string, unknown>).desc_mk || ''),
    plugin_type: Number(pluginInfo.plugin_type || 1),
    published: Boolean(pluginInfo.published),
    url: String(pluginInfo.url || ''),
    icon_uri: String(pluginInfo.icon_uri || '📦'),
    status: 'active',
    external_plugin_type: pluginInfo.external_plugin_type,
    market_source: pluginInfo.market_source,
    original_market_plugin_id: pluginInfo.original_market_plugin_id,
  })

  const [installedPlugins, setInstalledPlugins] = useState<Plugin[]>([])

  useEffect(() => {
    if (pluginListData?.data?.plugin_infos) {
      setInstalledPlugins(pluginListData.data.plugin_infos.map(transformPluginData))
    }
  }, [pluginListData])

  useEffect(() => {
    setCurrentPage(1)
    setCategoryFilter('all')
  }, [marketSource])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, categoryFilter])

  const getPluginTypeText = (pluginType: number) => {
    switch (pluginType) {
      case 1:
        return t('plugins.types.cloud')
      case 2:
        return t('plugins.types.ide')
      default:
        return t('plugins.types.pluginTypeUnknown', { type: pluginType })
    }
  }

  const categoryNameMap = useMemo(() => {
    const entries = (marketPlugins || [])
      .filter(plugin => plugin && getPluginCategory(plugin))
      .map(plugin => [getPluginCategory(plugin), getPluginCategoryName(plugin)])
    return new Map(entries)
  }, [marketPlugins])

  const pluginCategories = useMemo(() => Array.from(categoryNameMap.keys()), [categoryNameMap])

  const getCategoryDisplayName = (categoryKey: string) => categoryNameMap.get(categoryKey) || categoryKey

  const categories = ['all', ...pluginCategories]

  const filteredMarketPlugins = (marketPlugins || []).filter(plugin => {
    if (!plugin) return false
    if (!showUnderDevelopment && !isPluginReady(plugin)) return false

    const matchesSearch =
      (plugin.name?.toLowerCase() || '').includes((searchTerm || '').toLowerCase()) ||
      (plugin.desc?.toLowerCase() || '').includes((searchTerm || '').toLowerCase()) ||
      (plugin.tags || []).some(tag => tag?.toLowerCase().includes((searchTerm || '').toLowerCase()))

    let matchesCategory = categoryFilter === 'all'
    if (!matchesCategory) {
      const pluginCategory = getPluginCategory(plugin)
      if (pluginCategory) {
        matchesCategory = pluginCategory === categoryFilter
      } else {
        matchesCategory = getPluginTypeText(plugin.plugin_type) === categoryFilter
      }
    }

    return matchesSearch && matchesCategory
  })

  const sortedMarketPlugins = [...filteredMarketPlugins].sort((a, b) => {
    const aReady = isPluginReady(a) ? 0 : 1
    const bReady = isPluginReady(b) ? 0 : 1
    if (aReady !== bReady) return aReady - bReady
    return (a.name || '').localeCompare(b.name || '')
  })

  const displayPlugins = sortedMarketPlugins.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const displayTotalItems = filteredMarketPlugins.length

  useEffect(() => {
    const displayTotalPages = Math.max(1, Math.ceil(filteredMarketPlugins.length / pageSize))
    if (currentPage > displayTotalPages && displayTotalPages > 0) setCurrentPage(1)
  }, [filteredMarketPlugins.length, pageSize, currentPage])

  const isPluginInstalled = (plugin: Plugin) => {
    if (!plugin) return false

    const pluginStableId = getPluginStableId(plugin)
    return installedPlugins.some(installedPlugin => {
      const installedStableId = getPluginStableId(installedPlugin)
      if (pluginStableId && installedStableId) {
        return installedStableId === pluginStableId
      }
      return (
        installedPlugin.plugin_id === plugin.plugin_id ||
        (installedPlugin.name === plugin.name && installedPlugin.plugin_type === plugin.plugin_type)
      )
    })
  }

  const handleInstallPlugin = async (plugin: Plugin) => {
    if (isPluginInstalled(plugin)) {
      showWarning(t('plugins.messages.pluginAlreadyInstalled', { name: plugin.name }))
      return
    }

    if (!isPluginReady(plugin)) {
      setPendingInstallPlugin(plugin)
      setDevConfirmDialogOpen(true)
      return
    }

    setInstallingPluginId(plugin.plugin_id)

    try {
      const response = await installMarketPluginMutation.mutateAsync({
        space_id: getDefaultSpaceId(),
        plugin_id: getPluginStableId(plugin),
        plugin_version: plugin.plugin_version,
        market_source: marketSource,
      })

      await queryClient.invalidateQueries({ queryKey: ['pluginList', currentSpaceId], exact: false })
      await refetchPluginList()

      if (response.code === 200) {
        showSuccess(t('plugins.messages.pluginInstalled', { name: plugin.name }))
      } else {
        showError(t('plugins.messages.installFailed') + ': ' + (response.message || t('plugins.errors.unknownError')))
      }
    } catch (error) {
      console.error(t('plugins.messages.installFailed'), error)
      showError(t('plugins.messages.installFailed'))
    } finally {
      setInstallingPluginId(null)
    }
  }

  const handleConfirmDevInstall = async () => {
    setDevConfirmDialogOpen(false)
    if (pendingInstallPlugin) {
      const plugin = pendingInstallPlugin
      setPendingInstallPlugin(null)
      await handleInstallPlugin({ ...plugin, ready: true })
    }
  }

  const handleViewPlugin = async (plugin: Plugin) => {
    try {
      const basePlugin = marketPluginMap.get(getPluginStableId(plugin)) || marketPlugins.find(item => item.plugin_id === plugin.plugin_id) || plugin
      setSelectedPlugin(basePlugin)
      setDetailDialogOpen(true)

      if (marketSource !== 'agent-tools') return

      setDetailLoading(true)
      const response = await getMarketDetailMutation.mutateAsync({
        space_id: getDefaultSpaceId(),
        plugin_id: getPluginStableId(plugin),
        plugin_version: plugin.plugin_version,
        market_source: marketSource,
        include_contract: true,
      })

      if (response.code === 200 && response.data) {
        const detailPayload = extractAgentToolsDetailPayload(response.data, basePlugin)
        if (detailPayload) {
          setSelectedPlugin(mergeAgentToolsDetail(basePlugin, detailPayload))
        } else {
          setSelectedPlugin(basePlugin)
        }
      } else {
        console.error('Plugin market detail request failed', response)
        setSelectedPlugin(basePlugin)
      }
    } catch (error) {
      console.error('Failed to open plugin detail dialog', error)
      showError('打开插件详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await refreshMarketPlugins()
      await queryClient.invalidateQueries({ queryKey: ['pluginList', currentSpaceId], exact: false })
      await refetchPluginList()
      showSuccess(t('plugins.messages.marketRefreshed'))
    } catch (error) {
      console.error('Failed to refresh plugin configurations:', error)
      showError(t('plugins.messages.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const renderPluginIcon = (icon: string | undefined, fallbackIcon = '📦') => {
    if (!icon) return fallbackIcon
    const resolvedIcon = resolvePluginIconUrl(icon)
    const isUrl = typeof resolvedIcon === 'string' && (resolvedIcon.startsWith('http://') || resolvedIcon.startsWith('https://') || resolvedIcon.startsWith('/') || resolvedIcon.includes('.'))
    if (isUrl) {
      return (
        <img
          src={resolvedIcon}
          alt="Plugin icon"
          className="w-full h-full object-cover rounded-lg"
          onError={e => {
            const fallback = e.currentTarget.parentElement
            e.currentTarget.style.display = 'none'
            if (fallback) fallback.textContent = fallbackIcon
          }}
        />
      )
    }
    return resolvedIcon
  }

  const getPluginFallbackIcon = (_plugin: Plugin) => '📦'

  const getPluginIconValue = (plugin: Plugin) => String(plugin.icon_uri || '')

  const renderIcon = (plugin: Plugin) => renderPluginIcon(getPluginIconValue(plugin), getPluginFallbackIcon(plugin))

  const gridView = useMemo(() => {
    if (displayPlugins.length === 0) return <Empty searchTerm={searchTerm} type="plugins" />

    return (
      <div className="grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayPlugins.filter(plugin => plugin && plugin.plugin_id).map(plugin => {
          const installed = isPluginInstalled(plugin)
          const isInstalling = installingPluginId === plugin.plugin_id
          const checkingInstall = pluginListLoading
          const pluginReady = isPluginReady(plugin)

          return (
            <div
              key={plugin.plugin_id}
              className={`relative ${!pluginReady ? 'overflow-hidden rounded-[8px]' : ''}`}
              style={!pluginReady ? { outline: '2px solid #FBBF24', outlineOffset: '-2px' } : undefined}
            >
              {!pluginReady && (
                <div className="absolute top-4 -right-7 z-10 bg-amber-400 text-white text-[10px] font-bold py-0.5 px-8 rotate-45 tracking-wider pointer-events-none shadow-sm" aria-label="Under Development">
                  IN DEV
                </div>
              )}
              <ConfigCard
                id={plugin.plugin_id}
                icon={renderIcon(plugin)}
                iconBgColor={pluginReady ? 'bg-gradient-to-r from-blue-100 to-indigo-100' : 'bg-amber-100'}
                iconTextColor={pluginReady ? 'text-blue-600' : 'text-amber-600'}
                title={plugin.name}
                description={plugin.desc || t('plugins.noDescription')}
                className={!pluginReady ? '!bg-gray-50 !shadow-none' : ''}
                tags={[
                  {
                    label: getPluginCategoryName(plugin) || getPluginTypeText(plugin.plugin_type),
                    color: pluginReady ? '#3B82F6' : '#92400E',
                  },
                  ...((plugin.tags || []).slice(0, 2).map(tag => ({ label: tag, color: '#6B7280' }))),
                ]}
                editingState={editingState}
                actions={[]}
                onClick={() => handleViewPlugin(plugin)}
                footer={
                  <div className="flex items-center justify-between w-full">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        handleViewPlugin(plugin)
                      }}
                      className="text-xs flex items-center gap-1"
                      style={{ color: '#777777' }}
                    >
                      <Eye className="w-3 h-3" />
                      {t('plugins.actions.view')}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (!installed && !isInstalling && !checkingInstall) handleInstallPlugin(plugin)
                      }}
                      disabled={installed || isInstalling || checkingInstall}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                        installed
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : isInstalling
                            ? 'bg-gray-100 text-gray-500 cursor-wait'
                            : checkingInstall
                              ? 'bg-gray-100 text-gray-500 cursor-wait'
                              : pluginReady
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                      }`}
                    >
                      {checkingInstall ? (
                        <><CircularProgress size={12} sx={{ color: 'inherit' }} />{t('plugins.loading')}</>
                      ) : isInstalling ? (
                        <><CircularProgress size={12} sx={{ color: 'inherit' }} />{t('plugins.messages.installing')}</>
                      ) : installed ? (
                        <><Check className="w-3 h-3" />{t('plugins.actions.installed')}</>
                      ) : (
                        <><Download className="w-3 h-3" />{t('plugins.actions.install')}</>
                      )}
                    </button>
                  </div>
                }
              />
            </div>
          )
        })}
      </div>
    )
  }, [displayPlugins, editingState, t, searchTerm, installedPlugins, installingPluginId, pluginListLoading, showUnderDevelopment])

  const tableColumns: TableColumn<Plugin>[] = useMemo(() => [
    {
      key: 'plugin',
      title: t('plugins.tableView.columns.plugin'),
      dataIndex: 'name',
      width: 400,
      render: ({ row }) => {
        const rowReady = isPluginReady(row)
        return (
          <div className="flex items-center gap-3" style={!rowReady ? { borderLeft: '3px solid #FBBF24', paddingLeft: '8px', marginLeft: '-11px' } : undefined}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${rowReady ? 'bg-gradient-to-r from-blue-100 to-indigo-100' : 'bg-amber-100'}`}>
              {!rowReady ? '🚧' : renderIcon(row)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold text-gray-900 cursor-pointer truncate" onClick={() => handleViewPlugin(row)}>{row.name}</div>
                {!rowReady && <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-400 text-white tracking-wide">🚧 Under Development</span>}
              </div>
              <div className="mt-1 text-xs text-gray-500 truncate">{row.desc || t('plugins.noDescription')}</div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'type',
      title: t('plugins.tableView.columns.type'),
      dataIndex: 'plugin_type',
      width: 150,
      render: ({ row }) => <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">{getPluginTypeText(row.plugin_type)}</span>,
    },
    {
      key: 'actions',
      title: t('plugins.tableView.columns.actions'),
      type: 'operate',
      align: 'left',
      width: 200,
      render: ({ row }) => {
        const installed = isPluginInstalled(row)
        const isInstalling = installingPluginId === row.plugin_id
        const checkingInstall = pluginListLoading
        return (
          <div className="flex items-center justify-start gap-2">
            <Tooltip title={t('plugins.actions.view')}>
              <IconButton size="small" onClick={() => handleViewPlugin(row)} sx={{ color: '#777777' }}>
                <Eye className="w-4 h-4" />
              </IconButton>
            </Tooltip>
            <button
              onClick={() => !installed && !isInstalling && !checkingInstall && handleInstallPlugin(row)}
              disabled={installed || isInstalling || checkingInstall}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${installed ? 'bg-green-100 text-green-700 cursor-default' : isInstalling ? 'bg-gray-100 text-gray-500 cursor-wait' : checkingInstall ? 'bg-gray-100 text-gray-500 cursor-wait' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
            >
              {checkingInstall ? (
                <><CircularProgress size={12} sx={{ color: 'inherit' }} />{t('plugins.loading')}</>
              ) : isInstalling ? (
                <><CircularProgress size={12} sx={{ color: 'inherit' }} />{t('plugins.messages.installing')}</>
              ) : installed ? (
                <><Check className="w-3 h-3" />{t('plugins.actions.installed')}</>
              ) : (
                <><Download className="w-3 h-3" />{t('plugins.actions.install')}</>
              )}
            </button>
          </div>
        )
      },
    },
  ], [t, installedPlugins, installingPluginId, pluginListLoading, showUnderDevelopment])

  const tableView = useMemo(() => {
    const tableData = { columns: tableColumns, rows: displayPlugins }
    return <ConfigTable tableData={tableData} loading={marketLoading} size="small" stickyHeader emptyState={<Empty searchTerm={searchTerm} type="plugins" />} />
  }, [tableColumns, displayPlugins, marketLoading, searchTerm])

  const toolbarLeft = useMemo(() => (
    <>
      <select value={marketSource} onChange={e => setMarketSource(e.target.value as 'local' | 'agent-tools')} className="h-8 px-3 bg-white border border-[#e5e7eb] text-[#1f2937] rounded-[4px] text-sm focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors">
        <option value="local">Local</option>
        <option value="agent-tools">Agent Tools</option>
      </select>
      <SearchInput searchTerm={searchTerm} placeholder={t('plugins.searchPlaceholder')} onChange={setSearchTerm} />
      <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-8 px-3 bg-white border border-[#e5e7eb] text-[#1f2937] rounded-[4px] text-sm focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors">
        <option value="all">{t('plugins.filters.allCategories')}</option>
        {categories.slice(1).map(category => <option key={category} value={category}>{getCategoryDisplayName(category)}</option>)}
      </select>
      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600 whitespace-nowrap">
        <input type="checkbox" checked={showUnderDevelopment} onChange={e => setShowUnderDevelopment(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        Show plugins under development
      </label>
    </>
  ), [marketSource, searchTerm, categoryFilter, categories, t, showUnderDevelopment, setMarketSource])

  const toolbarRight = useMemo(() => (
    <button onClick={handleRefresh} disabled={loading || marketLoading} className="h-8 px-3 bg-white border border-[#e5e7eb] text-[#1f2937] rounded-[4px] text-sm font-medium hover:bg-[#f9fafb] hover:border-[#d1d5db] transition-colors flex items-center space-x-2">
      {loading || marketLoading ? <CircularProgress size={16} /> : <RefreshCw className="w-4 h-4" />}
      <span>{t('plugins.actions.refresh')}</span>
    </button>
  ), [loading, marketLoading, t])

  return (
    <>
      <CommonPageLayout
        title={t('plugins.tabs.market')}
        viewType={viewType}
        onViewTypeChange={type => setViewMode(type === 'grid' ? 'grid' : 'list')}
        pager={{ total: displayTotalItems, currentPage, pageSize, pageSizeOptions: [20, 60, 100, 200] }}
        onPagerChange={(page, size) => { setCurrentPage(page); setPageSize(size) }}
        loading={marketLoading}
        error={marketError || null}
        gridView={gridView}
        tableView={tableView}
        toolbarLeft={toolbarLeft}
        toolbarRight={toolbarRight}
      />

      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        {selectedPlugin && (
          <>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-3xl bg-gray-100">{renderIcon(selectedPlugin)}</div>
              <div><Typography variant="h6">{selectedPlugin.name || selectedPlugin.plugin_id || 'Plugin'}</Typography></div>
            </DialogTitle>
            <DialogContent>
              {(() => {
                const detailMarkdown = getPluginDetailMarkdown(selectedPlugin)
                const detailTools = getPluginDetailTools(selectedPlugin)
                const detailHeaders = getPluginDetailHeaders(selectedPlugin)

                return <>
              {detailLoading && <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><CircularProgress size={16} /><span>{t('plugins.loading')}</span></div>}
              <div className="space-y-4">
                <div>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('plugins.dialog.pluginDetails.basicInfo')}</Typography>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm"><tbody>
                      <tr className="bg-white border-b border-gray-200"><td className="px-3 py-2 font-medium text-gray-600 w-40">{t('plugins.versionHistory.pluginType')}</td><td className="px-3 py-2 text-gray-900">{String(selectedPlugin.category_name || selectedPlugin.category || getPluginTypeText(selectedPlugin.plugin_type))}</td></tr>
                      <tr className="bg-gray-50 border-b border-gray-200"><td className="px-3 py-2 font-medium text-gray-600">Version</td><td className="px-3 py-2 text-gray-900">{selectedPlugin.plugin_version || '—'}</td></tr>
                      <tr className="bg-white border-b border-gray-200"><td className="px-3 py-2 font-medium text-gray-600">Author</td><td className="px-3 py-2 text-gray-900">{selectedPlugin.author || '—'}</td></tr>
                    </tbody></table>
                  </div>
                </div>

                <div>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('plugins.description')}</Typography>
                  <Typography variant="body1">{selectedPlugin.desc || '—'}</Typography>
                </div>

                {Boolean(detailMarkdown) && (
                  <div>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>插件详情</Typography>
                    <div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <ReactMarkdown>{detailMarkdown}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {Boolean(selectedPlugin.tags?.length) && (
                  <div>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('plugins.dialog.pluginDetails.tags')}</Typography>
                    <div className="flex flex-wrap gap-2">{(selectedPlugin.tags || []).map(tag => <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">{tag}</span>)}</div>
                  </div>
                )}

                {Boolean(detailTools.length) && (
                  <div>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Tools ({detailTools.length})</Typography>
                    <div className="space-y-3">
                      {detailTools.map((tool, index) => {
                        const requestParams = normalizeToolRequestParams(tool)
                        const paramNames = Object.keys(requestParams)
                        return (
                          <div key={`${tool.name || 'tool'}-${index}`} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="font-medium text-gray-900">{tool.name || 'Unnamed tool'}</div>
                              <div className="text-xs text-gray-500">{String(tool.method || 'GET').toUpperCase()} {tool.path || ''}</div>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">{tool.description || '—'}</div>
                            <div className="text-xs text-gray-500 mt-2 break-all">Parameters: {paramNames.length > 0 ? paramNames.join(', ') : '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {Boolean(detailHeaders.length) && (
                  <div>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('plugins.dialog.pluginDetails.requiredConfiguration')}</Typography>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="text-left px-3 py-2 font-medium text-gray-600">{t('plugins.dialog.pluginDetails.headerName')}</th><th className="text-left px-3 py-2 font-medium text-gray-600">{t('plugins.dialog.pluginDetails.defaultValue')}</th><th className="text-left px-3 py-2 font-medium text-gray-600">{t('plugins.description')}</th></tr></thead>
                        <tbody>
                          {detailHeaders.map(([name, details], idx) => (
                            <tr key={name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2 font-mono text-xs text-blue-700 font-semibold">{name}</td>
                              <td className="px-3 py-2 font-mono text-xs text-gray-500">{details.value || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{details.description || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              </>
              })()}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailDialogOpen(false)}>{t('common.buttons.close')}</Button>
              {detailLoading && <CircularProgress size={20} />}
              {pluginListLoading ? (
                <Button disabled variant="contained" startIcon={<CircularProgress size={16} sx={{ color: 'inherit' }} />}>{t('plugins.loading')}</Button>
              ) : !isPluginInstalled(selectedPlugin) ? (
                <Button onClick={() => { handleInstallPlugin(selectedPlugin); setDetailDialogOpen(false) }} variant="contained" startIcon={<Download className="w-4 h-4" />}>{t('plugins.actions.install')}</Button>
              ) : null}
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={devConfirmDialogOpen} onClose={() => { setDevConfirmDialogOpen(false); setPendingInstallPlugin(null) }} maxWidth="xs" fullWidth>
        <DialogTitle>Install Plugin Under Development</DialogTitle>
        <DialogContent>
          <div className="flex items-start gap-3 py-2">
            <span className="text-2xl mt-0.5">⚠️</span>
            <Typography variant="body2" color="text.secondary"><strong>{pendingInstallPlugin?.name}</strong> is still under development and may not work as expected.<br /><br />Do you want to install it anyway?</Typography>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDevConfirmDialogOpen(false); setPendingInstallPlugin(null) }}>Cancel</Button>
          <Button onClick={handleConfirmDevInstall} variant="contained" color="warning">Install Anyway</Button>
        </DialogActions>
      </Dialog>

      <UnifiedSnackbar snackbar={snackbar} onClose={closeSnackbar} />
    </>
  )
}

export default PluginMarketPageNew
