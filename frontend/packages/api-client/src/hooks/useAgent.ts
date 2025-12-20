import { useMutation, useQuery, useQueryClient } from 'react-query'
import AgentService from '../services/agentService'
import {
  AgentListRequest,
  CreateAgentRequest,
  AgentDetailRequest,
  UpdateAgentRequest,
  UpdateAgentResponse,
  CopyAgentRequest,
  AgentSearchRequest,
  SaveAgentRequest,
  SaveAgentResponse,
} from '../types'

// 智能体相关的React Query hooks

// 从API获取智能体列表
export const useAgents = (request: AgentListRequest) => {
  return useQuery(['agents', 'api', 'list', request], () => AgentService.getAgents(request), {
    enabled: !!request.space_id, // 只有当space_id存在时才执行查询

    // 🎯 优化缓存策略，与工作流缓存保持一致
    staleTime: 30 * 1000, // 30秒内数据视为新鲜
    cacheTime: 5 * 60 * 1000, // 缓存5分钟

    // 🎯 添加自动刷新机制
    refetchOnMount: true, // 组件挂载时重新获取数据
    refetchOnWindowFocus: true, // 窗口重新聚焦时重新获取数据
    refetchOnReconnect: true, // 网络重连时重新获取数据

    retry: 2,
    retryDelay: 1000,

    onError: error => {
      console.error('从API获取智能体列表失败:', error)
    },

    // 🎯 成功回调，用于调试
    onSuccess: data => {
      console.log(`成功获取 space_id ${request.space_id} 的智能体列表，共 ${data.data?.agent_items?.length || 0} 个智能体`)
    },
  })
}

// 刷新智能体列表
export const useRefreshAgents = () => {
  const queryClient = useQueryClient()

  return useMutation((request: AgentListRequest) => AgentService.getAgents(request), {
    onSuccess: (response, variables) => {
      if (response.code === 200) {
        // 刷新成功后，更新缓存
        queryClient.setQueryData(['agents', 'api', 'list', variables], response)
        console.log('智能体列表刷新成功')
      }
    },
    onError: error => {
      console.error('刷新智能体列表失败:', error)
    },
  })
}

// 创建智能体
export const useCreateAgent = () => {
  const queryClient = useQueryClient()

  return useMutation((request: CreateAgentRequest) => AgentService.createAgent(request), {
    onSuccess: (response, variables) => {
      if (response.code === 200 || response.code === 0) {
        // 创建成功后，使智能体列表缓存失效，触发重新获取
        queryClient.invalidateQueries(['agents', 'api', 'list'], { predicate: query => query.queryKey[3]?.space_id === variables.space_id })
        console.log('智能体创建成功')
      }
    },
    onError: error => {
      console.error('创建智能体失败:', error)
    },
  })
}

// 获取智能体详情
export const useAgentDetail = (request: AgentDetailRequest) => {
  return useQuery(['agents', 'detail', request.agent_id, request.space_id, request.version], () => AgentService.getAgentDetail(request), {
    enabled: !!request.agent_id && !!request.space_id, // 只有当bot_id和space_id都存在时才执行查询
    staleTime: 0, // 可设置缓存时间，时间内不调接口获取最新数据
    cacheTime: 0, // 不缓存
    retry: 2,
    retryDelay: 1000,
    onError: error => {
      console.error('获取智能体详情失败:', error)
    },
  })
}

// 刷新智能体详情
export const useRefreshAgentDetail = () => {
  const queryClient = useQueryClient()

  return useMutation((request: AgentDetailRequest) => AgentService.getAgentDetail(request), {
    onSuccess: (response, variables) => {
      if (response.code === 200) {
        // 刷新成功后，更新缓存
        queryClient.invalidateQueries(['agents', 'detail', variables.agent_id, variables.space_id, variables.version])
        console.log('智能体详情刷新成功')
      }
    },
    onError: error => {
      console.error('刷新智能体详情失败:', error)
    },
  })
}

