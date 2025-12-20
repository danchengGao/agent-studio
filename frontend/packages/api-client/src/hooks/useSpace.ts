import { useQuery, useMutation, useQueryClient } from 'react-query'
import SpaceService from '../services/spaceService'
import type { Space } from '../services/spaceService'

// 检查是否有token
const hasToken = (): boolean => {
  if (typeof window === 'undefined') return false
  const token = localStorage.getItem('access_token')
  return !!token
}

// 获取用户空间列表的hook
export const useUserSpaces = (options?: { enabled?: boolean }) => {
  return useQuery(['spaces', 'user'], () => SpaceService.getUserSpaces(), {
    enabled: options?.enabled ?? true, // 默认启用，可通过配置禁用
    staleTime: 5 * 60 * 1000, // 5分钟内不重新获取
    cacheTime: 10 * 60 * 1000, // 缓存10分钟
    retry: 2,
    retryDelay: 1000,
    onError: error => {
      console.error('获取用户空间列表失败:', error)
    },
  })
}

// 获取指定空间详情的hook
export const useSpaceById = (spaceId: string) => {
  return useQuery(['spaces', spaceId], () => SpaceService.getSpaceById(spaceId), {
    enabled: !!spaceId, // 只有当spaceId存在时才执行查询
    staleTime: 5 * 60 * 1000, // 5分钟内不重新获取
    cacheTime: 10 * 60 * 1000, // 缓存10分钟
    retry: 2,
    retryDelay: 1000,
    onError: error => {
      console.error(`获取空间ID为${spaceId}的详情失败:`, error)
    },
  })
}

// 获取当前用户的空间列表的hook
export const useUserSpecificSpaces = () => {
  return useQuery(['spaces', 'user-specific'], () => SpaceService.getUserSpecificSpaces(), {
    staleTime: 5 * 60 * 1000, // 5分钟内不重新获取
    cacheTime: 10 * 60 * 1000, // 缓存10分钟
    retry: 2,
    retryDelay: 1000,
    onError: error => {
      console.error('获取当前用户的空间列表失败:', error)
    },
  })
}

// 创建空间
export const useCreateSpace = () => {
  const queryClient = useQueryClient()

  return useMutation((spaceData: Partial<Space>) => SpaceService.createSpace(spaceData), {
    onSuccess: response => {
      if (response.success) {
        // 创建成功后，使空间列表缓存失效
        queryClient.invalidateQueries(['spaces', 'user'])
        queryClient.invalidateQueries(['spaces', 'user-specific'])
        console.log('空间创建成功')
      }
    },
    onError: error => {
      console.error('创建空间失败:', error)
    },
  })
}

// 更新空间
export const useUpdateSpace = () => {
  const queryClient = useQueryClient()

  return useMutation(({ spaceId, spaceData }: { spaceId: string; spaceData: Partial<Space> }) => SpaceService.updateSpace(spaceId, spaceData), {
    onSuccess: (response, variables) => {
      if (response.success) {
        // 更新成功后，更新缓存
        queryClient.setQueryData(['spaces', variables.spaceId], response)
        queryClient.invalidateQueries(['spaces', 'user'])
        queryClient.invalidateQueries(['spaces', 'user-specific'])
        console.log('空间更新成功')
      }
    },
    onError: error => {
      console.error('更新空间失败:', error)
    },
  })
}

// 删除空间
export const useDeleteSpace = () => {
  const queryClient = useQueryClient()

  return useMutation((spaceId: string) => SpaceService.deleteSpace(spaceId), {
    onSuccess: (_, spaceId) => {
      // 删除成功后，从缓存中移除
      queryClient.removeQueries(['spaces', spaceId])
      queryClient.invalidateQueries(['spaces', 'user'])
      queryClient.invalidateQueries(['spaces', 'user-specific'])
      console.debug('空间删除成功')
    },
    onError: error => {
      console.error('删除空间失败:', error)
    },
  })
}
