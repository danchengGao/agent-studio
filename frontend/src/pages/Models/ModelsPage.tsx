import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useTranslation } from 'react-i18next'
import { Plus, Settings, Trash2, Play, CheckCircle, Search, XCircle, Loader2, ChevronLeft, ChevronRight, RefreshCw, Package } from 'lucide-react'
import {
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Typography,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
  Box,
} from '@mui/material'
import { useModels, useCreateModel, useUpdateModel, useDeleteModel, useToggleModelStatus, useTestModel } from '@test-agentstudio/api-client'
import type { FrontendModelConfig } from '@test-agentstudio/api-client'
import { ModelProvider } from '@test-agentstudio/api-client'
import DeleteConfirmationDialog from '../../components/Common/DeleteConfirmationDialog'

// 使用FrontendModelConfig作为ModelConfig的类型别名
type ModelConfig = FrontendModelConfig

const initialModelConfig: Partial<ModelConfig> = {
  name: '',
  provider: ModelProvider.OPENAI,
  modelId: '',
  apiKey: '',
  baseUrl: '',
  isActive: true,
  maxTokens: 4000,
  temperature: 0.7,
  topp: 0.9,
  timeout: 60,
  retryCount: 3,
  enableStreaming: true,
  enableFunctionCalling: true,
  tags: [],
  description: '',
}

