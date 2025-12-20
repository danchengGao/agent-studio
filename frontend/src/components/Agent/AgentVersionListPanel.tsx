import React, { useEffect, useState } from 'react'
import { History, X, FileText, Tag, Loader2, Copy, Trash2 } from 'lucide-react'
import DeleteConfirmationDialog from '@/components/Common/DeleteConfirmationDialog'
import { getDefaultSpaceId } from '@/utils/spaceUtils'
import { AgentService, AgentVersionListRequest, AgentVersionListResponse } from '@test-agentstudio/api-client'
import dayjs from 'dayjs'

export interface VersionListItem {
  id: string
  version: string
  description?: string
  createdAt?: string
  createdTs?: number
}

interface AgentVersionListPanelProps {
  open: boolean
  agentId: string | null
  selectedVersion?: string | null
  onSelectVersion?: (versionId: string) => void
  onRestoreVersion?: (versionId: string) => void
  onClose?: () => void
  widthPx?: number
}

const AgentVersionListPanel: React.FC<AgentVersionListPanelProps> = ({
  open,
  agentId,
  selectedVersion,
  onSelectVersion,
  onRestoreVersion,
  onClose,
  widthPx = 360,
}) => {
  // 本地状态：版本列表、加载与错误
  const [versions, setVersions] = useState<VersionListItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  // 点击切换版本的轻量loading标记（仅影响列表UI，不重新拉取）
  const [switchingVersion, setSwitchingVersion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [restoreTargetVersion, setRestoreTargetVersion] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTargetVersion, setDeleteTargetVersion] = useState<string | null>(null)
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null)

  // 时间格式化工具（dayjs）：支持秒/毫秒/ISO 字符串
  const formatTimestamp = (ts: number | string): string => {
    try {
      if (typeof ts === 'number') {
        const ms = ts > 1e12 ? ts : ts > 1e10 ? ts : ts > 0 ? ts * 1000 : NaN
        if (!ms || isNaN(ms)) return '无效时间'
        const d = dayjs(ms)
        return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : '无效时间'
      }
      const d = dayjs(ts)
      return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : '无效时间'
    } catch {
      return '时间格式错误'
    }
  }

  // 将时间转换为毫秒数，用于排序（支持秒/毫秒/ISO）
  const toMs = (ts: number | string): number | null => {
    try {
      if (typeof ts === 'number') {
        const ms = ts > 1e12 ? ts : ts > 1e10 ? ts : ts > 0 ? ts * 1000 : NaN
        return !ms || isNaN(ms) ? null : ms
      }
      const d = dayjs(ts)
      return d.isValid() ? d.valueOf() : null
    } catch {
      return null
    }
  }

  const handleCreateCopy = async (version: string) => {
    if (!agentId) return
    try {
      const resp = await AgentService.copyAgent({ agent_id: agentId, space_id: getDefaultSpaceId(), version: version })
      const newId = resp?.data?.agent_id
      if (newId) {
        window.open(`/dashboard/agents/${newId}`, '_blank')
      }
    } catch (e) {
      console.error('创建副本失败:', e)
      setSwitchingVersion(null)
    }
  }

  const openRestoreConfirm = (version: string) => {
    setRestoreTargetVersion(version)
    setRestoreConfirmOpen(true)
  }
  const closeRestoreConfirm = () => {
    setRestoreConfirmOpen(false)
    setRestoreTargetVersion(null)
  }
  const confirmRestore = async () => {
    if (!agentId || !restoreTargetVersion) return
    try {
      await onRestoreVersion?.(restoreTargetVersion)
    } catch (e) {
      console.error('还原版本失败:', e)
      setSwitchingVersion(null)
    } finally {
      closeRestoreConfirm()
    }
  }

  const openDeleteDialog = (version: string) => {
    setDeleteTargetVersion(version)
    setDeleteConfirmOpen(true)
  }

  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false)
    setDeleteTargetVersion(null)
  }

  const handleDeleteVersion = async () => {
    if (!agentId || !deleteTargetVersion) return
    try {
      setDeletingVersion(deleteTargetVersion)
      await AgentService.deleteAgentVersion({
        agent_id: agentId,
        space_id: getDefaultSpaceId(),
        agent_version: deleteTargetVersion,
      })

      // 如果删除的是当前选中的版本，切换到草稿
      if (selectedVersion === deleteTargetVersion) {
        onSelectVersion && onSelectVersion('draft')
      }

      // 重新加载版本列表
      const req: AgentVersionListRequest = {
        agent_id: agentId,
        space_id: getDefaultSpaceId(),
      }
      const resp: AgentVersionListResponse = await AgentService.getAgentVersionList(req)
      if (resp.code === 200 && resp.data?.versions) {
        const items: VersionListItem[] = resp.data.versions.map((v: any, idx: number) => {
          const ver = v.agent_version?.startsWith('v') ? v.agent_version : `v${v.agent_version}`
          const createdTs = toMs(v.create_time)
          return {
            id: v.agent_version || String(idx),
            version: ver,
            description: v.version_description || '无版本描述',
            createdAt: formatTimestamp(v.create_time),
            createdTs: createdTs ?? undefined,
          }
        })
        const sortedItems = [...items].sort((a, b) => (b.createdTs ?? 0) - (a.createdTs ?? 0))
        const hasDraft = sortedItems.some(i => i.version.toLowerCase() === 'draft' || i.id === 'draft')
        const draftItem: VersionListItem = {
          id: 'draft',
          version: 'draft',
          description: '当前草稿版本',
        }
        setVersions(hasDraft ? sortedItems : [draftItem, ...sortedItems])
      }

      setDeleteConfirmOpen(false)
      setDeleteTargetVersion(null)
    } catch (e) {
      console.error('删除版本失败:', e)
    } finally {
      setDeletingVersion(null)
    }
  }

  useEffect(() => {
    if (selectedVersion) {
      // 选中版本变化后，结束卡片内的loading提示
      setSwitchingVersion(null)
      console.log('selectedVersion', selectedVersion)
    }
  }, [selectedVersion])

  // 打开面板或切换智能体时加载版本列表（选择版本不触发重新加载，避免滚动位置被重置）
  useEffect(() => {
    const load = async () => {
      if (!open || !agentId) return
      try {
        setLoading(true)
        setError(null)
        const req: AgentVersionListRequest = {
          agent_id: agentId,
          space_id: getDefaultSpaceId(),
        }
        const resp: AgentVersionListResponse = await AgentService.getAgentVersionList(req)
        if (resp.code === 200 && resp.data?.versions) {
          const items: VersionListItem[] = resp.data.versions.map((v: any, idx: number) => {
            const ver = v.agent_version?.startsWith('v') ? v.agent_version : `v${v.agent_version}`
            const createdTs = toMs(v.create_time)
            return {
              id: v.agent_version || String(idx),
              version: ver,
              description: v.version_description || '无版本描述',
              createdAt: formatTimestamp(v.create_time),
              createdTs: createdTs ?? undefined,
            }
          })
          // 按创建时间倒序排序（最新在前），无时间的排在末尾
          const sortedItems = [...items].sort((a, b) => (b.createdTs ?? 0) - (a.createdTs ?? 0))
          // 永远加入一个当前草稿版本（置于列表顶部），避免重复
          const hasDraft = sortedItems.some(i => i.version.toLowerCase() === 'draft' || i.id === 'draft')
          const draftItem: VersionListItem = {
            id: 'draft',
            version: 'draft',
            description: '当前草稿版本',
          }
          setVersions(hasDraft ? sortedItems : [draftItem, ...sortedItems])
        } else {
          throw new Error(resp.message || '获取版本列表失败')
        }
      } catch (err: any) {
        setError(err?.message || '获取版本列表失败')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, agentId])

  if (!open) return null
  return (
    <div className={`h-full bg-white border-l border-gray-200 shadow-sm flex flex-col flex-none`} style={{ width: `${widthPx}px` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-2 rounded-lg mr-2">
            <History className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">版本历史</div>
            <div className="text-xs text-gray-500">查看和切换智能体版本</div>
          </div>
        </div>
        <button className="text-gray-500 hover:text-gray-700 p-2 rounded" aria-label="close" onClick={() => onClose && onClose()}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-3 pl-5 py-2">
        {error && <div className="p-4 text-sm text-red-600">加载失败：{error}</div>}
        {loading ? (
          <div className="p-4 text-sm text-gray-500">加载中...</div>
        ) : versions && versions.length > 0 ? (
          <ul className="space-y-3">
            {versions.map(item => {
              const isActive = item.version === selectedVersion
              return (
                <li key={item.id}>
                  <VersionCard
                    item={item}
                    isActive={isActive}
                    onSelectVersion={onSelectVersion}
                    switchingVersion={switchingVersion}
                    handleCreateCopy={handleCreateCopy}
                    handleRestoreVersion={openRestoreConfirm}
                    handleDeleteVersion={openDeleteDialog}
                    deletingVersion={deletingVersion}
                  />
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="p-4 text-sm text-gray-500">暂无版本数据</div>
        )}
      </div>
      {/* Restore confirmation dialog */}
      <DeleteConfirmationDialog
        isOpen={restoreConfirmOpen}
        onClose={closeRestoreConfirm}
        onConfirm={confirmRestore}
        title="还原为此版本"
        message="还原后，将覆盖最新编写的智能体内容"
        confirmButtonText="确认"
        iconType="warning"
      />
      {/* Delete confirmation dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteVersion}
        title="删除版本"
        message={`确定要删除版本 ${deleteTargetVersion} 吗？删除后无法恢复`}
        confirmButtonText="删除"
        iconType="danger"
      />
    </div>
  )
}

const VersionCard: React.FC<{
  item: VersionListItem
  isActive: boolean
  onSelectVersion?: (versionId: string) => void
  switchingVersion?: string | null
  handleCreateCopy?: (versionId: string) => void
  handleRestoreVersion?: (versionId: string) => void
  handleDeleteVersion?: (versionId: string) => void
  deletingVersion?: string | null
}> = ({ item, isActive, onSelectVersion, switchingVersion, handleCreateCopy, handleRestoreVersion, handleDeleteVersion, deletingVersion }) => {
  return (
    <div
      className={`group cursor-pointer rounded-2xl border px-4 py-3 transition-all ${
        isActive ? 'border-green-300 bg-white shadow-sm ring-1 ring-green-200' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      } ${switchingVersion === item.version ? 'opacity-75' : ''}`}
      onClick={() => {
        if (isActive) return
        onSelectVersion && onSelectVersion(item.version)
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="font-semibold text-gray-900 tracking-tight">{item.version}</span>
        </div>
        {item.createdAt && (
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md border leading-4 ${isActive ? 'border-green-200 bg-green-50/70 text-green-700' : 'border-gray-200 bg-gray-50/70 text-gray-700'}`}
          >
            {switchingVersion === item.version ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
            {switchingVersion === item.version ? '切换中...' : item.createdAt}
          </span>
        )}
      </div>
      {item.version !== 'draft' && (
        <div className="mt-2 grid grid-cols-[20px_1fr] items-start text-sm">
          <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
          <div>
            <span className="text-gray-600">版本描述：</span>
            <span className="whitespace-pre-line break-words text-gray-800">{item.description || '无版本描述'}</span>
          </div>
        </div>
      )}
      {isActive && (
        <div className="mt-2 flex justify-end gap-2 flex-wrap">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-300 rounded-md transition-colors hover:bg-green-50 focus:outline-none disabled:opacity-60"
            onClick={e => {
              e.stopPropagation()
              handleCreateCopy && handleCreateCopy(item.version)
            }}
          >
            创建副本
          </button>
          {item.version !== 'draft' && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-300 rounded-md transition-colors hover:bg-green-50 focus:outline-none disabled:opacity-60"
              onClick={e => {
                e.stopPropagation()
                handleRestoreVersion && handleRestoreVersion(item.version)
              }}
            >
              还原至该版本
            </button>
          )}
          {item.version !== 'draft' && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md transition-colors hover:bg-red-50 focus:outline-none disabled:opacity-60"
              onClick={e => {
                e.stopPropagation()
                handleDeleteVersion && handleDeleteVersion(item.version)
              }}
              disabled={deletingVersion === item.version}
            >
              {deletingVersion === item.version ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="w-3 h-3" />
                  删除
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AgentVersionListPanel
