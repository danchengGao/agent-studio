import { API_ENDPOINTS, getApiClient } from '@test-agentstudio/api-client'
import { useCallback, useMemo, useRef, useState } from 'react'
import { WorkflowDetail } from '@/types/agentTypes'

export type WorkflowValidationResult = { status: 'loading' | 'success' | 'error'; message?: string }

export const useWorkflowValidation = ({ workflows, spaceId }: { workflows: WorkflowDetail[]; spaceId: string }) => {
  const [validationResults, setValidationResults] = useState<Record<string, WorkflowValidationResult>>({})
  const validationSeqRef = useRef(0)

  const isValidating = useMemo(() => Object.values(validationResults).some(v => v.status === 'loading'), [validationResults])

  const workflowValidationErrorCount = useMemo(
    () => workflows.filter(w => validationResults[w.workflow_id]?.status === 'error').length,
    [workflows, validationResults],
  )

  const validateWorkflows = useCallback(
    async (nextWorkflows: WorkflowDetail[]) => {
      if (!spaceId) return

      const seq = ++validationSeqRef.current

      setValidationResults(prev => {
        const next: Record<string, WorkflowValidationResult> = { ...prev }
        const currentIds = new Set(nextWorkflows.map(w => w.workflow_id))
        Object.keys(next).forEach(id => {
          if (!currentIds.has(id)) delete next[id]
        })
        nextWorkflows.forEach(w => {
          next[w.workflow_id] = { status: 'loading' }
        })
        return next
      })

      const apiClient = getApiClient()
      await Promise.all(
        nextWorkflows.map(async w => {
          const version = w.workflow_version || 'draft'
          try {
            await apiClient.post(API_ENDPOINTS.EXECUTION.WORKFLOW_VALIDATE, {
              id: w.workflow_id,
              version,
              space_id: spaceId,
            })
            if (validationSeqRef.current !== seq) return
            setValidationResults(prev => ({ ...prev, [w.workflow_id]: { status: 'success' } }))
          } catch (err: unknown) {
            const message = (err as any)?.response?.data?.message || (err as any)?.response?.data?.msg || (err as any)?.message || '工作流校验失败'
            if (validationSeqRef.current !== seq) return
            setValidationResults(prev => ({ ...prev, [w.workflow_id]: { status: 'error', message } }))
          }
        }),
      )
    },
    [spaceId],
  )

  return { validationResults, setValidationResults, validateWorkflows, isValidating, workflowValidationErrorCount }
}
