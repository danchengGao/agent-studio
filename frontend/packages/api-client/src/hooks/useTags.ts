import { useMutation, useQuery, useQueryClient } from 'react-query'
import TagService from '../services/tagService'
import WorkflowService from '../services/workflowService'
import type {
  Tag,
  TagCreate,
  TagUpdate,
  TagResponse,
  TagListResponse,
  TagGetOrCreateResponse,
  TagBatchCreateResponse,
  TagCreateRequest,
  TagUpdateRequest,
  TagGetOrCreateRequest,
  TagBatchCreateRequest,
  TagSearchRequest,
  TagListRequest,
  WorkflowTagRequest,
  WorkflowTagResponse,
  TagApiResponse,
} from '../types/tagTypes'
import type { UpdateWorkflowRequest, WorkflowUpdateResponse } from '../types'

// 获取Tag列表
export const useTags = (request: TagListRequest) => {
  return useQuery(['tags', 'list', request.space_id, request.is_active, request.page, request.page_size], () => TagService.getTags(request), {
    enabled: !!request.space_id,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    cacheTime: 10 * 60 * 1000, // 10分钟缓存
    onError: error => {
      console.error('获取Tag列表失败:', error)
    },
  })
}

// 搜索Tag
export const useSearchTags = (request: TagSearchRequest, enabled = false) => {
  return useQuery(['tags', 'search', request.space_id, request.search_pattern], () => TagService.searchTags(request), {
    enabled: enabled && !!request.space_id && !!request.search_pattern,
    staleTime: 1 * 60 * 1000, // 1分钟缓存
    cacheTime: 5 * 60 * 1000, // 5分钟缓存
    onError: error => {
      console.error('搜索Tag失败:', error)
    },
  })
}

// 创建Tag
export const useCreateTag = () => {
  const queryClient = useQueryClient()

  return useMutation((request: TagCreateRequest) => TagService.createTag(request), {
    onSuccess: (response, variables) => {
      if (response.code === 200) {
        // 创建成功后，使Tag列表缓存失效
        queryClient.invalidateQueries(['tags', 'list', variables.tag.space_id])
        console.log('Tag创建成功')
      }
    },
    onError: error => {
      console.error('创建Tag失败:', error)
    },
  })
}

// 批量创建Tag
export const useBatchCreateTags = () => {
  const queryClient = useQueryClient()

  return useMutation((request: TagBatchCreateRequest) => TagService.batchCreateTags(request), {
    onSuccess: (response, variables) => {
      if (response.code === 200 && variables.tags.length > 0) {
        // 创建成功后，使Tag列表缓存失效
        const spaceId = variables.tags[0].space_id
        queryClient.invalidateQueries(['tags', 'list', spaceId])
        console.log('批量创建Tag成功')
      }
    },
    onError: error => {
      console.error('批量创建Tag失败:', error)
    },
  })
}

// 获取或创建Tag
export const useGetOrCreateTag = () => {
  const queryClient = useQueryClient()

  return useMutation((request: TagGetOrCreateRequest) => TagService.getOrCreateTag(request), {
    onSuccess: (response, variables) => {
      if (response.code === 200) {
        // 创建成功后，使Tag列表缓存失效
        queryClient.invalidateQueries(['tags', 'list', variables.space_id])
        console.log('获取或创建Tag成功')
      }
    },
    onError: error => {
      console.error('获取或创建Tag失败:', error)
    },
  })
}

// 更新Tag
export const useUpdateTag = () => {
  const queryClient = useQueryClient()

  return useMutation(({ tagId, request }: { tagId: number; request: TagUpdateRequest }) => TagService.updateTag(tagId, request), {
    onSuccess: (response, variables) => {
      if (response.code === 200) {
        // 更新成功后，使Tag列表缓存失效
        queryClient.invalidateQueries(['tags', 'list'])
        console.log('Tag更新成功')
      }
    },
    onError: error => {
      console.error('更新Tag失败:', error)
    },
  })
}