// 更新智能体
export const useUpdateAgent = () => {
  const queryClient = useQueryClient()

  return useMutation((request: UpdateAgentRequest) => AgentService.updateAgent(request), {
    onSuccess: (response: UpdateAgentResponse, variables) => {
      if (response.code === 200 || response.code === 0) {
        // 更新成功后，使智能体列表缓存失效，触发重新获取
        queryClient.invalidateQueries(['agents', 'api', 'list'], { predicate: query => query.queryKey[3]?.space_id === variables.space_id })
        console.log('智能体更新成功')
      }
    },
    onError: error => {
      console.error('更新智能体失败:', error)
    },
  })
}

// 保存智能体
export const useSaveAgent = () => {
  const queryClient = useQueryClient()

  return useMutation((request: SaveAgentRequest) => AgentService.saveAgent(request), {
    onSuccess: (response: SaveAgentResponse, variables) => {
      if (response.code === 200 || response.code === 0) {
        // 保存成功后，使智能体详情缓存失效，触发重新获取
        queryClient.invalidateQueries(['agents', 'detail', variables.agent_id, variables.space_id, variables.agent_version])

        // 同时使智能体列表缓存失效
        queryClient.invalidateQueries(['agents', 'api', 'list'], { predicate: query => query.queryKey[3]?.space_id === variables.space_id })

        console.log(`智能体保存成功 - ID: ${variables.agent_id}, Version: ${variables.agent_version || 'latest'}, Space: ${variables.space_id}`)
      }
    },
    onError: error => {
      console.error('保存智能体失败:', error)
    },
  })
}

// 复制智能体
export const useCopyAgent = () => {
  const queryClient = useQueryClient()

  return useMutation((request: CopyAgentRequest) => AgentService.copyAgent(request), {
    onSuccess: (response, variables) => {
      if (response.code === 200) {
        // 复制成功后，使智能体列表缓存失效，触发重新获取
        queryClient.invalidateQueries(['agents', 'api', 'list'], { predicate: query => query.queryKey[3]?.space_id === variables.space_id })
        console.log('智能体复制成功')
      }
    },
    onError: error => {
      console.error('复制智能体失败:', error)
    },
  })
}

// 搜索智能体
export const useSearchAgents = (request: AgentSearchRequest, options?: { enabled?: boolean }) => {
  return useQuery(['agents', 'search', request], () => AgentService.searchAgents(request), {
    enabled: options?.enabled !== false && !!request.space_id && (request.search_term?.trim() !== '' || request.status_filter !== 'all'), // 只有当enabled为true且space_id存在且有搜索词时才执行查询

    // 🎯 优化的缓存策略 - 搜索结果缓存时间稍短，确保数据新鲜度
    staleTime: 15 * 1000, // 15秒内数据视为新鲜
    cacheTime: 3 * 60 * 1000, // 缓存3分钟

    // 🎯 搜索优化的自动刷新机制
    refetchOnMount: false, // 搜索结果不自动刷新，减少不必要的请求
    refetchOnWindowFocus: false, // 窗口聚焦时不刷新搜索结果
    refetchOnReconnect: true, // 仅在网络重连时刷新

    // 🎯 搜索特定的重试策略
    retry: 1, // 搜索只重试1次，避免用户等待过久
    retryDelay: 1000,

    // 🎯 搜索错误处理
    onError: error => {
      console.error('搜索智能体失败:', error)
    },

    onSuccess: data => {
      console.log(`成功搜索智能体，共 ${data.data?.agent_items?.length || 0} 个结果`)
    },
  })
}

export default {
  useAgents,
  useRefreshAgents,
  useCreateAgent,
  useAgentDetail,
  useRefreshAgentDetail,
  useUpdateAgent,
  useSaveAgent,
  useCopyAgent,
  useSearchAgents,
}
