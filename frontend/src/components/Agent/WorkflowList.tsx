import Typography from '@mui/material/Typography'
import { WorkflowDetail } from '../../types/agentTypes'
import { Settings, Trash2, Workflow } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import DeleteConfirmationDialog from '@/components/Common/DeleteConfirmationDialog'
import { getDefaultSpaceId } from '@/utils/spaceUtils'
import { useAgentStore } from '@/stores/useAgentStore'
import { useWorkflowVersions, useSelectedVersions } from '@/hooks/useWorkflowVersions'
import { isVersionValid } from '@/utils/versionMenu'
import { VersionField } from '@/components/Agent/VersionField'

// 工作流列表组件
const WorkflowList = ({
  workflowObjects,
  onClick,
  disabled = false,
}: {
  workflowObjects: WorkflowDetail[]
  onClick: (operate: 'delete' | 'setting', workflowId: string, version?: string) => void
  disabled?: boolean
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({})
  const updateWorkflowDetail = useAgentStore(s => s.updateWorkflowDetail)

  const spaceId = useMemo(() => getDefaultSpaceId() || '', [])
  const { versionsMap } = useWorkflowVersions(workflowObjects, spaceId)

  const computedSelected = useSelectedVersions(workflowObjects, versionsMap)
  useEffect(() => {
    setSelectedVersions(computedSelected)
  }, [computedSelected])

  useEffect(() => {
    const invalids = workflowObjects.filter(w => {
      const val = selectedVersions[w.workflow_id] ?? 'draft'
      return versionsMap[w.workflow_id] && !isVersionValid(w.workflow_id, versionsMap, val)
    })
    if (invalids.length) {
      setSelectedVersions(prev => {
        const next = { ...prev }
        invalids.forEach(w => {
          next[w.workflow_id] = 'draft'
        })
        return next
      })
      const updated = workflowObjects.map(w => (invalids.find(i => i.workflow_id === w.workflow_id) ? { ...w, workflow_version: 'draft' } : w))
      updateWorkflowDetail(updated)
    }
  }, [versionsMap, workflowObjects, selectedVersions])

  const handleVersionChange = (workflowId: string, ver: string) => {
    setSelectedVersions(prev => ({ ...prev, [workflowId]: ver }))
    const updated = workflowObjects.map(w => (w.workflow_id === workflowId ? { ...w, workflow_version: ver } : w))
    updateWorkflowDetail(updated)
  }
  return (
    <div className="space-y-4">
      {workflowObjects.map(workflow => (
        <div
          key={workflow.workflow_id}
          className="flex items-start justify-between py-4 px-5 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-sm transition-all duration-200"
        >
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center border border-blue-200 mt-1">
              <Workflow className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0 max-w-[320px]">
              <Typography
                sx={{
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '8px',
                }}
                title={workflow.workflow_name}
              >
                {workflow.workflow_name}
              </Typography>
              {workflow.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    marginTop: 0,
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '400px',
                  }}
                  title={workflow.description}
                >
                  {workflow.description}
                </Typography>
              )}
              {workflow.create_time && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontSize: '0.75rem',
                    lineHeight: 1.4,
                    marginTop: 0,
                    marginBottom: '12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '400px',
                  }}
                >
                  创建时间: {new Date(workflow.create_time).toLocaleDateString()}
                </Typography>
              )}
              <div className="flex items-center space-x-3 mt-1">
                <span className="text-xs font-medium text-gray-600">关联版本：</span>
                <VersionField
                  workflowId={workflow.workflow_id}
                  value={selectedVersions[workflow.workflow_id] ?? 'draft'}
                  onChange={ver => handleVersionChange(workflow.workflow_id, ver)}
                  spaceId={spaceId}
                  readonly={disabled}
                />
              </div>
            </div>
          </div>
          <div className="flex space-x-5 pt-2">
            <button
              title="设置"
              onClick={e => {
                e.stopPropagation()
                const currentVersion = selectedVersions[workflow.workflow_id] ?? 'draft'
                onClick('setting', workflow.workflow_id, currentVersion)
              }}
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
            <button
              title="删除"
              onClick={e => {
                e.stopPropagation()
                if (!disabled) {
                  setPendingDelete({ id: workflow.workflow_id, name: workflow.workflow_name })
                  setConfirmOpen(true)
                }
              }}
              disabled={disabled}
              className={`${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Trash2 className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      ))}
      {workflowObjects.length === 0 && <div className="text-center py-6 text-gray-500">未添加工作流，可点击右上角进行添加</div>}
      <DeleteConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setPendingDelete(null)
        }}
        onConfirm={() => {
          if (pendingDelete) onClick('delete', pendingDelete.id)
          setConfirmOpen(false)
          setPendingDelete(null)
        }}
        itemType="workflow"
        itemName={pendingDelete?.name || ''}
        title="移除工作流"
        confirmButtonText="确认"
        message={`确定移除此工作流？此操作无法撤销。`}
      />
    </div>
  )
}

export default WorkflowList
