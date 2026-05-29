import { useMutation, useQuery, useQueryClient } from 'react-query'
import type { ModelProvider } from '../types/modelTypes'
import { vlmModelService } from '../services/vlmModelService'
import type { FrontendVLMModelConfig } from '../services/vlmModelService'
import type { VLMModelTestResponse } from '../types/vlmModelTypes'

export const useVLMModels = (params?: {
  spaceId?: string
  provider?: ModelProvider
  is_active?: boolean
  search?: string
  page?: number
  size?: number
  sort_by?: 'updated_at' | 'created_at' | 'name'
  sort_order?: 'asc' | 'desc'
}) => {
  const { spaceId, ...queryParams } = params || {}

  return useQuery(['vlmModels', 'list', spaceId, queryParams], () => vlmModelService.getVLMModelConfigs(spaceId!, queryParams), {
    enabled: !!spaceId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
    onError: error => {
      console.error('Failed to fetch VLM models:', error)
    },
  })
}

export const useVLMModel = (configId: string, spaceId: string) => {
  return useQuery(['vlmModels', 'detail', configId, spaceId], () => vlmModelService.getVLMModelConfig(configId, spaceId), {
    enabled: !!configId && !!spaceId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
    onError: error => {
      console.error('Failed to fetch VLM model detail:', error)
    },
  })
}

export const useCreateVLMModel = () => {
  const queryClient = useQueryClient()

  return useMutation(({ model, spaceId }: { model: Partial<FrontendVLMModelConfig>; spaceId: string }) => vlmModelService.createVLMModelConfig(model, spaceId), {
    onSuccess: () => {
      queryClient.invalidateQueries(['vlmModels', 'list'])
    },
    onError: error => {
      console.error('Failed to create VLM model:', error)
    },
  })
}

export const useUpdateVLMModel = () => {
  const queryClient = useQueryClient()

  return useMutation(
    ({ id, model, spaceId }: { id: string; model: Partial<FrontendVLMModelConfig>; spaceId: string }) =>
      vlmModelService.updateVLMModelConfig(id, model, spaceId),
    {
      onSuccess: updatedModel => {
        queryClient.setQueryData(['vlmModels', 'detail', updatedModel.id], updatedModel)
        queryClient.invalidateQueries(['vlmModels', 'list'])
        queryClient.invalidateQueries(['vlmModels', 'detail', updatedModel.id])
      },
      onError: error => {
        console.error('Failed to update VLM model:', error)
      },
    },
  )
}

export const useDeleteVLMModel = () => {
  const queryClient = useQueryClient()

  return useMutation(({ id, spaceId }: { id: string; spaceId: string }) => vlmModelService.deleteVLMModelConfig(id, spaceId), {
    onSuccess: (_, variables) => {
      queryClient.removeQueries(['vlmModels', 'detail', variables.id])
      queryClient.invalidateQueries(['vlmModels', 'list'])
    },
    onError: error => {
      console.error('Failed to delete VLM model:', error)
    },
  })
}

export const useToggleVLMModelStatus = () => {
  const queryClient = useQueryClient()

  return useMutation(({ id, spaceId }: { id: string; spaceId: string }) => vlmModelService.toggleVLMModelStatus(id, spaceId), {
    onSuccess: updatedModel => {
      queryClient.setQueryData(['vlmModels', 'detail', updatedModel.id], updatedModel)
      queryClient.invalidateQueries(['vlmModels', 'list'])
      queryClient.invalidateQueries(['vlmModels', 'detail', updatedModel.id])
    },
    onError: error => {
      console.error('Failed to toggle VLM model status:', error)
    },
  })
}

export const useTestVLMModel = () => {
  return useMutation(
    ({
      id,
      prompt,
      spaceId,
      parameters,
      imageBase64,
      mimeType,
    }: {
      id: string
      prompt: string
      spaceId: string
      parameters?: { temperature?: number; top_p?: number; max_tokens?: number }
      imageBase64?: string
      mimeType?: string
    }): Promise<VLMModelTestResponse> => vlmModelService.testVLMModel(id, prompt, spaceId, parameters, imageBase64, mimeType),
    {
      onError: error => {
        console.error('Failed to test VLM model:', error)
      },
    },
  )
}

export const useRefreshVLMModels = () => {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries(['vlmModels', 'list'])
  }
}

export const usePrefetchVLMModel = () => {
  const queryClient = useQueryClient()

  return (configId: string, spaceId: string) => {
    queryClient.prefetchQuery(['vlmModels', 'detail', configId, spaceId], () => vlmModelService.getVLMModelConfig(configId, spaceId), {
      staleTime: 2 * 60 * 1000,
      cacheTime: 5 * 60 * 1000,
    })
  }
}
