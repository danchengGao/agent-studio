import React from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, Copy, RefreshCw } from 'lucide-react'
import { Typography, Card, CardContent, IconButton, Chip, CircularProgress, Button } from '@mui/material'
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
  height?: string | number // 组件高度，支持CSS字符串或数字（px）
  width?: string | number // 组件宽度，支持CSS字符串或数字（px）

  // 操作回调
  onOpenAssociationsDialog: (relationObjs: RelationObj[], versionName: string) => void
  onCreateCopy?: () => void // 创建副本回调
  onRollbackToVersion?: () => void // 回滚到版本回调
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
  isOpen,
  onClose,
  versions,
  selectedVersion,
  onSelectVersion,
  loading = false,
  draftSavedTime,
  height = 'calc(100vh - 220px)', // 默认高度
  width, // 组件宽度
  onOpenAssociationsDialog,
  onCreateCopy,
  onRollbackToVersion,
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

  return (
    <>
      {/* 添加滚动条样式 */}
      <style>{scrollbarStyles}</style>

      <div className="w-full">
        <Card
          className="shadow-sm border-0 !bg-white flex flex-col"
          sx={{
            background: 'white !important',
            height: formatHeight(height), // 使用固定高度
            width: '100%', // 始终使用100%宽度以适应父容器
            display: 'flex',
            flexDirection: 'column',
            margin: '0 !important',
            padding: '0 !important',
            overflow: 'hidden', // 防止内容溢出
          }}
        >
          <CardContent className="p-0 flex flex-col" sx={{ height: '100%', padding: '0 !important', flex: 1, minHeight: 0 }}>
            {/* 顶部状态栏 */}
            <div className="border-b border-gray-200 bg-gray-50">
              <div 
                className="flex items-center justify-between"
                style={{
                  paddingLeft: 'clamp(0.5rem, 1vw, 0.75rem)',
                  paddingRight: 'clamp(0.5rem, 1vw, 0.75rem)',
                  paddingTop: 'clamp(0.5rem, 1vh, 0.75rem)',
                  paddingBottom: 'clamp(0.5rem, 1vh, 0.75rem)',
                }}
              >
                <div className="flex items-center min-w-0 flex-1" style={{ gap: 'clamp(0.375rem, 0.75vw, 0.5rem)' }}>
                  <div 
                    className="flex-shrink-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center"
                    style={{
                      width: 'clamp(1.25rem, 2.5vw, 1.5rem)',
                      height: 'clamp(1.25rem, 2.5vw, 1.5rem)',
                    }}
                  >
                    <GitBranch 
                      className="text-white" 
                      style={{
                        width: 'clamp(0.75rem, 1.5vw, 1rem)',
                        height: 'clamp(0.75rem, 1.5vw, 1rem)',
                      }}
                    />
                  </div>
                  <Typography 
                    variant="subtitle1" 
                    className="text-gray-800 font-semibold truncate"
                    sx={{
                      fontSize: 'clamp(0.75rem, 1.2vw, 0.875rem)',
                      lineHeight: 1.2,
                    }}
                  >
                    {t('components.prompts.versionHistory.title')}
                  </Typography>
                </div>
                <div className="flex items-center flex-shrink-0" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.375rem)' }}>
                  <Chip
                    label={t('components.prompts.versionHistory.versionCount', { count: publishedVersionsCount })}
                    size="small"
                    className="bg-gray-100 text-gray-700"
                    sx={{
                      height: 'clamp(1.25rem, 2.5vh, 1.5rem)',
                      fontSize: 'clamp(0.625rem, 1vw, 0.75rem)',
                      '& .MuiChip-label': {
                        padding: 'clamp(0.125rem, 0.25vw, 0.25rem) clamp(0.375rem, 0.75vw, 0.5rem)',
                      },
                    }}
                  />
                  <IconButton 
                    size="small" 
                    onClick={onClose} 
                    className="text-gray-600 hover:bg-gray-50"
                    sx={{
                      width: 'clamp(1.5rem, 3vw, 1.75rem)',
                      height: 'clamp(1.5rem, 3vw, 1.75rem)',
                      padding: 0,
                    }}
                  >
                    <svg 
                      className="text-gray-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      style={{
                        width: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                        height: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </IconButton>
                </div>
              </div>
              {loading && (
                <div 
                  className="flex items-center"
                  style={{
                    gap: 'clamp(0.25rem, 0.5vw, 0.375rem)',
                    paddingLeft: 'clamp(0.5rem, 1vw, 0.75rem)',
                    paddingBottom: 'clamp(0.375rem, 0.75vh, 0.5rem)',
                  }}
                >
                  <CircularProgress size={12} />
                  <span 
                    className="text-gray-500"
                    style={{ fontSize: 'clamp(0.625rem, 1vw, 0.75rem)' }}
                  >
                    {t('components.prompts.versionHistory.loading')}
                  </span>
                </div>
              )}
            </div>

            {/* 版本列表 */}
            <div
              className="overflow-y-auto version-history-scroll flex-1"
              style={{
                padding: 'clamp(0.5rem, 1vw, 0.75rem)',
                gap: 'clamp(0.375rem, 0.75vh, 0.625rem)',
                scrollbarWidth: 'thin', // Firefox
                scrollbarColor: '#d1d5db #f3f4f6', // Firefox
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0, // 允许flex子元素缩小
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
                    className={`rounded-lg border cursor-pointer transition-all ${
                      selectedVersion === version.id ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    style={{
                      padding: 'clamp(0.5rem, 1vw, 0.625rem)',
                      marginBottom: index < versions.length - 1 ? 'clamp(0.375rem, 0.75vh, 0.5rem)' : 0,
                    }}
                    onClick={() => onSelectVersion(version.id)}
                  >
                    <div 
                      className="flex items-start justify-between"
                      style={{
                        marginBottom: 'clamp(0.375rem, 0.75vh, 0.5rem)',
                        gap: 'clamp(0.375rem, 0.75vw, 0.5rem)',
                      }}
                    >
                      <div 
                        className="flex items-center min-w-0 flex-shrink"
                        style={{ gap: 'clamp(0.375rem, 0.75vw, 0.5rem)' }}
                      >
                        <div
                          className={`flex-shrink-0 rounded-full flex items-center justify-center font-bold ${
                            version.isDraft ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                          }`}
                          style={{
                            width: 'clamp(1.25rem, 2.5vw, 1.5rem)',
                            height: 'clamp(1.25rem, 2.5vw, 1.5rem)',
                            fontSize: 'clamp(0.625rem, 1vw, 0.75rem)',
                          }}
                        >
                          {version.isDraft ? '草' : 'V'}
                        </div>
                        <Typography 
                          variant="subtitle2" 
                          className="font-medium text-gray-800 truncate"
                          sx={{
                            fontSize: 'clamp(0.6875rem, 1.1vw, 0.8125rem)',
                            lineHeight: 1.2,
                          }}
                        >
                          {version.isDraft ? version.version : `${version.version}`}
                        </Typography>
                      </div>
                      <div 
                        className="flex flex-col items-end flex-shrink-0"
                      >
                        <Chip
                          label={version.isDraft && draftSavedTime ? formatDraftDateTime(draftSavedTime) : formatDateTime(version.createdAt)}
                          size="small"
                          className="bg-gray-100 text-gray-600"
                          sx={{
                            height: 'clamp(1rem, 2vh, 1.25rem)',
                            fontSize: 'clamp(0.5625rem, 0.9vw, 0.6875rem)',
                            '& .MuiChip-label': {
                              padding: 'clamp(0.0625rem, 0.125vw, 0.125rem) clamp(0.25rem, 0.5vw, 0.375rem)',
                            },
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.375rem, 0.75vh, 0.5rem)' }}>
                      <div 
                        className="text-gray-600"
                        style={{ fontSize: 'clamp(0.625rem, 1vw, 0.75rem)' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.25rem, 0.5vh, 0.375rem)' }}>
                          {!version.isDraft && (
                            <>
                              <div className="flex items-start space-x-1">
                                <span className="flex-shrink-0">{t('components.prompts.versionHistory.author')}:</span>
                                <div className="flex items-center space-x-1 min-w-0">
                                  <div className="w-3 h-3 flex-shrink-0 bg-blue-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">U</span>
                                  </div>
                                  <span className="font-medium truncate">{version.author}</span>
                                </div>
                              </div>
                              <div className="flex items-start space-x-1">
                                <span className="flex-shrink-0 whitespace-nowrap">{t('components.prompts.versionHistory.description')}:</span>
                                <span className="font-medium break-words">{version.description}</span>
                              </div>
                            </>
                          )}
                          {version.associations?.relationObjs && version.associations.relationObjs.length > 0 && (
                            <div 
                              className="flex items-start"
                              style={{ gap: 'clamp(0.125rem, 0.25vw, 0.25rem)' }}
                            >
                              <span 
                                className="flex-shrink-0 whitespace-nowrap"
                                style={{ fontSize: 'clamp(0.625rem, 1vw, 0.75rem)' }}
                              >
                                {t('components.prompts.versionHistory.associated')}:
                              </span>
                              <div 
                                className="flex flex-wrap min-w-0"
                                style={{ gap: 'clamp(0.125rem, 0.25vw, 0.25rem)' }}
                              >
                                {version.associations.relationObjs.slice(0, 2).map(relationObj => (
                                  <span
                                    key={relationObj.obj_id}
                                    className="bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 transition-colors truncate max-w-full inline-block"
                                    style={{
                                      fontSize: 'clamp(0.5625rem, 0.9vw, 0.6875rem)',
                                      padding: 'clamp(0.0625rem, 0.125vh, 0.125rem) clamp(0.25rem, 0.5vw, 0.375rem)',
                                    }}
                                    onClick={e => {
                                      e.stopPropagation()
                                      handleRelationObjNavigate(relationObj, workspaceId, navigate)
                                    }}
                                    title={`${relationObj.obj_type_name}${t('components.prompts.versionHistory.colon')}${relationObj.obj_name}`}
                                  >
                                    {relationObj.obj_type_name}
                                    {t('components.prompts.versionHistory.colon')}
                                    {relationObj.obj_name}
                                  </span>
                                ))}
                                {version.associations.relationObjs.length > 2 && (
                                  <span
                                    className="bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200 transition-colors flex-shrink-0"
                                    style={{
                                      fontSize: 'clamp(0.5625rem, 0.9vw, 0.6875rem)',
                                      padding: 'clamp(0.0625rem, 0.125vh, 0.125rem) clamp(0.25rem, 0.5vw, 0.375rem)',
                                    }}
                                    onClick={e => {
                                      e.stopPropagation()
                                      const versionName = version.isDraft ? version.version : `v${version.version}`
                                      onOpenAssociationsDialog(version.associations!.relationObjs, versionName)
                                    }}
                                  >
                                    +{version.associations.relationObjs.length - 2}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {version.baseVersion && (
                            <div className="flex items-start space-x-1">
                              <span className="flex-shrink-0 whitespace-nowrap">{t('components.prompts.versionHistory.baseVersion')}:</span>
                              <span className="font-medium truncate">{version.baseVersion}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedVersion === version.id && (
                        <div 
                          className="border-t border-gray-200"
                          style={{
                            marginTop: 'clamp(0.375rem, 0.75vh, 0.5rem)',
                            paddingTop: 'clamp(0.375rem, 0.75vh, 0.5rem)',
                          }}
                        >
                          <div 
                            className="text-green-600 font-medium"
                            style={{ fontSize: 'clamp(0.625rem, 1vw, 0.75rem)' }}
                          >
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

            {/* 版本操作按钮 - 当选中非草稿版本时显示 */}
            {selectedVersion && selectedVersion !== 'current-draft' && (onCreateCopy || onRollbackToVersion) && (
              <div 
                className="border-t border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50 flex-shrink-0"
                style={{
                  padding: 'clamp(0.5rem, 1vw, 0.75rem)',
                }}
              >
                <div 
                  className="flex"
                  style={{ gap: 'clamp(0.375rem, 0.75vw, 0.5rem)' }}
                >
                  {onCreateCopy && (
                    <Button
                      variant="outlined"
                      startIcon={
                        <Copy 
                          style={{
                            width: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                            height: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                          }}
                        />
                      }
                      onClick={onCreateCopy}
                      className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                      size="small"
                      sx={{
                        fontSize: 'clamp(0.625rem, 1vw, 0.75rem)',
                        padding: 'clamp(0.25rem, 0.5vh, 0.375rem) clamp(0.375rem, 0.75vw, 0.5rem)',
                        minHeight: 'clamp(1.75rem, 3.5vh, 2rem)',
                      }}
                    >
                      <span className="truncate">{t('components.prompts.promptEditPage.createCopy')}</span>
                    </Button>
                  )}
                  {onRollbackToVersion && (
                    <Button
                      variant="contained"
                      startIcon={
                        <RefreshCw 
                          style={{
                            width: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                            height: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                          }}
                        />
                      }
                      onClick={onRollbackToVersion}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      size="small"
                      sx={{
                        fontSize: 'clamp(0.625rem, 1vw, 0.75rem)',
                        padding: 'clamp(0.25rem, 0.5vh, 0.375rem) clamp(0.375rem, 0.75vw, 0.5rem)',
                        minHeight: 'clamp(1.75rem, 3.5vh, 2rem)',
                      }}
                    >
                      <span className="truncate">{t('components.prompts.promptEditPage.revertToVersion')}</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default VersionHistory