// 删除Tag
export const useDeleteTag = () => {
  const queryClient = useQueryClient()

  return useMutation(({ spaceId, tagName }: { spaceId: string; tagName: string }) => TagService.deleteTag(spaceId, tagName), {
    onSuccess: (response, variables) => {
      if (response.code === 200) {
        // 删除成功后，使Tag列表缓存失效
        queryClient.invalidateQueries(['tags', 'list', variables.spaceId])
        console.log('Tag删除成功')
      }
    },
    onError: error => {
      console.error('删除Tag失败:', error)
    },
  })
}

// 获取工作流的Tags
export const useWorkflowTags = (workflowId: string, spaceId: string, enabled = false) => {
  return useQuery(['workflow', 'tags', workflowId, spaceId], () => TagService.getWorkflowTags(workflowId, spaceId), {
    enabled: enabled && !!workflowId && !!spaceId,
    staleTime: 3 * 60 * 1000, // 3分钟缓存
    cacheTime: 5 * 60 * 1000, // 5分钟缓存
    onError: error => {
      console.error('获取工作流Tags失败:', error)
    },
  })
}

// 更新工作流的Tags - 使用workflow update接口
export const useUpdateWorkflowTags = () => {
  const queryClient = useQueryClient()

  return useMutation(
    ({ workflowId, tagNames, spaceId }: { workflowId: string; tagNames: string[]; spaceId: string }) => {
      const updateRequest: UpdateWorkflowRequest = {
        workflow_id: workflowId,
        space_id: spaceId,
        tags: tagNames,
      }
      return WorkflowService.updateWorkflow(updateRequest)
    },
    {
      onSuccess: (response: WorkflowUpdateResponse, variables) => {
        if (response.code === 200) {
          // 更新成功后，使相关工作流缓存失效
          queryClient.invalidateQueries(['workflow', 'tags', variables.workflowId])
          queryClient.invalidateQueries(['workflows', 'api', 'list', variables.spaceId])
          console.log('工作流Tags更新成功')
        }
      },
      onError: error => {
        console.error('更新工作流Tags失败:', error)
      },
    },
  )
}

// 为工作流添加Tags
export const useAddTagsToWorkflow = () => {
  const queryClient = useQueryClient()

  return useMutation(({ workflowId, request }: { workflowId: string; request: WorkflowTagRequest }) => TagService.addTagsToWorkflow(workflowId, request), {
    onSuccess: (response, variables) => {
      if (response.code === 200) {
        // 添加成功后，使相关工作流缓存失效
        queryClient.invalidateQueries(['workflow', 'tags', variables.workflowId])
        queryClient.invalidateQueries(['workflows', 'api', 'list', variables.request.space_id])
        console.log('工作流Tags添加成功')
      }
    },
    onError: error => {
      console.error('为工作流添加Tags失败:', error)
    },
  })
}

// 从工作流移除Tags
export const useRemoveTagsFromWorkflow = () => {
  const queryClient = useQueryClient()

  return useMutation(
    ({ workflowId, spaceId, tagIds }: { workflowId: string; spaceId: string; tagIds: number[] }) =>
      TagService.removeTagsFromWorkflow(workflowId, spaceId, tagIds),
    {
      onSuccess: (response, variables) => {
        if (response.code === 200) {
          // 移除成功后，使相关工作流缓存失效
          queryClient.invalidateQueries(['workflow', 'tags', variables.workflowId])
          queryClient.invalidateQueries(['workflows', 'api', 'list', variables.spaceId])
          console.log('工作流Tags移除成功')
        }
      },
      onError: error => {
        console.error('从工作流移除Tags失败:', error)
      },
    },
  )
}

export default {
  useTags,
  useSearchTags,
  useCreateTag,
  useBatchCreateTags,
  useGetOrCreateTag,
  useUpdateTag,
  useDeleteTag,
  useWorkflowTags,
  useUpdateWorkflowTags,
  useAddTagsToWorkflow,
  useRemoveTagsFromWorkflow,
}