const ModelsPage: React.FC = () => {
  const { t } = useTranslation()
  // 使用 hooks 管理模型数据
  const { user } = useAuthStore()

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

  // 获取模型数据 - 为了支持全量搜索，获取最大量数据
  const {
    data: modelsResponse,
    isLoading,
    error,
    refetch,
  } = useModels({
    spaceId: user?.spaceId,
    page: 1,
    size: 100, // 获取最大量数据用于前端筛选
    sort_by: 'update_time',
    sort_order: 'desc',
  })

  // 当API返回为空时显示空列表
  const displayModels = modelsResponse?.items || []
  const totalItems = modelsResponse?.total || 0
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0

  const [showModelDialog, setShowModelDialog] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProvider, setFilterProvider] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // 筛选结果的分页状态
  const [filteredPage, setFilteredPage] = useState(1)
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    modelId: string
    modelName: string
  }>({
    isOpen: false,
    modelId: '',
    modelName: '',
  })

  // New model form state
  const [newModel, setNewModel] = useState<Partial<ModelConfig>>(initialModelConfig)

  // Test state
  const [testPrompt, setTestPrompt] = useState('')
  const [testResult, setTestResult] = useState('')
  const [isTesting, setIsTesting] = useState(false)

  // Tag input state
  const [newTag, setNewTag] = useState('')

  // URL validation state
  const [baseUrlError, setBaseUrlError] = useState('')

  // Form submission attempt state
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // 表单验证状态
  const isFormValid = () => {
    const timeout = newModel.timeout
    return (
      newModel.name?.trim() && // 模型名称必填
      newModel.modelId?.trim() && // 模型ID必填
      newModel.apiKey?.trim() && // API密钥必填
      newModel.baseUrl?.trim() && // 基础URL必填
      newModel.description?.trim() && // 描述必填
      !baseUrlError && // 基础URL格式正确
      (newModel.name?.length || 0) <= 100 && // 名称不超过100字符
      (newModel.modelId?.length || 0) <= 100 && // 模型ID不超过100字符
      (newModel.description?.length || 0) <= 500 && // 描述不超过500字符
      (newModel.tags?.length || 0) <= 10 && // 标签最多10个
      timeout !== undefined &&
      timeout >= 1 &&
      timeout <= 300 // 超时时间范围验证
    )
  }

  const handleOpenModelDialog = (model: ModelConfig | null) => {
    setSubmitAttempted(false) // 重置提交尝试状态
    if (model) {
      // Edit mode
      setEditMode(true)
      setSelectedModel(model)
      setNewModel(model)
    } else {
      // Add mode
      setEditMode(false)
      setSelectedModel(null)
      setNewModel(initialModelConfig)
    }
    setShowModelDialog(true)
  }

  // URL validation function
  const validateBaseUrl = (url: string): boolean => {
    if (!url.trim()) {
      setBaseUrlError('')
      return true // Empty URL is allowed
    }

    const urlPattern = /^https?:\/\//i
    if (!urlPattern.test(url)) {
      setBaseUrlError(t('models.modelConfig.parameters.endpointError'))
      return false
    }

    setBaseUrlError('')
    return true
  }

  // 使用 hooks 进行数据操作
  const createModelMutation = useCreateModel()
  const updateModelMutation = useUpdateModel()
  const deleteModelMutation = useDeleteModel()
  const toggleStatusMutation = useToggleModelStatus()
  const testModelMutation = useTestModel()

  // 筛选状态检查
  const hasFilters = searchTerm || filterProvider !== 'all' || filterStatus !== 'all'

  const filteredModels = displayModels
    .filter(model => {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        model.name.toLowerCase().includes(searchLower) ||
        model.provider.toLowerCase().includes(searchLower) ||
        model.modelId.toLowerCase().includes(searchLower) ||
        (model.tags && model.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      const matchesProvider = filterProvider === 'all' || model.provider === filterProvider
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && model.isActive) || (filterStatus === 'inactive' && !model.isActive)

      return matchesSearch && matchesProvider && matchesStatus
    })
    .sort((a, b) => {
      // 按更新时间降序排序，最新创建/更新的排在最前面
      const dateA = new Date(a.updatedAt).getTime()
      const dateB = new Date(b.updatedAt).getTime()
      return dateB - dateA
    })

  // 筛选结果的分页计算
  const filteredTotalItems = filteredModels.length
  const filteredTotalPages = pageSize > 0 ? Math.ceil(filteredTotalItems / pageSize) : 0

  // 非筛选状态下的前端分页
  const paginatedDisplayModels = displayModels.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 筛选状态下的前端分页
  const paginatedFilteredModels = filteredModels.slice((filteredPage - 1) * pageSize, filteredPage * pageSize)

  // 监听筛选条件变化，重置筛选分页
  useEffect(() => {
    setFilteredPage(1)
  }, [searchTerm, filterProvider, filterStatus])

  // 确定最终显示的模型数据
  const finalModels = hasFilters ? paginatedFilteredModels : paginatedDisplayModels
  const finalTotalItems = hasFilters ? filteredTotalItems : totalItems
  const finalTotalPages = hasFilters ? filteredTotalPages : totalPages
  const finalCurrentPage = hasFilters ? filteredPage : currentPage

  const handleSave = async () => {
    // 设置提交尝试状态
    setSubmitAttempted(true)

    // 验证名称长度
    if ((newModel.name || '').length > 100) {
      setSnackbar({ open: true, message: '模型名称不能超过100个字符', severity: 'error' })
      return
    }

    // 验证模型ID长度
    if ((newModel.modelId || '').length > 100) {
      setSnackbar({ open: true, message: '模型ID不能超过100个字符', severity: 'error' })
      return
    }

    // 验证描述长度
    if ((newModel.description || '').length > 500) {
      setSnackbar({ open: true, message: '描述不能超过500个字符', severity: 'error' })
      return
    }

    // 验证超时时间范围
    const timeout = newModel.timeout
    if (timeout === undefined || timeout < 1 || timeout > 300) {
      setSnackbar({ open: true, message: '超时时间必须在1-300秒之间', severity: 'error' })
      return
    }

    // 验证必填字段
    if (!isFormValid()) {
      setSnackbar({ open: true, message: '请填写所有必填字段', severity: 'error' })
      return
    }

    if (editMode) {
      // Handle edit logic
      if (selectedModel) {
        try {
          await updateModelMutation.mutateAsync({ id: selectedModel.id, model: newModel as ModelConfig, spaceId: user?.spaceId || '' })
          setShowModelDialog(false)
          setCurrentPage(1) // 重置到第一页
          // 刷新数据以更新统计信息
          refetch()
          setSnackbar({ open: true, message: t('models.messages.updateSuccess'), severity: 'success' })
        } catch (error) {
          let errorMessage = error.error || t('models.messages.updateFailed')

          // 尝试多种访问路径来获取detail数据
          let detailData = null

          // 路径1: error?.response?.data?.detail
          if (error?.response?.data?.detail) {
            detailData = error.response.data.detail
          }
          // 路径2: error?.response?.data // 检查data是否直接包含detail
          else if (error?.response?.data && Object.keys(error.response.data).includes('detail')) {
            detailData = error.response.data.detail
          }
          // 路径3: error?.data // 检查error是否直接包含data
          else if (error?.data?.detail) {
            detailData = error.data.detail
          }
          // 路径4: 检查error本身是否有detail属性
          else if ((error as any)?.detail) {
            detailData = (error as any).detail
          }

          // 解析后端详细错误信息
          if (detailData) {
            const detail = detailData

            if (Array.isArray(detail)) {
              // 处理字段验证错误数组
              const fieldErrors = detail.map((errorDetail: any) => {
                let errorInfo = ''

                if (errorDetail.loc && errorDetail.loc.length > 1) {
                  // 当loc数组有第二个元素时，显示这个元素
                  const fieldName = errorDetail.loc[1]
                  const fieldMap: Record<string, string> = {
                    name: '模型名称',
                    modelId: '模型ID',
                    apiKey: 'API密钥',
                    provider: 'API协议',
                    baseUrl: '基础服务地址',
                    description: '描述',
                  }
                  const displayName = fieldMap[fieldName] || fieldName

                  // 根据错误类型生成友好的提示信息
                  let friendlyMessage = ''
                  if (errorDetail.msg?.includes('at least 1 character')) {
                    friendlyMessage = '最少需要1个字符'
                  } else if (errorDetail.msg?.includes('at most') && errorDetail.msg?.includes('characters')) {
                    const match = errorDetail.msg.match(/at most (\d+) characters/)
                    const maxLength = match ? match[1] : '限制'
                    friendlyMessage = `最多${maxLength}个字符`
                  } else if (errorDetail.msg?.includes('required') || errorDetail.msg?.includes('field required')) {
                    friendlyMessage = '此字段为必填项'
                  } else if (errorDetail.msg?.includes('valid') && errorDetail.msg?.includes('url')) {
                    friendlyMessage = '请输入有效的URL地址'
                  } else if (errorDetail.msg?.includes('valid email')) {
                    friendlyMessage = '请输入有效的邮箱地址'
                  } else if (errorDetail.msg?.includes('already exists')) {
                    friendlyMessage = '该值已存在'
                  } else if (errorDetail.msg?.includes('invalid')) {
                    friendlyMessage = '格式无效'
                  } else {
                    friendlyMessage = errorDetail.msg || '格式不正确'
                  }

                  errorInfo = `${displayName}${friendlyMessage}`
                } else {
                  // 没有loc第二个元素时，显示msg
                  errorInfo = errorDetail.msg || '格式错误'
                }

                return errorInfo
              })
              errorMessage = fieldErrors.join('; ')
            } else if (typeof detail === 'string') {
              // 处理简单的字符串错误
              errorMessage = detail
            }
          } else if (error?.response?.data?.message) {
            errorMessage = error.response.data.message
          } else if (error?.message) {
            errorMessage = error.message
          }

          setSnackbar({
            open: true,
            message: errorMessage,
            severity: 'error',
          })
        }
      }
    } else {
      // Handle add logic
      if (!validateBaseUrl(newModel.baseUrl || '')) {
        setSnackbar({ open: true, message: t('models.messages.invalidBaseUrl'), severity: 'error' })
        return
      }

      try {
        const model: ModelConfig = {
          id: Date.now().toString(),
          ...newModel,
          maxTokens: newModel.maxTokens || 4000,
          timeout: newModel.timeout || 60,
          usage: {
            totalRequests: 0,
            totalTokens: 0,
            successRate: 100,
            averageResponseTime: 0,
            lastUsed: '-',
          },
        } as ModelConfig

        await createModelMutation.mutateAsync({ model, spaceId: user?.spaceId || '' })
        setShowModelDialog(false)
        setCurrentPage(1) // 重置到第一页
        // 刷新数据以更新统计信息
        refetch()
        setSnackbar({ open: true, message: t('models.messages.addSuccess'), severity: 'success' })
      } catch (error) {
        let errorMessage = error.error || t('models.messages.addFailed')

        // 尝试多种访问路径来获取detail数据
        let detailData = null

        // 路径1: error?.response?.data?.detail
        if (error?.response?.data?.detail) {
          detailData = error.response.data.detail
        }
        // 路径2: error?.response?.data // 检查data是否直接包含detail
        else if (error?.response?.data && Object.keys(error.response.data).includes('detail')) {
          detailData = error.response.data.detail
        }
        // 路径3: error?.data // 检查error是否直接包含data
        else if (error?.data?.detail) {
          detailData = error.data.detail
        }
        // 路径4: 检查error本身是否有detail属性
        else if ((error as any)?.detail) {
          detailData = (error as any).detail
        }

        // 解析后端详细错误信息
        if (detailData) {
          const detail = detailData

          if (Array.isArray(detail)) {
            // 处理字段验证错误数组
            const fieldErrors = detail.map((errorDetail: any) => {
              let errorInfo = ''

              if (errorDetail.loc && errorDetail.loc.length > 1) {
                // 当loc数组有第二个元素时，显示这个元素
                const fieldName = errorDetail.loc[1]
                const fieldMap: Record<string, string> = {
                  name: '模型名称',
                  modelId: '模型类型',
                  apiKey: 'API密钥',
                  provider: '提供商',
                  baseUrl: '基础URL',
                  description: '描述',
                }
                const displayName = fieldMap[fieldName] || fieldName

                // 根据错误类型生成友好的提示信息
                let friendlyMessage = ''
                if (errorDetail.msg?.includes('at least 1 character')) {
                  friendlyMessage = '最少需要1个字符'
                } else if (errorDetail.msg?.includes('at most') && errorDetail.msg?.includes('characters')) {
                  const match = errorDetail.msg.match(/at most (\d+) characters/)
                  const maxLength = match ? match[1] : '限制'
                  friendlyMessage = `最多${maxLength}个字符`
                } else if (errorDetail.msg?.includes('required') || errorDetail.msg?.includes('field required')) {
                  friendlyMessage = '此字段为必填项'
                } else if (errorDetail.msg?.includes('valid') && errorDetail.msg?.includes('url')) {
                  friendlyMessage = '请输入有效的URL地址'
                } else if (errorDetail.msg?.includes('valid email')) {
                  friendlyMessage = '请输入有效的邮箱地址'
                } else {
                  friendlyMessage = errorDetail.msg || '格式不正确'
                }

                errorInfo = `${displayName}${friendlyMessage}`
              } else {
                // 没有loc第二个元素时，显示msg
                errorInfo = errorDetail.msg || '格式错误'
              }

              return errorInfo
            })
            errorMessage = fieldErrors.join('; ')
          } else if (typeof detail === 'string') {
            // 处理简单的字符串错误
            errorMessage = detail
          }
        } else if (error?.response?.data?.message) {
          errorMessage = error.response.data.message
        } else if (error?.message) {
          errorMessage = error.message
        }

        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error',
        })
      }
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    const _model = displayModels.find(m => m.id === modelId)
    if (_model) {
      setDeleteDialog({
        isOpen: true,
        modelId,
        modelName: _model.name,
      })
    }
  }

  const confirmDeleteModel = async () => {
    if (deleteDialog.modelId) {
      try {
        await deleteModelMutation.mutateAsync({ id: deleteDialog.modelId, spaceId: user?.spaceId || '' })
        setSnackbar({ open: true, message: t('models.messages.deleteSuccess'), severity: 'success' })
        setDeleteDialog({ isOpen: false, modelId: '', modelName: '' })
        // 删除成功后刷新数据
        refetch()
      } catch (error) {
        setSnackbar({ open: true, message: t('models.messages.deleteFailed'), severity: 'error' })
        setDeleteDialog({ isOpen: false, modelId: '', modelName: '' })
      }
    }
  }

  const cancelDeleteModel = () => {
    setDeleteDialog({ isOpen: false, modelId: '', modelName: '' })
  }

  const handleTestModel = async () => {
    if (!testPrompt.trim() || !selectedModel) return
    if (testPrompt.length > 1000) {
      return
    }

    setIsTesting(true)

    try {
      const result = await testModelMutation.mutateAsync({ id: selectedModel.id, prompt: testPrompt, spaceId: user?.spaceId || '' })
      setTestResult(
        `测试成功！\n\n模型: ${selectedModel.name}\n提示: ${testPrompt}\n\n响应: ${result.response || '测试完成'}\n\n配置信息：\n- 温度: ${selectedModel.temperature}\n- API协议: ${selectedModel.provider}`,
      )

      // 测试成功后刷新模型列表以更新统计信息
      refetch()
    } catch (error) {
      let errorMessage = error.error || '模型测试失败'

      // 尝试多种访问路径来获取detail数据
      let detailData = null

      // 路径1: error?.response?.data?.detail
      if (error?.response?.data?.detail) {
        detailData = error.response.data.detail
      }
      // 路径2: error?.response?.data // 检查data是否直接包含detail
      else if (error?.response?.data && Object.keys(error.response.data).includes('detail')) {
        detailData = error.response.data.detail
      }
      // 路径3: error?.data // 检查error是否直接包含data
      else if (error?.data?.detail) {
        detailData = error.data.detail
      }
      // 路径4: 检查error本身是否有detail属性
      else if ((error as any)?.detail) {
        detailData = (error as any).detail
      }

      // 解析后端详细错误信息
      if (detailData) {
        if (typeof detailData === 'string') {
          errorMessage = detailData
        } else {
          errorMessage = JSON.stringify(detailData)
        }
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error?.message) {
        errorMessage = error.message
      }

      setTestResult(`测试失败：${errorMessage}\n\n模型: ${selectedModel.name}\n提示: ${testPrompt}`)
    } finally {
      setIsTesting(false)
    }
  }

  // Clear all filters function
  const handleClearFilters = () => {
    setSearchTerm('')
    setFilterProvider('all')
    setFilterStatus('all')
    setFilteredPage(1) // 重置筛选分页到第一页
    setCurrentPage(1) // 重置到第一页
  }

  // Tag management functions
  const handleAddTag = () => {
    const currentTags = newModel.tags || []
    if (newTag.trim() && !currentTags.includes(newTag.trim())) {
      if (currentTags.length >= 10) {
        setSnackbar({
          open: true,
          message: '标签数量不能超过10个',
          severity: 'warning',
        })
        return
      }
      setNewModel({ ...newModel, tags: [...currentTags, newTag.trim()] })
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagIndex: number) => {
    const updatedTags = (newModel.tags || []).filter((_, index) => index !== tagIndex)
    setNewModel({ ...newModel, tags: updatedTags })
  }

  const toggleModelStatus = async (modelId: string) => {
    try {
      await toggleStatusMutation.mutateAsync({ id: modelId, spaceId: user?.spaceId || '' })
      // 切换状态成功后刷新数据
      refetch()
    } catch (error) {
      setSnackbar({ open: true, message: t('models.messages.toggleStatusFailed'), severity: 'error' })
    }
  }

  const removeTag = async (modelId: string, tagIndex: number) => {
    try {
      const _model = displayModels.find(m => m.id === modelId)
      if (_model) {
        const updatedModel = {
          ..._model,
          tags: _model.tags.filter((_, i) => i !== tagIndex),
        }
        await updateModelMutation.mutateAsync({ id: modelId, model: updatedModel, spaceId: user?.spaceId || '' })
        // 删除标签成功后刷新数据
        refetch()
      }
    } catch (error) {
      setSnackbar({ open: true, message: t('models.messages.removeTagFailed'), severity: 'error' })
    }
  }

  // Loading and error states
  if (isLoading) {
    return (
      <div className="space-y-8 p-6 min-h-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 mb-2">
            {t('models.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">{t('models.subtitle')}</p>
        </div>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">{t('models.messages.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8 p-6 min-h-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 mb-2">
            {t('models.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">{t('models.subtitle')}</p>
        </div>
        <div className="text-center py-12">
          <Alert severity="error" className="mb-4">
            {t('models.messages.loadFailed')}: {error instanceof Error ? error.message : t('common.messages.unknownError')}
          </Alert>
          <Button
            onClick={() => {
              setCurrentPage(1)
              refetch()
            }}
            variant="contained"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {t('models.messages.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 min-h-full">
      {/* Page header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 mb-2">{t('models.title')}</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">{t('models.subtitle')}</p>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
            <input
              type="text"
              placeholder={t('models.modelList.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200 bg-gray-50 focus:bg-white"
            />
          </div>
        </div>

        {/* Provider filter */}
        <div className="sm:w-48">
          <select
            value={filterProvider}
            onChange={e => setFilterProvider(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200 bg-gray-50 focus:bg-white"
          >
            <option value="all">{t('models.modelList.allProviders')}</option>
            <option value={ModelProvider.OPENAI}>OpenAI</option>
            <option value={ModelProvider.SILICONFLOW}>SiliconFlow</option>
          </select>
        </div>

        {/* Status filter */}
        <div className="sm:w-48">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200 bg-gray-50 focus:bg-white"
          >
            <option value="all">{t('models.modelList.allStatuses')}</option>
            <option value="active">{t('models.status.active')}</option>
            <option value="inactive">{t('models.status.inactive')}</option>
          </select>
        </div>

        {/* Add Model Button */}
        <button
          onClick={() => handleOpenModelDialog(null)}
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-xl"
        >
          <Plus className="w-5 h-5" />
          <span>{t('models.addModel')}</span>
        </button>
      </div>

      {/* Models table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow className="bg-gradient-to-r from-blue-100 to-indigo-100">
                <TableCell className="text-blue-900 font-semibold">
                  <strong>{t('models.modelList.name')}</strong>
                </TableCell>
                <TableCell className="text-blue-900 font-semibold">
                  <strong>{t('models.modelList.provider')}</strong>
                </TableCell>
                <TableCell className="text-blue-900 font-semibold">
                  <strong>{t('models.modelList.type')}</strong>
                </TableCell>
                <TableCell className="text-blue-900 font-semibold">
                  <strong>{t('models.modelList.status')}</strong>
                </TableCell>
                <TableCell className="text-blue-900 font-semibold">
                  <strong>{t('models.modelList.tags')}</strong>
                </TableCell>
                <TableCell className="text-blue-900 font-semibold">
                  <strong>{t('models.modelList.usageStats')}</strong>
                </TableCell>
                <TableCell className="text-blue-900 font-semibold">
                  <strong>{t('models.modelList.actions')}</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {finalModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      {/* 是否有筛选条件 */}
                      {searchTerm || filterProvider !== 'all' || filterStatus !== 'all' ? (
                        <>
                          {/* 筛选无结果状态 */}
                          <div className="w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full flex items-center justify-center shadow-inner">
                            <Search className="w-8 h-8 text-gray-400" />
                          </div>
                          <div className="text-center max-w-lg">
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">当前筛选状态下未能找到相关结果</h3>
                            <p className="text-gray-600 mb-6">请尝试调整筛选条件或清空所有筛选条件查看更多内容</p>
                            <button
                              onClick={handleClearFilters}
                              className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-xl transform hover:scale-105"
                            >
                              <RefreshCw className="w-4 h-4" />
                              <span>清空筛选</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 完全无数据状态 */}
                          <div className="w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full flex items-center justify-center shadow-inner">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                          <div className="text-center max-w-lg">
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无模型数据</h3>
                            <p className="text-gray-600 mb-6">还没有创建任何模型，点击下方按钮开始添加第一个模型</p>
                            <button
                              onClick={() => handleOpenModelDialog(null)}
                              className="inline-flex items-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-xl transform hover:scale-105"
                            >
                              <Plus className="w-5 h-5" />
                              <span>添加第一个模型</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                finalModels.map((model, index) => (
                  <TableRow key={model.id} className={`hover:bg-blue-50 transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <TableCell>
                      <div>
                        <Typography
                          variant="subtitle2"
                          className="font-bold text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]"
                          title={model.name}
                        >
                          {model.name}
                        </Typography>
                        <Typography variant="caption" className="text-gray-600 block max-w-[250px] truncate" title={model.description}>
                          {model.description}
                        </Typography>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={model.provider}
                        size="small"
                        className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200 font-semibold"
                      />
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-gradient-to-r from-gray-100 to-blue-100 px-3 py-1 rounded-lg border border-gray-200 font-mono text-blue-700">
                        {model.modelId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={model.isActive ? t('models.status.active') : t('models.status.inactive')}
                        color={model.isActive ? 'success' : 'default'}
                        size="small"
                        className={`font-semibold ${model.isActive ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}
                      />
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1 items-center">
                        {model.tags.slice(0, 3).map((tag, index) => (
                          <Tooltip key={index} title={tag} arrow>
                            <Chip
                              label={tag}
                              size="small"
                              onDelete={() => removeTag(model.id, index)}
                              className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200 hover:from-blue-200 hover:to-indigo-200 transition-all duration-200"
                              sx={{
                                maxWidth: '120px',
                                '& .MuiChip-label': {
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                },
                              }}
                            />
                          </Tooltip>
                        ))}
                        {model.tags.length > 3 && (
                          <Tooltip
                            title={
                              <div className="p-2 max-w-md bg-white">
                                <div className="text-sm font-semibold mb-2 text-gray-800">更多标签：</div>
                                <div className="space-y-1">
                                  {model.tags.slice(3).map((tag, index) => (
                                    <div key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded break-all">
                                      {tag}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            }
                            arrow
                          >
                            <Chip
                              label={`+${model.tags.length - 3}`}
                              size="small"
                              classes={{
                                label: 'font-medium',
                              }}
                              style={{
                                background: 'linear-gradient(to right, rgb(219 234 254), rgb(224 231 255))',
                                color: 'rgb(30 64 175)',
                                border: '1px solid rgb(191 219 254)',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                // 点击更多标签时，可以显示所有标签
                                console.log('显示所有标签:', model.tags)
                              }}
                            />
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">{t('models.modelList.requests')}:</span>
                          <span className="font-semibold text-blue-700">{model.usage?.totalRequests?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">{t('models.modelList.successRate')}:</span>
                          <span className="font-semibold text-green-700">{((model.usage?.successRate || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">{t('models.modelList.avgResponse')}:</span>
                          <span className="font-semibold text-orange-700">{model.usage?.averageResponseTime || 0}s</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Tooltip title={t('models.testModel')}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedModel(model)
                              setShowTestDialog(true)
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Play className="w-4 h-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('models.editModel')}>
                          <IconButton size="small" onClick={() => handleOpenModelDialog(model)} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50">
                            <Settings className="w-4 h-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={model.isActive ? t('models.modelList.deactivateModel') : t('models.modelList.activateModel')}>
                          <IconButton
                            size="small"
                            onClick={() => toggleModelStatus(model.id)}
                            className={
                              model.isActive ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                            }
                          >
                            {model.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('models.modelList.deleteModel')}>
                          <IconButton size="small" onClick={() => handleDeleteModel(model.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 分页组件 */}
        {finalTotalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">每页显示:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  if (hasFilters) {
                    setFilteredPage(1) // 重置筛选分页到第一页
                  } else {
                    setCurrentPage(1) // 重置到第一页
                  }
                }}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 shadow-sm"
              >
                <option value={10}>10条</option>
                <option value={20}>20条</option>
                <option value={50}>50条</option>
              </select>
              <span className="text-sm text-gray-600">
                共 {finalTotalItems} 条记录
                {hasFilters && <span className="text-blue-600 ml-1">(筛选结果)</span>}
              </span>
            </div>

            {finalTotalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (hasFilters) {
                      setFilteredPage(Math.max(1, filteredPage - 1))
                    } else {
                      setCurrentPage(Math.max(1, currentPage - 1))
                    }
                  }}
                  disabled={finalCurrentPage === 1}
                  className={`p-2 rounded-lg ${finalCurrentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                  title="上一页"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center space-x-1">
                  {/* 安全的页码计算 */}
                  {(() => {
                    const displayPages = finalTotalPages
                    const displayCurrent = finalCurrentPage

                    // 临时修复：即使只有1页也显示页码按钮
                    if (displayPages < 1) return [1]

                    const pages = []
                    const maxVisible = 5

                    if (displayPages <= maxVisible) {
                      // 总页数少，显示所有页码
                      for (let i = 1; i <= displayPages; i++) {
                        pages.push(i)
                      }
                    } else {
                      // 总页数多，智能显示页码
                      if (displayCurrent <= 3) {
                        // 当前页在前部，显示前5页
                        for (let i = 1; i <= maxVisible; i++) {
                          pages.push(i)
                        }
                      } else if (displayCurrent >= displayPages - 2) {
                        // 当前页在后部，显示最后5页
                        for (let i = displayPages - maxVisible + 1; i <= displayPages; i++) {
                          pages.push(i)
                        }
                      } else {
                        // 当前页在中间，前后各显示2页
                        for (let i = displayCurrent - 2; i <= displayCurrent + 2; i++) {
                          pages.push(i)
                        }
                      }
                    }

                    return pages
                  })().map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => {
                        if (hasFilters) {
                          setFilteredPage(pageNum)
                        } else {
                          setCurrentPage(pageNum)
                        }
                      }}
                      className={`w-10 h-10 rounded-lg font-bold transition-colors ${
                        finalCurrentPage === pageNum
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                          : 'bg-gray-50 text-black font-bold hover:bg-gray-200'
                      }`}
                      title={`第${pageNum}页`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (hasFilters) {
                      setFilteredPage(Math.min(finalTotalPages, filteredPage + 1))
                    } else {
                      setCurrentPage(Math.min(finalTotalPages, currentPage + 1))
                    }
                  }}
                  disabled={finalCurrentPage === finalTotalPages}
                  className={`p-2 rounded-lg ${finalCurrentPage === finalTotalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                  title="下一页"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <span className="text-sm text-gray-600 ml-4">
                  第 {finalCurrentPage} / {finalTotalPages} 页
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unified Model Dialog for Add/Edit */}
      <Dialog
        open={showModelDialog}
        onClose={() => {
          setShowModelDialog(false)
          // 弹窗关闭后自动刷新数据
          refetch()
        }} // 完全禁用自动关闭，只能通过取消按钮退出
        maxWidth="md"
        fullWidth
        disableRestoreFocus
        // 禁用ESC键
        disableEscapeKeyDown={true}
        // 禁用背景点击
        disableBackdropClick={true}
      >
        <DialogTitle className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              {editMode ? <Settings className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
            </div>
            <Typography variant="h6" className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-blue-800">
              {editMode ? '编辑模型' : t('models.dialog.addNewModel')}
            </Typography>
          </div>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} className="pt-4">
            {/* 模型基础信息区域 */}
            <Grid item xs={12}>
              <Typography variant="h6" className="text-gray-800 mb-3 font-semibold border-b border-gray-200 pb-2">
                {t('models.dialog.basicInfo')}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="模型名称"
                sx={{
                  '& .MuiInputLabel-asterisk': {
                    color: 'red',
                  },
                }}
                value={newModel.name}
                onChange={e => {
                  const value = e.target.value
                  if (value.length <= 100) {
                    setNewModel({ ...newModel, name: value })
                  }
                }}
                placeholder=""
                variant="outlined"
                error={(newModel.name || '').length > 100}
                helperText={
                  (newModel.name || '').length > 80 ? (
                    <span style={{ color: 'orange' }}>模型友好名称过长，请控制在100字符以内.字符数：{newModel.name?.length || 0}/100</span>
                  ) : (
                    <span style={{ color: '#666' }}>
                      {t('models.modelConfig.basicInfo.nameHint')} | 字符数：{newModel.name?.length || 0}/100
                    </span>
                  )
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>API协议</InputLabel>
                <Select value={newModel.provider} label="API协议" onChange={e => setNewModel({ ...newModel, provider: e.target.value })}>
                  <MenuItem value={ModelProvider.OPENAI}>OpenAI</MenuItem>
                  <MenuItem value={ModelProvider.SILICONFLOW}>SiliconFlow</MenuItem>
                  {/* Temporarily commented out other providers */}
                  {/* <MenuItem value={ModelProvider.ANTHROPIC}>Anthropic</MenuItem> */}
                  {/* <MenuItem value={ModelProvider.DEEPSEEK}>DeepSeek</MenuItem> */}
                  {/* <MenuItem value={ModelProvider.QWEN}>Qwen</MenuItem> */}
                  {/* <MenuItem value={ModelProvider.GOOGLE}>Google</MenuItem> */}
                  {/* <MenuItem value={ModelProvider.ZHIPU}>智谱AI</MenuItem> */}
                  {/* <MenuItem value={ModelProvider.CUSTOM}>自定义</MenuItem> */}
                </Select>
                <Typography variant="caption" className="text-gray-600 mt-1">
                  {t('models.modelConfig.basicInfo.providerHint')}
                </Typography>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="模型ID"
                sx={{
                  '& .MuiInputLabel-asterisk': {
                    color: 'red',
                  },
                }}
                value={newModel.modelId}
                onChange={e => {
                  const value = e.target.value
                  if (value.length <= 100) {
                    setNewModel({ ...newModel, modelId: value })
                  }
                }}
                placeholder=""
                variant="outlined"
                error={(newModel.name || '').length > 100}
                helperText={
                  (newModel.modelId || '').length > 80 ? (
                    <span style={{ color: 'orange' }}>模型标识符过长，请控制在100字符以内.字符数：{newModel.modelId?.length || 0}/100</span>
                  ) : (
                    <span style={{ color: '#666' }}>
                      {t('models.modelConfig.basicInfo.typeHint')} | 字符数：{newModel.modelId?.length || 0}/100
                    </span>
                  )
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="API 密钥"
                sx={{
                  '& .MuiInputLabel-asterisk': {
                    color: 'red',
                  },
                }}
                type="password"
                value={newModel.apiKey}
                onChange={e => setNewModel({ ...newModel, apiKey: e.target.value?.trim() })}
                placeholder=""
                variant="outlined"
                error={false} // 不显示红色边框，只在下方显示红色提示文本
                helperText={<span style={{ color: '#666' }}>{t('models.modelConfig.parameters.apiKeyHint')}</span>}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="基础服务地址"
                sx={{
                  '& .MuiInputLabel-asterisk': {
                    color: 'red',
                  },
                }}
                value={newModel.baseUrl}
                onChange={e => {
                  setNewModel({ ...newModel, baseUrl: e.target.value })
                  validateBaseUrl(e.target.value)
                }}
                placeholder=""
                variant="outlined"
                disabled={false} // 允许编辑基础URL
                error={!!baseUrlError} // 只在URL格式错误时显示红色边框
                helperText={
                  baseUrlError ? (
                    <span style={{ color: 'red' }}>{baseUrlError}</span>
                  ) : (
                    <span style={{ color: '#666' }}>{t('models.modelConfig.parameters.baseUrlHint')}</span>
                  )
                }
              />
            </Grid>
            <Grid item xs={12}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <TextField
                    label="标签"
                    placeholder=""
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const currentTags = newModel.tags || []
                        if (newTag.trim() && !currentTags.includes(newTag.trim())) {
                          if (currentTags.length >= 10) {
                            setSnackbar({
                              open: true,
                              message: '标签数量不能超过10个',
                              severity: 'warning',
                            })
                            return
                          }
                          setNewModel({
                            ...newModel,
                            tags: [...currentTags, newTag.trim()],
                          })
                          setNewTag('')
                        }
                      }
                    }}
                    variant="outlined"
                    className="flex-1 !mr-4"
                    disabled={(newModel.tags || []).length >= 10}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleAddTag}
                    className="border-gray-300 text-gray-700"
                    disabled={(newModel.tags || []).length >= 10}
                  >
                    添加
                  </Button>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <Typography variant="caption" className={(newModel.tags || []).length >= 10 ? 'text-red-600' : 'text-gray-600'}>
                    标签数量：{(newModel.tags || []).length}/10
                    {(newModel.tags || []).length >= 10 && ' (已达上限)'}
                  </Typography>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(newModel.tags || []).map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      onDelete={() => handleRemoveTag(index)}
                      className="bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200"
                      size="small"
                    />
                  ))}
                </div>
              </div>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                multiline
                rows={3}
                label="描述"
                sx={{
                  '& .MuiInputLabel-asterisk': {
                    color: 'red',
                  },
                }}
                value={newModel.description}
                onChange={e => {
                  const value = e.target.value
                  if (value.length <= 500) {
                    setNewModel({ ...newModel, description: value })
                  }
                }}
                placeholder=""
                variant="outlined"
                error={(newModel.description || '').length > 500} // 只在长度超限时显示红色边框
                helperText={
                  (newModel.description || '').length > 450 ? (
                    <span style={{ color: 'orange' }}>描述过长，请控制在500字符以内.字符数：{newModel.description?.length || 0}/500</span>
                  ) : (
                    <span style={{ color: '#666' }}>字符数：{newModel.description?.length || 0}/500</span>
                  )
                }
              />
            </Grid>

            {/* 模型参数配置区域 */}
            <Grid item xs={12}>
              <Typography variant="h6" className="text-gray-800 mb-3 font-semibold border-b border-gray-200 pb-2 mt-4">
                模型参数配置
              </Typography>
            </Grid>
            <Grid item xs={12} md={12}>
              <TextField
                fullWidth
                required
                label="超时时间(s)"
                type="number"
                placeholder=""
                value={newModel.timeout || ''}
                error={!(newModel.timeout >= 1 && newModel.timeout <= 300)} // 只在URL格式错误时显示红色边框
                onChange={e => {
                  const value = e.target.value
                  if (value === '') {
                    setNewModel({ ...newModel, timeout: undefined })
                    return
                  }

                  let numValue = parseInt(value)
                  if (!isNaN(numValue)) {
                    // 自动将值限制在有效范围内
                    if (numValue < 1) {
                      numValue = 1
                    } else if (numValue > 300) {
                      numValue = 300
                    }
                    setNewModel({ ...newModel, timeout: numValue })
                  }
                }}
                inputProps={{
                  style: {
                    MozAppearance: 'textfield',
                    '&::-webkit-outer-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                    '&::-webkit-inner-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                    '& .MuiInputLabel-asterisk': {
                      color: 'red',
                    },
                  },
                }}
                sx={{
                  '& input[type=number]::-webkit-outer-spin-button': {
                    WebkitAppearance: 'none',
                    margin: 0,
                  },
                  '& input[type=number]::-webkit-inner-spin-button': {
                    WebkitAppearance: 'none',
                    margin: 0,
                  },
                  '& input[type=number]': {
                    MozAppearance: 'textfield',
                  },
                  '& .MuiInputLabel-asterisk': {
                    color: 'red',
                  },
                }}
                variant="outlined"
                helperText="超时时间范围：1-300秒（输入超出范围将自动调整）"
              />
            </Grid>
            {/* <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="最大输出Token数"
                type="number"
                placeholder=""
                value={newModel.maxTokens || ''}
                onChange={e => setNewModel({ ...newModel, maxTokens: e.target.value ? parseInt(e.target.value) : undefined })}
                inputProps={{ min: 1 }}
                variant="outlined"
              />
            </Grid> */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <Typography gutterBottom sx={{ mb: 0 }}>
                  温度: {newModel.temperature}
                </Typography>
                <Tooltip
                  title="temperature:控制模型生成结果的随机性与创造性。值越高，输出越随机、多样；值越低，结果越确定、保守。范围通常为0~2，推荐设置0.1~1.0。示例：0.7（平衡随机性与一致性）、1.2（更具创造性的输出）。"
                  placement="top"
                  arrow
                >
                  <IconButton size="small" sx={{ p: 0, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </IconButton>
                </Tooltip>
              </Box>
              <Slider
                value={newModel.temperature}
                onChange={(_, value) =>
                  setNewModel({
                    ...newModel,
                    temperature: value as number,
                  })
                }
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <Typography gutterBottom sx={{ mb: 0 }}>
                  核采样: {newModel.topp}
                </Typography>
                <Tooltip
                  title="Top-p:选择累计概率达到p的最小词集合进行采样。动态调整候选词的数量，平衡输出的多样性和质量。建议：通常设置为0.9-0.95，与温度配合使用时建议只调整其中一个。"
                  placement="top"
                  arrow
                >
                  <IconButton size="small" sx={{ p: 0, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </IconButton>
                </Tooltip>
              </Box>
              <Slider
                value={newModel.topp}
                onChange={(_, value) =>
                  setNewModel({
                    ...newModel,
                    topp: value as number,
                  })
                }
                min={0}
                max={1}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' },
                ]}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions className="bg-gray-50 px-6 py-4">
          <Button
            onClick={() => {
              setShowModelDialog(false)
              // 弹窗关闭后自动刷新数据
              refetch()
            }}
            className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-lg transition-all duration-200"
          >
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!isFormValid()}
            className={`px-6 py-2 rounded-lg font-semibold transform transition-all duration-300 shadow-sm ${
              !isFormValid()
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:scale-105 hover:shadow-xl'
            }`}
          >
            {editMode ? '保存更改' : '添加模型'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Model Dialog */}
      <Dialog
        open={showTestDialog}
        onClose={() => {
          setShowTestDialog(false)
          setTestPrompt('')
          setTestResult('')
          // 弹窗关闭后自动刷新数据以更新统计次数
          refetch()
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          className: 'rounded-2xl shadow-2xl border border-gray-100',
        }}
        disableRestoreFocus
      >
        <DialogTitle className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <Typography variant="h6" className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-blue-800">
              测试模型: {selectedModel?.name}
            </Typography>
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-4">
            {/* 常用测试语句 */}
            <div>
              <Typography variant="subtitle2" className="text-gray-700 mb-2 font-medium">
                常用测试语句
              </Typography>
              <div className="flex flex-wrap gap-2 mb-3">
                <Chip
                  label="你好，请介绍一下你自己"
                  variant="outlined"
                  size="small"
                  onClick={() => setTestPrompt('你好，请介绍一下你自己')}
                  className="cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                />
                <Chip
                  label="请解释一下人工智能的基本概念"
                  variant="outlined"
                  size="small"
                  onClick={() => setTestPrompt('请解释一下人工智能的基本概念')}
                  className="cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                />
                <Chip
                  label="写一个简单的Python Hello World程序"
                  variant="outlined"
                  size="small"
                  onClick={() => setTestPrompt('写一个简单的Python Hello World程序')}
                  className="cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                />
              </div>
            </div>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="测试提示词"
              value={testPrompt}
              onChange={e => setTestPrompt(e.target.value)}
              placeholder=""
              helperText={testPrompt.length > 1000 ? `字符数超过限制（${testPrompt.length}/1000），请删除多余字符` : `${testPrompt.length}/1000 字符`}
              error={testPrompt.length > 1000}
            />

            <div className="flex space-x-3">
              <Button
                variant="contained"
                startIcon={isTesting ? <Loader2 className="animate-spin" /> : <Play />}
                onClick={handleTestModel}
                disabled={!isTesting && (!testPrompt.trim() || testPrompt.length > 1000)}
                className={`px-6 py-2 rounded-lg font-semibold transform transition-all duration-300 shadow-sm ${
                  isTesting
                    ? 'bg-gray-600 text-white cursor-not-allowed'
                    : !testPrompt.trim() || testPrompt.length > 1000
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:scale-105 hover:shadow-xl'
                }`}
              >
                {isTesting ? '测试中...' : '开始测试'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setTestPrompt('')
                  setTestResult('')
                }}
                className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 border-gray-300 hover:border-gray-400 px-4 py-2 rounded-lg transition-all duration-200"
              >
                重置
              </Button>
            </div>

            {testResult && (
              <div>
                <Typography variant="h6" className="mb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-blue-800 font-bold">
                  测试结果
                </Typography>
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-blue-200 p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-white p-3 rounded-lg border border-gray-200">{testResult}</pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogActions className="bg-gray-50 px-6 py-4">
          <Button
            onClick={() => {
              setShowTestDialog(false)
              setTestPrompt('')
              setTestResult('')
              // 弹窗关闭后自动刷新数据以更新统计次数
              refetch()
            }}
            className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-lg transition-all duration-200"
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={cancelDeleteModel}
        onConfirm={confirmDeleteModel}
        itemType="model"
        itemName={deleteDialog.modelName}
        isLoading={deleteModelMutation.isLoading}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default ModelsPage
