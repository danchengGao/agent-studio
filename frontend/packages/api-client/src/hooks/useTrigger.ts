import { useMutation, useQuery, useQueryClient } from 'react-query'
import { TriggerService } from '../services/triggerService'

const QUERY_KEY = 'triggers'

// ── List ──────────────────────────────────────────────────────────────────────

export const useTriggers = (request: {
  space_id: string
  trigger_type?: string
  target_type?: string
  is_active?: boolean
  page?: number
  page_size?: number
}) => {
  return useQuery(
    [QUERY_KEY, 'list', request],
    () => TriggerService.listTriggers(request as Record<string, unknown>),
    {
      enabled: !!request.space_id,
      staleTime: 30_000,
      cacheTime: 5 * 60 * 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: 1000,
    },
  )
}

// ── Detail ────────────────────────────────────────────────────────────────────

export const useTriggerDetail = (space_id: string, trigger_id: string) => {
  return useQuery(
    [QUERY_KEY, 'detail', trigger_id, space_id],
    () => TriggerService.getTrigger({ space_id, trigger_id }),
    {
      enabled: !!trigger_id && !!space_id,
      staleTime: 0,
      cacheTime: 0,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: 1000,
    },
  )
}

// ── Create ────────────────────────────────────────────────────────────────────

export const useCreateTrigger = () => {
  const queryClient = useQueryClient()
  return useMutation((request: Record<string, unknown>) => TriggerService.createTrigger(request), {
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEY, 'list'])
    },
  })
}

// ── Update ────────────────────────────────────────────────────────────────────

export const useUpdateTrigger = () => {
  const queryClient = useQueryClient()
  return useMutation((request: Record<string, unknown>) => TriggerService.updateTrigger(request), {
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEY])
    },
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────

export const useDeleteTrigger = () => {
  const queryClient = useQueryClient()
  return useMutation(
    ({ space_id, trigger_id }: { space_id: string; trigger_id: string }) =>
      TriggerService.deleteTrigger({ space_id, trigger_id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QUERY_KEY, 'list'])
      },
    },
  )
}

// ── Activate / Deactivate ─────────────────────────────────────────────────────

export const useActivateTrigger = () => {
  const queryClient = useQueryClient()
  return useMutation(
    ({ space_id, trigger_id }: { space_id: string; trigger_id: string }) =>
      TriggerService.activateTrigger({ space_id, trigger_id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QUERY_KEY])
      },
    },
  )
}

export const useDeactivateTrigger = () => {
  const queryClient = useQueryClient()
  return useMutation(
    ({ space_id, trigger_id }: { space_id: string; trigger_id: string }) =>
      TriggerService.deactivateTrigger({ space_id, trigger_id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QUERY_KEY])
      },
    },
  )
}

// ── Manual Run ────────────────────────────────────────────────────────────────

export const useRunTrigger = () => {
  return useMutation(({ space_id, trigger_id }: { space_id: string; trigger_id: string }) =>
    TriggerService.runTrigger({ space_id, trigger_id }),
  )
}

// ── Execution Logs ────────────────────────────────────────────────────────────

export const useTriggerExecutionLogs = (space_id: string, trigger_id: string, page = 1, page_size = 10) => {
  return useQuery(
    [QUERY_KEY, 'logs', trigger_id, space_id, page],
    () =>
      TriggerService.getExecutionLogs({
        space_id,
        trigger_id,
        page,
        page_size,
      } as Record<string, unknown>),
    {
      enabled: !!trigger_id && !!space_id,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  )
}
