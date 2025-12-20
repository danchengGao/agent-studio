import React from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { Typography, Card, CardContent, IconButton, Chip, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { formatDateTime, formatDraftDateTime, handleRelationObjNavigate } from '@/utils/prompts/utils'
import type { PromptVersion } from '@/types/promptType'
import type { RelationObj } from '@test-agentstudio/api-client'
import { useAuthStore } from '@/stores/useAuthStore'
import { ENV_CONFIG } from '@/config/environment'

// 添加滚动条样式
const scrollbarStyles = `
  .version-history-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .version-history-scroll::-webkit-scrollbar-track {
    background-color: #f3f4f6;
    border-radius: 3px;
  }
  .version-history-scroll::-webkit-scrollbar-thumb {
    background-color: #d1d5db;
    border-radius: 3px;
  }
  .version-history-scroll::-webkit-scrollbar-thumb:hover {
    background-color: #9ca3af;
  }
`

export interface VersionHistoryProps {
  // 基础状态
  isOpen: boolean
  onClose: () => void

  // 版本数据
  versions: Array<{
    id: string
    version: string
    isDraft?: boolean
    isActive?: boolean
    author?: string
    description?: string
    createdAt: string
    baseVersion?: string
    associations?: {
      relationObjs: RelationObj[]
    }
  }>

  // 选中状态
  selectedVersion: string | null
  onSelectVersion: (versionId: string) => void

  // 加载状态
  loading?: boolean

  // 草稿相关
  draftSavedTime?: Date | null

  // 布局配置
  maxHeight?: string | number // 组件最大高度，支持CSS字符串或数字（px）
  minHeight?: string | number // 组件最小高度，支持CSS字符串或数字（px）
  width?: string | number // 组件宽度，支持CSS字符串或数字（px）
  showBottomRadius?: boolean // 是否显示底部圆角，默认true，当有操作按钮时设为false

  // 操作回调
  onOpenAssociationsDialog: (relationObjs: RelationObj[], versionName: string) => void
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
  isOpen,
  onClose,
  versions,
  selectedVersion,
  onSelectVersion,
  loading = false,
  draftSavedTime,
  maxHeight = 'calc(100vh - 220px)', // 默认最大高度
  minHeight = '400px', // 默认最小高度
  width, // 组件宽度
  showBottomRadius = true, // 默认显示底部圆角
  onOpenAssociationsDialog,
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const workspaceId = user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID

  // 格式化高度值的辅助函数
  const formatHeight = (height: string | number): string => {
    if (typeof height === 'number') {
      return `${height}px`
    }
    return height
  }

  if (!isOpen) {
    return null
  }

  const publishedVersionsCount = versions.filter(v => !v.isDraft).length

  // 内部计算版本列表区域的高度
  // 假设头部状态栏高度约为 120px
  const calculateListHeight = (componentMaxHeight: string | number, componentMinHeight: string | number, headerHeight = 120) => {
    // 计算最大高度
    let listMaxHeight: string
    if (typeof componentMaxHeight === 'number') {
      listMaxHeight = `${componentMaxHeight - headerHeight}px`
    } else if (typeof componentMaxHeight === 'string' && componentMaxHeight.includes('calc(')) {
      // 修复 calc 表达式处理
      const calcContent = componentMaxHeight.replace('calc(', '').replace(')', '')
      listMaxHeight = `calc(${calcContent} - ${headerHeight}px)`
    } else {
      const numericValue = parseInt(componentMaxHeight.toString())
      if (!isNaN(numericValue)) {
        listMaxHeight = `${numericValue - headerHeight}px`
      } else {
        listMaxHeight = 'calc(100vh - 380px)' // 默认值
      }
    }

    // 计算最小高度（基于外部传入的组件最小高度）
    let listMinHeight: string
    if (typeof componentMinHeight === 'number') {
      listMinHeight = `${Math.max(200, componentMinHeight - headerHeight)}px` // 至少200px
    } else if (typeof componentMinHeight === 'string' && componentMinHeight.includes('calc(')) {
      // 修复 calc 表达式处理
      const calcContent = componentMinHeight.replace('calc(', '').replace(')', '')
      listMinHeight = `calc(${calcContent} - ${headerHeight}px)`
    } else {
      const numericValue = parseInt(componentMinHeight.toString())
      if (!isNaN(numericValue)) {
        listMinHeight = `${Math.max(200, numericValue - headerHeight)}px` // 至少200px
      } else {
        listMinHeight = '200px' // 默认值
      }
    }

    return { maxHeight: listMaxHeight, minHeight: listMinHeight }
  }

  const listHeights = calculateListHeight(maxHeight, minHeight)

  return (
    <>
      {/* 添加滚动条样式 */}
      <style>{scrollbarStyles}</style>

      <div className="xl:col-span-1 w-full">
        <Card
          className="shadow-sm border-0 !bg-white flex flex-col"
          sx={{
            background: 'white !important',
            maxHeight: formatHeight(maxHeight), // 使用可配置的最大高度
            minHeight: formatHeight(minHeight), // 使用可配置的最小高度
            width: width ? formatHeight(width) : '100%', // 使用可配置的宽度
            height: '100%', // 改为100%以填充父容器
            display: 'flex',
            flexDirection: 'column',
            borderBottomLeftRadius: showBottomRadius ? undefined : 0,
            borderBottomRightRadius: showBottomRadius ? undefined : 0,
            margin: '0 !important',
            padding: '0 !important',
            overflow: 'hidden', // 防止内容溢出
          }}
        >
          <CardContent className="p-0 flex flex-col" sx={{ height: '100%', padding: '0 !important' }}>
            {/* 顶部状态栏 */}
            <div className="border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between px-0 py-4">
                <div className="flex items-center space-x-2 px-4">
                  <div className="w-6 h-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                    <GitBranch className="w-4 h-4 text-white" />
                  </div>
                  <Typography variant="h6" className="text-gray-800 font-semibold">
                    {t('components.prompts.versionHistory.title')}
                  </Typography>
                </div>
                <div className="flex items-center space-x-2 px-4">
                  <Chip
                    label={t('components.prompts.versionHistory.versionCount', { count: publishedVersionsCount })}
                    size="small"
                    className="bg-gray-100 text-gray-700"
                  />
                  <IconButton size="small" onClick={onClose} className="text-gray-600 hover:bg-gray-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </IconButton>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 px-4">
                {loading && (
                  <div className="flex items-center space-x-1">
                    <CircularProgress size={12} />
                    <span className="text-xs text-gray-500">{t('components.prompts.versionHistory.loading')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 版本列表 */}
            <div
              className="p-4 space-y-3 overflow-y-auto version-history-scroll"
              style={{
                maxHeight: listHeights.maxHeight, // 使用内部计算的版本列表最大高度
                minHeight: listHeights.minHeight, // 使用内部计算的版本列表最小高度
                scrollbarWidth: 'thin', // Firefox
                scrollbarColor: '#d1d5db #f3f4f6', // Firefox
              }}
            >
              {versions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <GitBranch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>{t('components.prompts.versionHistory.noVersions')}</p>
                  <p className="text-sm">{t('components.prompts.versionHistory.noVersionsDescription')}</p>
                </div>
              ) : (
                versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedVersion === version.id ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => onSelectVersion(version.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            version.isDraft ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                          }`}
                        >
                          {version.isDraft ? '草' : 'V'}
                        </div>
                        <Typography variant="subtitle2" className="font-medium text-gray-800">
                          {version.isDraft ? version.version : `${version.version}`}
                        </Typography>
                      </div>
                      <div className="flex items-center space-x-1">
                        {version.isDraft && (
                          <Chip label={t('components.prompts.versionHistory.draft')} size="small" className="bg-orange-100 text-orange-700 text-xs" />
                        )}
                        <Chip
                          label={version.isDraft && draftSavedTime ? formatDraftDateTime(draftSavedTime) : formatDateTime(version.createdAt)}
                          size="small"
                          className="bg-gray-100 text-gray-600 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-gray-600">
                        <div className="space-y-1">
                          {!version.isDraft && (
                            <>
                              <div className="flex items-center space-x-1">
                                <span>{t('components.prompts.versionHistory.author')}:</span>
                                <div className="flex items-center space-x-1">
                                  <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">U</span>
                                  </div>
                                  <span className="font-medium">{version.author}</span>
                                </div>
                              </div>
                              <div className="flex items-start space-x-1">
                                <span>{t('components.prompts.versionHistory.description')}:</span>
                                <span className="font-medium">{version.description}</span>
                              </div>
                            </>
                          )}
                          {version.associations?.relationObjs && version.associations.relationObjs.length > 0 && (
                            <div className="flex items-start space-x-1">
                              <span>{t('components.prompts.versionHistory.associated')}:</span>
                              <div className="flex flex-wrap gap-1">
                                {version.associations.relationObjs.slice(0, 3).map(relationObj => (
                                  <span
                                    key={relationObj.obj_id}
                                    className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-200 transition-colors"
                                    onClick={e => {
                                      e.stopPropagation()
                                      handleRelationObjNavigate(relationObj, workspaceId, navigate)
                                    }}
                                  >
                                    {relationObj.obj_type_name}
                                    {t('components.prompts.versionHistory.colon')}
                                    {relationObj.obj_name}
                                  </span>
                                ))}
                                {version.associations.relationObjs.length > 3 && (
                                  <span
                                    className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded cursor-pointer hover:bg-gray-200 transition-colors"
                                    onClick={e => {
                                      e.stopPropagation()
                                      const versionName = version.isDraft ? version.version : `v${version.version}`
                                      onOpenAssociationsDialog(version.associations!.relationObjs, versionName)
                                    }}
                                  >
                                    ...
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {version.baseVersion && (
                            <div className="flex items-start space-x-1">
                              <span>{t('components.prompts.versionHistory.baseVersion')}:</span>
                              <span className="font-medium">{version.baseVersion}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedVersion === version.id && (
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <div className="text-xs text-green-600 font-medium">
                            {version.isDraft
                              ? t('components.prompts.versionHistory.loadedToEditor')
                              : t('components.prompts.versionHistory.loadedToEditorVersion')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default VersionHistory
