import { useMutation, useQuery, useQueryClient } from 'react-query'
import { SelfOptService } from '../services/selfOptService'
import { CreateOptimizationJobRequest, CaseCheckRequest, SaveJobDraftRequest } from '../types/selfOptTypes'

// 创建优化任务的参数接口
interface CreateOptimizationJobParams {
  request: CreateOptimizationJobRequest
  workspaceId: string
  userId: string
}

// 刷新优化任务详情的参数接口
interface RefreshJobDetailParams {
  jobId: string
  workspaceId: string
  userId: string
}

// 自优化相关的React Query hooks

// 获取优化任务列表
export const useOptimizationJobList = (idList?: string[], workspaceId?: string, userId?: string) => {
  return useQuery(['selfOpt', 'jobList', idList, workspaceId, userId], () => SelfOptService.getJobList(idList || ['*'], workspaceId!, userId!), {
    enabled: !!(workspaceId && userId), // 只有当workspaceId和userId都存在时才执行查询
    staleTime: 1 * 60 * 1000, // 1分钟内不重新获取
    cacheTime: 5 * 60 * 1000, // 缓存5分钟
    retry: 2,
    retryDelay: 1000,
    onError: (error: any) => {
      console.error('获取优化任务列表失败:', error)
    },
  })
}

// 获取优化任务详情
export const useOptimizationJobDetail = (jobId?: string, workspaceId?: string, userId?: string) => {
  return useQuery(['selfOpt', 'jobDetail', jobId, workspaceId, userId], () => SelfOptService.getJobDetail(jobId!, workspaceId!, userId!), {
    enabled: !!(jobId && workspaceId && userId), // 只有当所有参数都存在时才执行查询
    staleTime: 30 * 1000, // 30秒内不重新获取
    cacheTime: 5 * 60 * 1000, // 缓存5分钟
    retry: 2,
    retryDelay: 1000,
    onError: (error: any) => {
      console.error('获取优化任务详情失败:', error)
    },
  })
}

// 创建优化任务
export const useCreateOptimizationJob = () => {
  const queryClient = useQueryClient()

  return useMutation(({ request, workspaceId, userId }: CreateOptimizationJobParams) => SelfOptService.createOptimizationJob(request, workspaceId, userId), {
    onSuccess: (response: any) => {
      if (response.code === 200 || response.code === 0) {
        // 创建成功后，使任务列表缓存失效，触发重新获取
        queryClient.invalidateQueries(['selfOpt', 'jobList'])
        console.log('优化任务创建成功')
      }
    },
    onError: (error: any) => {
      console.error('创建优化任务失败:', error)
    },
  })
}

// 删除优化任务
export const useDeleteOptimizationJob = () => {
  const queryClient = useQueryClient()

  return useMutation(
    ({ jobId, workspaceId, userId, jobType = 'formal' }: { jobId: string; workspaceId: string; userId: string; jobType?: 'formal' | 'draft' }) =>
      SelfOptService.deleteJob(jobId, workspaceId, userId, jobType),
    {
      onSuccess: (response: any, { jobId }: { jobId: string }) => {
        if (response.code === 200 || response.code === 0) {
          // 删除成功后，使任务列表和详情缓存失效，触发重新获取
          queryClient.invalidateQueries(['selfOpt', 'jobList'])
          queryClient.invalidateQueries(['selfOpt', 'jobDetail', jobId])
          console.log('优化任务删除成功')
        }
      },
      onError: (error: any) => {
        console.error('删除优化任务失败:', error)
      },
    },
  )
}

// 检查用例数据格式
export const useCheckCaseData = () => {
  return useMutation((request: CaseCheckRequest) => SelfOptService.checkCaseData(request), {
    onSuccess: (response: any) => {
      if (response.code === 200 || response.code === 0) {
        console.log('用例数据检查成功')
      }
    },
    onError: (error: any) => {
      console.error('用例数据检查失败:', error)
    },
  })
}

// 刷新优化任务列表
export const useRefreshOptimizationJobList = () => {
  const queryClient = useQueryClient()

  return useMutation(
    ({ idList, workspaceId, userId }: { idList?: string[]; workspaceId: string; userId: string }) =>
      SelfOptService.getJobList(idList || ['*'], workspaceId, userId),
    {
      onSuccess: (response: any, { idList, workspaceId, userId }) => {
        // 刷新成功后，更新缓存
        queryClient.setQueryData(['selfOpt', 'jobList', idList, workspaceId, userId], response)
        console.log('优化任务列表刷新成功')
      },
      onError: (error: any) => {
        console.error('刷新优化任务列表失败:', error)
      },
    },
  )
}

// 刷新优化任务详情
export const useRefreshOptimizationJobDetail = () => {
  const queryClient = useQueryClient()

  return useMutation(({ jobId, workspaceId, userId }: RefreshJobDetailParams) => SelfOptService.getJobDetail(jobId, workspaceId, userId), {
    onSuccess: (_response: any, { jobId, workspaceId, userId }: RefreshJobDetailParams) => {
      // 刷新成功后，更新缓存
      queryClient.invalidateQueries(['selfOpt', 'jobDetail', jobId, workspaceId, userId])
      console.log('优化任务详情刷新成功')
    },
    onError: (error: any) => {
      console.error('刷新优化任务详情失败:', error)
    },
  })
}

// 保存优化任务草稿
export const useSaveJobDraft = () => {
  return useMutation(
    ({ data, workspaceId, userId, draftId }: { data: SaveJobDraftRequest; workspaceId: string; userId: string; draftId?: number }) =>
      SelfOptService.saveJobDraft(data, workspaceId, userId, draftId),
    {
      onSuccess: (response: any) => {
        if (response.code === 200 || response.code === 0) {
          console.log('优化任务草稿保存成功')
        }
      },
      onError: (error: any) => {
        console.error('保存优化任务草稿失败:', error)
      },
    },
  )
}

// 获取草稿详情
export const useJobDraftDetail = (draftId?: number, workspaceId?: string, userId?: string) => {
  return useQuery(
    ['selfOpt', 'draftDetail', draftId, workspaceId, userId],
    async () => {
      const response = await SelfOptService.getJobDraft(draftId!, workspaceId!, userId!)
      return response
    },
    {
      enabled: !!(draftId && workspaceId && userId), // 只有当所有参数都存在时才执行查询
      staleTime: 30 * 1000, // 30秒内不重新获取
      cacheTime: 5 * 60 * 1000, // 缓存5分钟
      retry: 2,
      retryDelay: 1000,
      onError: (error: any) => {
        console.error('获取草稿详情失败:', error)
      },
    },
  )
}
