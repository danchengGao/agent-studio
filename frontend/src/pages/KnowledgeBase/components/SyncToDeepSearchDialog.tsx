import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ArrowLeft, ArrowRight, Check, HelpCircle, Play, Loader2, CheckCircle, Info } from 'lucide-react'
import { Tooltip } from '@mui/material'
import { KnowledgeBase } from '@/types/knowledgeBase'
import { useAuthStore } from '@/stores/useAuthStore'
import { ENV_CONFIG } from '@/config/environment'
import { useUnifiedSnackbar } from '@/Common/UnifiedSnackbar'
import { KnowledgeBaseService, embeddingModelService } from '@test-agentstudio/api-client'
import { useModels, useTestModel } from '@test-agentstudio/api-client'

interface SyncToDeepSearchDialogProps {
  open: boolean
  knowledgeBase: KnowledgeBase
  onClose: () => void
  onSuccess: () => void
}

interface FormData {
  parsingStrategy: string
  segmentationStrategy: string
  maxTokens: number
  chunkOverlapPercent: number
  enableGraphEnhancement: boolean
  llmModelId: number | string | null
}

const PAGE_SIZE = 100

const SyncToDeepSearchDialog: React.FC<SyncToDeepSearchDialogProps> = ({ open, knowledgeBase, onClose, onSuccess }) => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { showSuccess, showError } = useUnifiedSnackbar()
  const spaceId = user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID

  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [deepSearchKbId, setDeepSearchKbId] = useState<string | null>(null)
  const [uploadedCount, setUploadedCount] = useState(0)
  /** 覆盖同步时后端返回的 DS 侧 doc_id 列表，第二步建索引需用此列表，否则 process 找不到文档 */
  const [uploadDocIdList, setUploadDocIdList] = useState<string[] | null>(null)
  const [deepSearchEmbeddingConfigs, setDeepSearchEmbeddingConfigs] = useState<Array<{ id: number; model_name: string }>>([])
  const [deepSearchEmbeddingConfigsLoading, setDeepSearchEmbeddingConfigsLoading] = useState(false)
  const [selectedDeepSearchEmbeddingConfigId, setSelectedDeepSearchEmbeddingConfigId] = useState<number | null>(null)
  const [formData, setFormData] = useState<FormData>({
    parsingStrategy: '1',
    segmentationStrategy: '1',
    maxTokens: 512,
    chunkOverlapPercent: 10,
    enableGraphEnhancement: false,
    llmModelId: null,
  })

  const { data: modelsData, isLoading: modelsLoading, error: modelsError } = useModels({
    spaceId,
    is_active: true,
    size: 100,
    sort_by: 'update_time',
    sort_order: 'desc',
  })
  const modelsList = modelsData?.items?.map(m => ({ id: parseInt(m.id), name: String(m.name || '') })) || []
  const testModelMutation = useTestModel()
  const [isTestingModel, setIsTestingModel] = useState(false)
  const [modelTestPassed, setModelTestPassed] = useState(false)
  const [testedModelId, setTestedModelId] = useState<number | null>(null)

  useEffect(() => {
    if (formData.llmModelId !== testedModelId) setModelTestPassed(false)
  }, [formData.llmModelId, testedModelId])

  useEffect(() => {
    if (!open) {
      setCurrentStep(1)
      setDeepSearchKbId(null)
      setUploadedCount(0)
      setUploadDocIdList(null)
      setDeepSearchEmbeddingConfigs([])
      setSelectedDeepSearchEmbeddingConfigId(null)
      setFormData({
        parsingStrategy: '1',
        segmentationStrategy: '1',
        maxTokens: 512,
        chunkOverlapPercent: 10,
        enableGraphEnhancement: false,
        llmModelId: null,
      })
      setModelTestPassed(false)
      setTestedModelId(null)
    }
  }, [open])

  // 使用 Studio 的嵌入模型列表（与 DeepSearch 共用库后，同步时直接使用 Studio 的 embedding 表）
  useEffect(() => {
    if (!open || !spaceId) return
    setDeepSearchEmbeddingConfigsLoading(true)
    embeddingModelService
      .getEmbeddingModelConfigs(spaceId, { is_active: true, size: 100 })
      .then(({ items }) => {
        const list = items.map(m => ({ id: Number(m.id), model_name: m.name }))
        setDeepSearchEmbeddingConfigs(list)
        if (list.length === 1) setSelectedDeepSearchEmbeddingConfigId(list[0].id)
        else setSelectedDeepSearchEmbeddingConfigId(null)
      })
      .catch(() => setDeepSearchEmbeddingConfigs([]))
      .finally(() => setDeepSearchEmbeddingConfigsLoading(false))
  }, [open, spaceId])

  const handleTestModel = async () => {
    if (!formData.llmModelId) {
      showError(t('knowledgeBases.addDocument.modelRequired') || '请先选择LLM模型')
      return
    }
    setIsTestingModel(true)
    try {
      await testModelMutation.mutateAsync({
        id: String(formData.llmModelId),
        prompt: '你好，请用一句话介绍自己',
        spaceId,
      })
      setModelTestPassed(true)
      setTestedModelId(Number(formData.llmModelId))
      showSuccess('模型测试成功！')
    } catch (error: unknown) {
      setModelTestPassed(false)
      const msg = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : (error as Error)?.message || '模型测试失败'
      showError(`模型测试失败: ${msg}`)
    } finally {
      setIsTestingModel(false)
    }
  }

  const fetchAllDocumentIds = async (): Promise<string[]> => {
    const ids: string[] = []
    let page = 1
    while (true) {
      const res = await KnowledgeBaseService.getDocumentsList({
        space_id: spaceId,
        kb_id: knowledgeBase.id,
        page,
        size: PAGE_SIZE,
      })
      const list = res.data?.items ?? []
      list.forEach((d: { id?: string }) => {
        if (d.id) ids.push(d.id)
      })
      const total = res.data?.total ?? 0
      if (ids.length >= total || list.length < PAGE_SIZE) break
      page += 1
    }
    return ids
  }

  const handleStep1Next = async () => {
    setIsLoading(true)
    try {
      if (selectedDeepSearchEmbeddingConfigId == null) {
        showError(t('knowledgeBases.syncToDeepSearch.selectEmbedder') || '请选择 Deep Search 嵌入模型')
        setIsLoading(false)
        return
      }
      const res = await KnowledgeBaseService.syncUpload({
        space_id: spaceId,
        kb_id: knowledgeBase.id,
        deepsearch_embedding_model_config_id: selectedDeepSearchEmbeddingConfigId,
      })
      if (res.code === 200 && res.data?.ds_kb_id) {
        setDeepSearchKbId(res.data.ds_kb_id)
        setUploadedCount(res.data.uploaded_count ?? 0)
        setUploadDocIdList(Array.isArray(res.data.doc_id_list) ? res.data.doc_id_list : null)
        showSuccess(t('knowledgeBases.syncToDeepSearch.uploadSuccess') || '文件同步完成')
        setCurrentStep(2)
      } else {
        showError(res.message || (t('knowledgeBases.syncToDeepSearch.uploadFailed') || '同步上传失败'))
      }
    } catch (e) {
      showError((e as Error)?.message || (t('knowledgeBases.syncToDeepSearch.uploadFailed') || '同步上传失败'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStep2Complete = async () => {
    if (!deepSearchKbId) {
      showError(t('knowledgeBases.syncToDeepSearch.uploadRequired') || '请先完成文件同步')
      return
    }
    if (formData.enableGraphEnhancement && (!formData.llmModelId || !modelTestPassed)) {
      showError(t('knowledgeBases.addDocument.modelRequired') || '启用图增强需要选择并测试通过LLM模型')
      return
    }
    setIsLoading(true)
    try {
      // 覆盖同步时用上传接口返回的 DS 侧 doc_id_list，否则 process 找不到文档（DS 侧是新 UUID）
      const docIdList =
        uploadDocIdList && uploadDocIdList.length > 0
          ? uploadDocIdList
          : await fetchAllDocumentIds()
      if (docIdList.length === 0) {
        showError(t('knowledgeBases.syncToDeepSearch.noDocuments') || '当前知识库无文档，无需建索引')
        setIsLoading(false)
        return
      }
      await KnowledgeBaseService.syncProcess({
        space_id: spaceId,
        ds_kb_id: deepSearchKbId,
        doc_id_list: docIdList,
        parsing_strategy: { strategy_type: formData.parsingStrategy, strategy_config: {} },
        segmentation_strategy: {
          strategy_type: formData.segmentationStrategy,
          strategy_config: {
            max_tokens: formData.maxTokens,
            chunk_overlap_percent: formData.chunkOverlapPercent,
          },
        },
        indexing_strategy: {
          enable_graph_enhancement: formData.enableGraphEnhancement,
          llm_model_id: formData.enableGraphEnhancement && formData.llmModelId ? Number(formData.llmModelId) : undefined,
        },
      })
      showSuccess(t('knowledgeBases.syncToDeepSearch.processSuccess') || '已提交建索引任务')
      onSuccess()
      onClose()
    } catch (e) {
      showError((e as Error)?.message || (t('knowledgeBases.syncToDeepSearch.processFailed') || '建索引提交失败'))
    } finally {
      setIsLoading(false)
    }
  }

  if (!open) return null

  const totalSteps = 2
  const step2Valid = !formData.enableGraphEnhancement || (!!formData.llmModelId && modelTestPassed)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-25" onClick={onClose} />
        <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              {t('knowledgeBases.syncToDeepSearch.title') || '同步至 Deep Search'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <div className={`ml-3 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-500'} font-medium`}>
                  {t('knowledgeBases.syncToDeepSearch.stepUpload') || '文件同步'}
                </div>
              </div>
              <div className="flex-1 h-1 mx-4 bg-gray-200">
                <div
                  className={`h-1 ${currentStep > 1 ? 'bg-blue-500' : 'bg-transparent'} transition-colors`}
                  style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
                />
              </div>
              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <div className={`ml-3 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-500'} font-medium`}>
                  {t('knowledgeBases.syncToDeepSearch.stepProcess') || '文档参数与建索引'}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {currentStep === 1 && (
              <div>
                <p className="text-gray-600 mb-4">
                  {t('knowledgeBases.syncToDeepSearch.uploadDescription') ||
                    '将当前知识库的文件同步到 Deep Search，用于后续检索。'}
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('knowledgeBases.syncToDeepSearch.embedderLabel') || 'Deep Search 嵌入模型'}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  {deepSearchEmbeddingConfigsLoading ? (
                    <div className="flex items-center text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t('common.loading') || '加载中...'}
                    </div>
                  ) : deepSearchEmbeddingConfigs.length === 0 ? (
                    <p className="text-amber-600 text-sm">
                      {t('knowledgeBases.syncToDeepSearch.noEmbedder') || '暂无 Deep Search 嵌入模型，请先在 Deep Search 服务中配置嵌入模型后再同步。'}
                    </p>
                  ) : (
                    <select
                      value={selectedDeepSearchEmbeddingConfigId ?? ''}
                      onChange={e => setSelectedDeepSearchEmbeddingConfigId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t('knowledgeBases.syncToDeepSearch.selectEmbedderPlaceholder') || '请选择嵌入模型'}</option>
                      {deepSearchEmbeddingConfigs.map(ec => (
                        <option key={ec.id} value={ec.id}>
                          {ec.model_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleStep1Next}
                  disabled={
                    isLoading ||
                    deepSearchEmbeddingConfigsLoading ||
                    deepSearchEmbeddingConfigs.length === 0 ||
                    selectedDeepSearchEmbeddingConfigId == null
                  }
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('knowledgeBases.syncToDeepSearch.syncing') || '同步中...'}
                    </>
                  ) : (
                    <>
                      {t('common.buttons.next')}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
                {uploadedCount > 0 && (
                  <p className="mt-2 text-sm text-green-600">
                    {t('knowledgeBases.syncToDeepSearch.uploadedCount', { count: uploadedCount }) ||
                      `已同步 ${uploadedCount} 个文件`}
                  </p>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <p className="text-gray-600 mb-6">
                  {t('knowledgeBases.syncToDeepSearch.processDescription') ||
                    '设置解析、分段与索引策略，并提交建索引任务。'}
                </p>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('knowledgeBases.addDocument.parsingStrategy')}
                    </label>
                    <select
                      value={formData.parsingStrategy}
                      onChange={e => setFormData(prev => ({ ...prev, parsingStrategy: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">{t('knowledgeBases.addDocument.quickParsing')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('knowledgeBases.addDocument.segmentationStrategy')}
                    </label>
                    <select
                      value={formData.segmentationStrategy}
                      onChange={e => setFormData(prev => ({ ...prev, segmentationStrategy: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">{t('knowledgeBases.addDocument.autoSegmentation')}</option>
                      <option value="2">{t('knowledgeBases.addDocument.customSegmentation')}</option>
                    </select>
                    {formData.segmentationStrategy === '2' && (
                      <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">最大Token数 (16-1024)</label>
                          <input
                            type="number"
                            value={formData.maxTokens}
                            onChange={e => setFormData(prev => ({ ...prev, maxTokens: Math.min(1024, Math.max(16, parseInt(e.target.value) || 16)) }))}
                            min={16}
                            max={1024}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">分段重叠百分比 (0-50)</label>
                          <input
                            type="number"
                            value={formData.chunkOverlapPercent}
                            onChange={e =>
                              setFormData(prev => ({
                                ...prev,
                                chunkOverlapPercent: Math.min(50, Math.max(0, parseInt(e.target.value) || 0)),
                              }))
                            }
                            min={0}
                            max={50}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="syncGraphEnhancement"
                          checked={formData.enableGraphEnhancement}
                          onChange={e => setFormData(prev => ({ ...prev, enableGraphEnhancement: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="syncGraphEnhancement" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center space-x-2">
                          <span>{t('knowledgeBases.addDocument.enableGraphEnhancement')}</span>
                          <Tooltip
                            title={
                              t('knowledgeBases.addDocument.enableGraphEnhancementTooltip') ||
                              '图增强检索开启可以获取更好的检索效果，但是会增加耗时以及消耗额外的大模型token。'
                            }
                            arrow
                            placement="top"
                          >
                            <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                          </Tooltip>
                        </label>
                      </div>
                    </div>
                    {formData.enableGraphEnhancement && (
                      <>
                        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          <span>
                            {t('knowledgeBases.addDocument.enableGraphEnhancementTooltip') ||
                              '构建文档图可以获取更好的检索效果，但是会增加耗时以及消耗额外的大模型token。'}
                          </span>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('knowledgeBases.addDocument.selectLLMModel') || '选择LLM模型'}
                            <span className="text-red-500 ml-1">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <select
                              value={formData.llmModelId ?? ''}
                              onChange={e =>
                                setFormData(prev => ({
                                  ...prev,
                                  llmModelId: e.target.value ? Number(e.target.value) : null,
                                }))
                              }
                              className={`flex-1 min-w-0 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                modelTestPassed && formData.llmModelId === testedModelId
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-300'
                              }`}
                              disabled={modelsLoading || isTestingModel}
                            >
                              <option value="">{t('knowledgeBases.addDocument.selectModelPlaceholder') || '请选择模型'}</option>
                              {modelsList.map(model => (
                                <option key={model.id} value={model.id}>
                                  {model.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleTestModel}
                              disabled={!formData.llmModelId || isTestingModel}
                              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${
                                modelTestPassed && formData.llmModelId === testedModelId
                                  ? 'text-green-600 bg-green-50'
                                  : !formData.llmModelId || isTestingModel
                                    ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                                    : 'text-blue-600 hover:bg-blue-50'
                              }`}
                            >
                              {isTestingModel ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : modelTestPassed && formData.llmModelId === testedModelId ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                <Play className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {formData.enableGraphEnhancement && !formData.llmModelId && (
                            <p className="mt-1 text-xs text-amber-600">
                              {t('knowledgeBases.addDocument.modelRequired') || '启用图增强需要选择LLM模型'}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white">
              {t('common.cancel')}
            </button>
            <div className="flex items-center space-x-2">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {t('common.buttons.previous')}
                </button>
              )}
              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={handleStep1Next}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-1" />
                  )}
                  {t('common.buttons.next')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStep2Complete}
                  disabled={isLoading || !step2Valid}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : null}
                  {t('knowledgeBases.syncToDeepSearch.complete') || '完成并提交建索引'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SyncToDeepSearchDialog
