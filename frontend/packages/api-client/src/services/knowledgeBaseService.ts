import { getApiClient } from '../utils/apiClientFactory'
import { API_ENDPOINTS } from '../config'
import {
  CreateKnowledgeBaseRequest,
  CreateKnowledgeBaseResponse,
  GetKnowledgeBasesRequest,
  GetKnowledgeBasesResponse,
  KnowledgeBase,
  UpdateKnowledgeBaseRequest,
  UpdateKnowledgeBaseResponse,
  DeleteKnowledgeBaseRequest,
  DeleteKnowledgeBaseResponse,
  GetKnowledgeBaseDetailRequest,
  GetKnowledgeBaseDetailResponse,
  UploadFilesRequest,
  UploadFilesResponse,
  FileSettingsRequest,
  FileSettingsResponse,
  GetDocumentsListRequest,
  GetDocumentsListResponse,
  UpdateDocumentRequest,
  UpdateDocumentResponse,
  DeleteDocumentsRequest,
  DeleteDocumentsResponse,
  ProcessDocumentsRequest,
  ProcessDocumentsResponse,
  GetDocumentStatusRequest,
  GetDocumentStatusResponse,
  SearchKnowledgeBaseRequest,
  SearchKnowledgeBaseResponse,
} from '../types/knowledgeBase'

// 知识库服务
export class KnowledgeBaseService {
  // 创建知识库 (V2 API)
  static async createKnowledgeBase(request: CreateKnowledgeBaseRequest): Promise<CreateKnowledgeBaseResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<{ code: number; message: string; data: CreateKnowledgeBaseResponse }>(API_ENDPOINTS.KNOWLEDGE_BASES.CREATE, request)
      return response.data.data
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '创建知识库失败'
      throw new Error(errorMessage)
    }
  }

  // 获取知识库列表
  static async getKnowledgeBases(request: GetKnowledgeBasesRequest): Promise<GetKnowledgeBasesResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<GetKnowledgeBasesResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.LIST, request)
      return response.data
    } catch (error) {
      console.error('获取知识库列表API调用失败:', error)
      throw new Error(`获取知识库列表失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 获取知识库详情
  static async getKnowledgeBaseDetail(request: GetKnowledgeBaseDetailRequest): Promise<GetKnowledgeBaseDetailResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<GetKnowledgeBaseDetailResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.DETAIL.replace(':id', request.id), request)
      return response.data
    } catch (error) {
      console.error('获取知识库详情API调用失败:', error)
      throw new Error(`获取知识库详情失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 更新知识库
  static async updateKnowledgeBase(request: UpdateKnowledgeBaseRequest): Promise<UpdateKnowledgeBaseResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<UpdateKnowledgeBaseResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.UPDATE, request)
      return response.data
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '更新知识库失败'
      throw new Error(errorMessage)
    }
  }

  // 获取引用知识库的智能体列表
  static async getReferencingAgents(request: { space_id: string; kb_id: string }): Promise<{ agent_names: string[]; count: number }> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<{ code: number; message: string; data: { agent_names: string[]; count: number } }>(
        API_ENDPOINTS.KNOWLEDGE_BASES.GET_REFERENCING_AGENTS,
        request
      )
      if (response.data.code === 200) {
        return response.data.data
      }
      throw new Error(response.data.message || '获取引用智能体列表失败')
    } catch (error) {
      console.error('获取引用智能体列表API调用失败:', error)
      throw new Error(`获取引用智能体列表失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 删除知识库
  static async deleteKnowledgeBase(request: DeleteKnowledgeBaseRequest): Promise<DeleteKnowledgeBaseResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<DeleteKnowledgeBaseResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.DELETE, request)
      return response.data
    } catch (error) {
      console.error('删除知识库API调用失败:', error)
      throw new Error(`删除知识库失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 上传文件
  static async uploadFiles(request: UploadFilesRequest): Promise<UploadFilesResponse> {
    try {
      const apiClient = getApiClient()
      const formData = new FormData()

      // 添加文件
      request.files.forEach(file => {
        formData.append('files', file)
      })

      // 添加其他参数
      formData.append('space_id', request.space_id)
      formData.append('kb_id', request.kb_id)
      if (request.metadata) {
        formData.append('metadata', request.metadata)
      }

      const response = await apiClient.post<UploadFilesResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.UPLOAD, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    } catch (error) {
      console.error('上传文件API调用失败:', error)
      throw new Error(`上传文件失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 设置文件参数
  static async setFileSettings(request: FileSettingsRequest): Promise<FileSettingsResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<FileSettingsResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.FILE_SETTINGS, request)
      return response.data
    } catch (error) {
      console.error('设置文件参数API调用失败:', error)
      throw new Error(`设置文件参数失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 获取文档列表
  static async getDocumentsList(request: GetDocumentsListRequest): Promise<GetDocumentsListResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<GetDocumentsListResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.DOCUMENTS_LIST, request)
      return response.data
    } catch (error) {
      console.error('获取文档列表API调用失败:', error)
      throw new Error(`获取文档列表失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 更新文档
  static async updateDocument(request: UpdateDocumentRequest): Promise<UpdateDocumentResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<UpdateDocumentResponse>('/knowledge-base/documents/update', request)
      return response.data
    } catch (error) {
      console.error('更新文档API调用失败:', error)
      throw new Error(`更新文档失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 删除文档
  static async deleteDocuments(request: DeleteDocumentsRequest): Promise<DeleteDocumentsResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<DeleteDocumentsResponse>('/knowledge-base/documents/delete', request)
      return response.data
    } catch (error) {
      console.error('删除文档API调用失败:', error)
      throw new Error(`删除文档失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 处理文档
  static async processDocuments(request: ProcessDocumentsRequest): Promise<ProcessDocumentsResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<ProcessDocumentsResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.PROCESS, request)
      return response.data
    } catch (error) {
      console.error('处理文档API调用失败:', error)
      throw new Error(`处理文档失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 查询文档状态
  static async getDocumentStatus(request: GetDocumentStatusRequest): Promise<GetDocumentStatusResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<GetDocumentStatusResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.STATUS, request)
      return response.data
    } catch (error) {
      console.error('查询文档状态API调用失败:', error)
      throw new Error(`查询文档状态失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 搜索知识库
  static async searchKnowledgeBase(request: SearchKnowledgeBaseRequest): Promise<SearchKnowledgeBaseResponse> {
    try {
      const apiClient = getApiClient()
      const response = await apiClient.post<SearchKnowledgeBaseResponse>(API_ENDPOINTS.KNOWLEDGE_BASES.SEARCH, request)
      return response.data
    } catch (error) {
      console.error('搜索知识库API调用失败:', error)
      throw new Error(`搜索知识库失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
}

// 导出知识库服务实例
export default KnowledgeBaseService

