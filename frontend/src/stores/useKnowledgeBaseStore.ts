import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  KnowledgeBase,
  CreateKnowledgeBaseRequest,
  GetKnowledgeBasesRequest,
  KnowledgeBaseItem,
  UpdateKnowledgeBaseRequest,
  SearchKnowledgeBaseRequest,
  SearchKnowledgeBaseItem,
} from '@/types/knowledgeBase'
import { KnowledgeBaseService } from '@test-agentstudio/api-client'

const KB_RECENTLY_DELETED_KEY = 'kb_recently_deleted_ids'
/** 刷新后仍能过滤已删除项：保留较长时间，避免列表合并 DS 等导致已删知识库复现 */
const KB_RECENTLY_DELETED_TTL_MS = 5 * 60 * 1000

function getRecentlyDeletedIdsFromStorage(): string[] {
  try {
    const raw = sessionStorage.getItem(KB_RECENTLY_DELETED_KEY)
    if (!raw) return []
    const { ids = [], at = 0 } = JSON.parse(raw) as { ids?: string[]; at?: number }
    if (Date.now() - at > KB_RECENTLY_DELETED_TTL_MS) {
      sessionStorage.removeItem(KB_RECENTLY_DELETED_KEY)
      return []
    }
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

function setRecentlyDeletedIdsToStorage(ids: string[]): void {
  try {
    if (ids.length === 0) return
    sessionStorage.setItem(KB_RECENTLY_DELETED_KEY, JSON.stringify({ ids, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

interface KnowledgeBaseState {
  knowledgeBases: KnowledgeBase[]
  currentKnowledgeBase: KnowledgeBase | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  selectedKnowledgeBaseIds: string[]
  isSearching: boolean
  // 分页相关
  total: number
  currentPage: number
  pageSize: number
  /** 刚删除的 kb_id 列表，下一次 fetch/search 时会从结果中过滤掉，避免列表接口延迟导致已删项复现 */
  lastDeletedKbIds: string[]
}

interface KnowledgeBaseActions {
  fetchKnowledgeBases: (spaceId?: string, page?: number, size?: number) => Promise<void>
  searchKnowledgeBases: (spaceId: string, query: string, page?: number, size?: number) => Promise<void>
  createKnowledgeBase: (data: CreateKnowledgeBaseRequest) => Promise<{ id: string }>
  updateKnowledgeBase: (data: UpdateKnowledgeBaseRequest) => Promise<void>
  deleteKnowledgeBase: (id: string, spaceId: string) => Promise<void>
  getKnowledgeBaseById: (id: string, spaceId: string) => Promise<KnowledgeBase | null>
  setCurrentKnowledgeBase: (knowledgeBase: KnowledgeBase | null) => void
  setSearchQuery: (query: string) => void
  setSelectedKnowledgeBaseIds: (ids: string[]) => void
  toggleKnowledgeBaseSelection: (id: string) => void
  selectAllKnowledgeBases: () => void
  clearSelection: () => void
  clearError: () => void
  reset: () => void
  // 分页相关actions
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

type KnowledgeBaseStore = KnowledgeBaseState & KnowledgeBaseActions

const initialState: KnowledgeBaseState = {
  knowledgeBases: [],
  currentKnowledgeBase: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedKnowledgeBaseIds: [],
  isSearching: false,
  total: 0,
  currentPage: 1,
  pageSize: 20,
  lastDeletedKbIds: [],
}

export const useKnowledgeBaseStore = create<KnowledgeBaseStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchKnowledgeBases: async (spaceId = '0', page = 1, size = 10) => {
        try {
          set({ isLoading: true, error: null })
          const request: GetKnowledgeBasesRequest = {
            space_id: spaceId,
            page: page,
            size: size,
          }
          const response = await KnowledgeBaseService.getKnowledgeBases(request)
          const fromMemory = get().lastDeletedKbIds
          const fromStorage = getRecentlyDeletedIdsFromStorage()
          const lastDeleted = fromMemory.length > 0 || fromStorage.length > 0
            ? [...new Set([...fromMemory, ...fromStorage])]
            : []

          // 转换API响应的KnowledgeBaseItem格式为前端使用的KnowledgeBase格式
          let knowledgeBases: KnowledgeBase[] = response.data.items.map((item: KnowledgeBaseItem) => ({
            id: item.id,
            name: item.name || '未命名知识库',
            description: item.desc,
            type: (item.type || 'document') as 'document' | 'web' | 'api' | 'database',
            status: 'active' as const,
            space_id: spaceId,
            embedding_model_config_id: item.embedding_model_config_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
            created_by: '',
            documentCount: 0,
            size: 0,
            ds_kb_id: item.ds_kb_id ?? undefined,
          }))
          if (lastDeleted.length > 0) {
            knowledgeBases = knowledgeBases.filter(kb => !lastDeleted.includes(kb.id))
          }

          const total =
            lastDeleted.length > 0 ? Math.max(0, response.data.total - lastDeleted.length) : response.data.total
          const totalPages = Math.max(1, Math.ceil(total / size))
          const safePage = Math.min(Math.max(1, response.data.page), totalPages)
          set({
            knowledgeBases,
            total,
            currentPage: safePage,
            pageSize: size,
            isLoading: false,
            lastDeletedKbIds: [],
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch knowledge bases'
          set({ error: errorMessage, isLoading: false })
        }
      },

      searchKnowledgeBases: async (spaceId: string, query: string, page = 1, size = 10) => {
        try {
          set({ isSearching: true, error: null })
          const request: SearchKnowledgeBaseRequest = {
            space_id: spaceId,
            query: query.trim(),
            page: page,
            page_size: size,
          }
          const response = await KnowledgeBaseService.searchKnowledgeBase(request)
          const fromMemory = get().lastDeletedKbIds
          const fromStorage = getRecentlyDeletedIdsFromStorage()
          const lastDeleted = fromMemory.length > 0 || fromStorage.length > 0
            ? [...new Set([...fromMemory, ...fromStorage])]
            : []

          // 转换搜索API响应的SearchKnowledgeBaseItem格式为前端使用的KnowledgeBase格式
          let knowledgeBases: KnowledgeBase[] = response.data.knowledge_bases.map((item: SearchKnowledgeBaseItem) => ({
            id: item.id,
            name: item.name || '未命名知识库',
            description: item.description,
            type: 'document' as const,
            status: 'active' as const,
            space_id: item.space_id,
            embedding_model_config_id: item.embedding_model_config_id,
            created_at: new Date(item.create_time * 1000).toISOString(),
            updated_at: new Date(item.update_time * 1000).toISOString(),
            created_by: '',
            documentCount: 0,
            size: 0,
          }))
          if (lastDeleted.length > 0) {
            knowledgeBases = knowledgeBases.filter(kb => !lastDeleted.includes(kb.id))
          }

          const total =
            lastDeleted.length > 0 ? Math.max(0, response.data.total - lastDeleted.length) : response.data.total
          const totalPages = Math.max(1, Math.ceil(total / size))
          const safePage = Math.min(Math.max(1, response.data.page), totalPages)
          set({
            knowledgeBases,
            total,
            currentPage: safePage,
            pageSize: size,
            isSearching: false,
            lastDeletedKbIds: lastDeleted.length > 0 ? [] : get().lastDeletedKbIds,
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to search knowledge bases'
          set({ error: errorMessage, isSearching: false })
        }
      },

      createKnowledgeBase: async (data: CreateKnowledgeBaseRequest) => {
        try {
          set({ isLoading: true, error: null })
          const response = await KnowledgeBaseService.createKnowledgeBase(data)
          set({ isLoading: false })
          return response
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create knowledge base'
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      updateKnowledgeBase: async (data: UpdateKnowledgeBaseRequest) => {
        try {
          await KnowledgeBaseService.updateKnowledgeBase(data)

          set(state => ({
            knowledgeBases: state.knowledgeBases.map(kb => (kb.id === data.kb_id ? { ...kb, name: data.name, description: data.desc, desc: data.desc } : kb)),
            currentKnowledgeBase:
              state.currentKnowledgeBase?.id === data.kb_id
                ? { ...state.currentKnowledgeBase, name: data.name, description: data.desc, desc: data.desc }
                : state.currentKnowledgeBase,
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update knowledge base'
          set({ error: errorMessage })
          throw error
        }
      },

      deleteKnowledgeBase: async (id: string, spaceId: string) => {
        try {
          set({ isLoading: true, error: null })
          const response = await KnowledgeBaseService.deleteKnowledgeBase({ space_id: spaceId, kb_id: id })
          const idsToRemove = response.data?.deleted_kb_ids?.length
            ? response.data.deleted_kb_ids
            : [id]
          setRecentlyDeletedIdsToStorage(idsToRemove)
          set(state => ({
            knowledgeBases: state.knowledgeBases.filter(kb => !idsToRemove.includes(kb.id)),
            currentKnowledgeBase: state.currentKnowledgeBase && !idsToRemove.includes(state.currentKnowledgeBase.id)
              ? state.currentKnowledgeBase
              : null,
            selectedKnowledgeBaseIds: state.selectedKnowledgeBaseIds.filter(kbId => !idsToRemove.includes(kbId)),
            isLoading: false,
            lastDeletedKbIds: idsToRemove,
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete knowledge base'
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      getKnowledgeBaseById: async (id: string, spaceId: string) => {
        try {
          set({ isLoading: true, error: null })
          const response = await KnowledgeBaseService.getKnowledgeBaseDetail({ id, space_id: spaceId })
          set({ currentKnowledgeBase: response.data, isLoading: false })
          return response.data
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch knowledge base'
          set({ error: errorMessage, isLoading: false })
          return null
        }
      },

      setCurrentKnowledgeBase: (knowledgeBase: KnowledgeBase | null) => {
        set({ currentKnowledgeBase: knowledgeBase })
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query })
      },

      setSelectedKnowledgeBaseIds: (ids: string[]) => {
        set({ selectedKnowledgeBaseIds: ids })
      },

      toggleKnowledgeBaseSelection: (id: string) => {
        set(state => ({
          selectedKnowledgeBaseIds: state.selectedKnowledgeBaseIds.includes(id)
            ? state.selectedKnowledgeBaseIds.filter(kbId => kbId !== id)
            : [...state.selectedKnowledgeBaseIds, id],
        }))
      },

      selectAllKnowledgeBases: () => {
        const { knowledgeBases } = get()
        set({ selectedKnowledgeBaseIds: knowledgeBases.map(kb => kb.id) })
      },

      clearSelection: () => {
        set({ selectedKnowledgeBaseIds: [] })
      },

      clearError: () => {
        set({ error: null })
      },

      // 分页相关actions
      setPage: (page: number) => {
        set({ currentPage: page })
      },

      setPageSize: (size: number) => {
        set({ pageSize: size })
      },

      reset: () => {
        set(initialState)
      },
    }),
    {
      name: 'knowledge-base-store',
    },
  ),
)
