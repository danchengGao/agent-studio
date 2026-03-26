import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ArrowLeft, ArrowRight, Check, Info, HelpCircle, Play, Loader2, CheckCircle, Link2 } from 'lucide-react'
import { Tooltip } from '@mui/material'
import { KnowledgeBase } from '@/types/knowledgeBase'
import { useAuthStore } from '@/stores/useAuthStore'
import { ENV_CONFIG } from '@/config/environment'
import { useUnifiedSnackbar } from '@/Common/UnifiedSnackbar'
import { KnowledgeBaseService, useModels, useTestModel } from '@test-agentstudio/api-client'
import type {
  ParsingStrategy,
  SegmentationStrategy,
  IndexingStrategy,
} from '@test-agentstudio/api-client'

interface AddWeblinkDialogProps {
  open: boolean
  knowledgeBase: KnowledgeBase
  onClose: () => void
  onSuccess: (processingWeblinkIds?: string[]) => void
  onWeblinksAdded?: () => void
}

interface FormData {
  parsingStrategy: string
  segmentationStrategy: string
  maxTokens: number
  chunkOverlapPercent: number
  enableGraphEnhancement: boolean
  llmModelId: number | string | null
}

const AddWeblinkDialog: React.FC<AddWeblinkDialogProps> = ({
  open,
  knowledgeBase,
  onClose,
  onSuccess,
  onWeblinksAdded,
}) => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { showSuccess, showError } = useUnifiedSnackbar()

  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [urlText, setUrlText] = useState('')
  const [addedWeblinkIds, setAddedWeblinkIds] = useState<string[]>([])
  const [addedUrls, setAddedUrls] = useState<string[]>([])
  const [formData, setFormData] = useState<FormData>({
    parsingStrategy: '1',
    segmentationStrategy: '1',
    maxTokens: 512,
    chunkOverlapPercent: 10,
    enableGraphEnhancement: false,
    llmModelId: null,
  })

  const spaceId = user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID
  const totalSteps = 2

  const {
    data: modelsData,
    isLoading: modelsLoading,
    error: modelsError,
  } = useModels({
    spaceId,
    is_active: true,
    size: 100,
    sort_by: 'update_time',
    sort_order: 'desc',
  })
  const modelsList =
    modelsData?.items?.map(m => ({
      id: parseInt(m.id),
      name: String(m.name || ''),
    })) || []

  const testModelMutation = useTestModel()
  const [isTestingModel, setIsTestingModel] = useState(false)
  const [modelTestPassed, setModelTestPassed] = useState(false)
  const [testedModelId, setTestedModelId] = useState<number | null>(null)

  useEffect(() => {
    if (formData.llmModelId !== testedModelId) {
      setModelTestPassed(false)
    }
  }, [formData.llmModelId, testedModelId])

  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n\r]+/)
      .map(u => u.trim())
      .filter(u => u.length > 0)
  }

  const validateUrls = (urls: string[]): { valid: string[]; invalid: string[] } => {
    const valid: string[] = []
    const invalid: string[] = []
    for (const u of urls) {
      if (u.toLowerCase().startsWith('http://') || u.toLowerCase().startsWith('https://')) {
        valid.push(u)
      } else {
        invalid.push(u)
      }
    }
    return { valid, invalid }
  }

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
        spaceId: spaceId,
      })
      setModelTestPassed(true)
      setTestedModelId(Number(formData.llmModelId))
      showSuccess(t('common.success') || '模型测试成功！')
    } catch (error: unknown) {
      setModelTestPassed(false)
      const errMsg = error && typeof error === 'object' && 'message' in error ? String((error as { message: string }).message) : '模型测试失败'
      showError(`模型测试失败: ${errMsg}`)
    } finally {
      setIsTestingModel(false)
    }
  }

  const handlePrevious = () => {
    setIsTransitioning(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCurrentStep(prev => prev - 1)
        setIsTransitioning(false)
      })
    })
  }

  const resetForm = () => {
    setCurrentStep(1)
    setUrlText('')
    setAddedWeblinkIds([])
    setAddedUrls([])
    setModelTestPassed(false)
    setTestedModelId(null)
    setFormData({
      parsingStrategy: '1',
      segmentationStrategy: '1',
      maxTokens: 512,
      chunkOverlapPercent: 10,
      enableGraphEnhancement: false,
      llmModelId: null,
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleAddUrls = async () => {
    const urls = parseUrls(urlText)
    if (urls.length === 0) {
      showError(t('knowledgeBases.addWeblink.noUrls') || '请输入至少一个URL')
      return false
    }
    const { valid, invalid } = validateUrls(urls)
    if (invalid.length > 0) {
      showError(
        t('knowledgeBases.addWeblink.invalidUrls') ||
          `以下URL无效（需以 http:// 或 https:// 开头）: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '...' : ''}`
      )
      return false
    }
    if (valid.length > 50) {
      showError(t('knowledgeBases.addWeblink.tooManyUrls') || '单次最多添加50个URL')
      return false
    }

    setIsLoading(true)
    try {
      const response = await KnowledgeBaseService.addWeblinks({
        space_id: spaceId,
        kb_id: knowledgeBase.id,
        urls: valid,
      })
      if (response.code === 200 && response.data) {
        const ids = response.data.links?.map((l: { id: string }) => l.id) || []
        setAddedWeblinkIds(ids)
        setAddedUrls(valid)
        showSuccess(
          t('knowledgeBases.addWeblink.addSuccess') ||
            `成功添加 ${response.data.success_count} 个链接`
        )
        if (onWeblinksAdded) onWeblinksAdded()
        return ids
      } else {
        showError(response.message || t('knowledgeBases.addWeblink.addFailed') || '添加失败')
        return []
      }
    } catch (error) {
      showError(
        t('knowledgeBases.addWeblink.addFailed') ||
          `添加失败: ${error instanceof Error ? error.message : String(error)}`
      )
      return []
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcessWeblinks = async () => {
    if (addedWeblinkIds.length === 0) {
      showError(t('knowledgeBases.addWeblink.noLinksToProcess') || '没有可处理的链接')
      return
    }
    if (formData.enableGraphEnhancement && !formData.llmModelId) {
      showError(t('knowledgeBases.addWeblink.modelRequired') || '启用图增强需要选择LLM模型')
      return
    }

    setIsLoading(true)
    try {
      const parsing_strategy: ParsingStrategy = {
        strategy_type: formData.parsingStrategy,
        strategy_config: {},
      }
      const maxTokens = formData.maxTokens === -1 || formData.maxTokens < 16 ? 512 : Math.min(1024, formData.maxTokens)
      const chunkOverlapPercent = formData.chunkOverlapPercent === -1 || formData.chunkOverlapPercent < 0 ? 10 : Math.min(50, formData.chunkOverlapPercent)
      const segmentation_strategy: SegmentationStrategy = {
        strategy_type: formData.segmentationStrategy,
        strategy_config: {
          max_tokens: maxTokens,
          chunk_overlap_percent: chunkOverlapPercent,
        },
      }
      const indexing_strategy: IndexingStrategy = {
        enable_graph_enhancement: formData.enableGraphEnhancement,
        llm_model_id:
          formData.enableGraphEnhancement && formData.llmModelId
            ? Number(formData.llmModelId)
            : undefined,
      }
      const response = await KnowledgeBaseService.processWeblinks({
        space_id: spaceId,
        kb_id: knowledgeBase.id,
        weblink_id_list: addedWeblinkIds,
        parsing_strategy,
        segmentation_strategy,
        indexing_strategy,
      })
      if (response.code === 200 && response.data) {
        showSuccess(
          t('knowledgeBases.addWeblink.settingsSuccess') || t('knowledgeBases.addWeblink.processSuccess') || '链接参数设置成功'
        )
        onSuccess(addedWeblinkIds)
        handleClose()
      } else {
        showError(response.message || t('knowledgeBases.addWeblink.processFailed') || '处理启动失败')
      }
    } catch (error) {
      showError(
        t('knowledgeBases.addWeblink.processFailed') ||
          `处理失败: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleNext = async () => {
    if (isLoading || isTransitioning) return
    try {
      if (currentStep === 1) {
        const urls = parseUrls(urlText)
        if (urls.length === 0) {
          showError(t('knowledgeBases.addWeblink.noUrls') || '请输入至少一个URL')
          return
        }
        const { valid, invalid } = validateUrls(urls)
        if (invalid.length > 0) {
          showError(t('knowledgeBases.addWeblink.invalidUrls') || '请确保所有URL以 http:// 或 https:// 开头')
          return
        }
        if (addedWeblinkIds.length > 0) {
          setIsTransitioning(true)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setCurrentStep(2)
              setTimeout(() => setIsTransitioning(false), 100)
            })
          })
        } else {
          const ids = await handleAddUrls()
          if (Array.isArray(ids) && ids.length > 0) {
            setIsTransitioning(true)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setCurrentStep(2)
                setTimeout(() => setIsTransitioning(false), 100)
              })
            })
          }
        }
      } else if (currentStep === 2) {
        await handleProcessWeblinks()
      }
    } catch (error) {
      console.error('handleNext error:', error)
      showError(t('knowledgeBases.addWeblink.processFailed') || '操作失败')
    }
  }

  if (!open) return null

  const renderStep2 = () => (
    <div key="step-2">
      <p className="text-gray-600 mb-6">{t('knowledgeBases.addWeblink.settingsDescription')}</p>
      <div className="space-y-6">
        {/* 解析策略 */}
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
        {/* 分段策略 */}
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
                  type="text"
                  value={formData.maxTokens === -1 ? '' : formData.maxTokens}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '') { setFormData(prev => ({ ...prev, maxTokens: -1 as any })); return }
                    if (/^\d*$/.test(v)) {
                      const n = parseInt(v)
                      if (!isNaN(n)) setFormData(prev => ({ ...prev, maxTokens: n }))
                    }
                  }}
                  onBlur={e => {
                    const v = e.target.value
                    if (v === '') { setFormData(prev => ({ ...prev, maxTokens: 16 })); return }
                    const n = parseInt(v)
                    if (isNaN(n) || n < 16) setFormData(prev => ({ ...prev, maxTokens: 16 }))
                    else if (n > 1024) setFormData(prev => ({ ...prev, maxTokens: 1024 }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分段重叠百分比 (0-50)</label>
                <input
                  type="text"
                  value={formData.chunkOverlapPercent === -1 ? '' : formData.chunkOverlapPercent}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '') { setFormData(prev => ({ ...prev, chunkOverlapPercent: -1 as any })); return }
                    if (/^\d*$/.test(v)) {
                      const n = parseInt(v)
                      if (!isNaN(n)) setFormData(prev => ({ ...prev, chunkOverlapPercent: n }))
                    }
                  }}
                  onBlur={e => {
                    const v = e.target.value
                    if (v === '') { setFormData(prev => ({ ...prev, chunkOverlapPercent: 0 })); return }
                    const n = parseInt(v)
                    if (isNaN(n) || n < 0) setFormData(prev => ({ ...prev, chunkOverlapPercent: 0 }))
                    else if (n > 50) setFormData(prev => ({ ...prev, chunkOverlapPercent: 50 }))
                  }}
                  onKeyDown={e => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setFormData(prev => ({ ...prev, chunkOverlapPercent: Math.min(50, prev.chunkOverlapPercent + 1) }))
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setFormData(prev => ({ ...prev, chunkOverlapPercent: Math.max(0, prev.chunkOverlapPercent - 1) }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
        {/* 图增强配置 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="weblink-graph-enhancement"
                checked={formData.enableGraphEnhancement}
                onChange={e => setFormData(prev => ({ ...prev, enableGraphEnhancement: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="weblink-graph-enhancement" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center space-x-2">
                <span>{t('knowledgeBases.addDocument.enableGraphEnhancement')}</span>
                <Tooltip
                  title={t('knowledgeBases.addDocument.enableGraphEnhancementTooltip') || '图增强检索开启可以获取更好的检索效果，但是会增加耗时以及消耗额外的大模型token。'}
                  arrow
                  placement="top"
                >
                  <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                </Tooltip>
              </label>
            </div>
          </div>
          {formData.enableGraphEnhancement && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>{t('knowledgeBases.addDocument.enableGraphEnhancementTooltip') || '构建文档图可以获取更好的检索效果，但是会增加耗时以及消耗额外的大模型token。'}</span>
            </div>
          )}
          {formData.enableGraphEnhancement && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('knowledgeBases.addDocument.selectLLMModel') || '选择LLM模型'}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={formData.llmModelId || ''}
                  onChange={e => setFormData(prev => ({ ...prev, llmModelId: e.target.value ? Number(e.target.value) : null }))}
                  className={`flex-1 min-w-0 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${modelTestPassed && formData.llmModelId === testedModelId ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                  style={!formData.llmModelId ? { color: '#9ca3af' } : {}}
                  disabled={modelsLoading || isTestingModel}
                >
                  <option value="" disabled hidden style={{ color: '#9ca3af' }}>
                    {t('knowledgeBases.addDocument.selectModelPlaceholder') || '请选择模型'}
                  </option>
                  {modelsList.map(m => (
                    <option key={m.id} value={m.id} style={{ color: '#111827' }}>{m.name}</option>
                  ))}
                </select>
                <Tooltip title={modelTestPassed && formData.llmModelId === testedModelId ? '测试已通过' : '测试模型连接'}>
                  <span>
                    <button
                      type="button"
                      onClick={handleTestModel}
                      disabled={!formData.llmModelId || isTestingModel}
                      className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${modelTestPassed && formData.llmModelId === testedModelId ? 'text-green-600 bg-green-50' : !formData.llmModelId || isTestingModel ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                    >
                      {isTestingModel ? <Loader2 className="w-5 h-5 animate-spin" /> : modelTestPassed && formData.llmModelId === testedModelId ? <CheckCircle className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                  </span>
                </Tooltip>
              </div>
              {modelsLoading && <p className="mt-1 text-xs text-gray-500">{t('common.loading') || '加载中...'}</p>}
              {!!modelsError && <p className="mt-1 text-xs text-red-500">{t('knowledgeBases.addDocument.loadModelsFailed') || '加载模型列表失败'}</p>}
              {formData.enableGraphEnhancement && !formData.llmModelId && <p className="mt-1 text-xs text-amber-600">{t('knowledgeBases.addDocument.modelRequired') || '启用图增强需要选择LLM模型'}</p>}
              {formData.llmModelId && !modelTestPassed && <p className="mt-1 text-xs text-amber-600">请点击测试按钮验证模型可用性</p>}
              {modelTestPassed && formData.llmModelId === testedModelId && <p className="mt-1 text-xs text-green-600 flex items-center"><CheckCircle className="w-3 h-3 mr-1" />模型测试通过</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-25" onClick={handleClose} />

        <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              {t('knowledgeBases.addWeblink.title') || '添加网页链接'}
            </h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-500">
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
                  {t('knowledgeBases.addWeblink.steps.upload') || '输入URL'}
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
                  {t('knowledgeBases.addWeblink.steps.settings') || t('knowledgeBases.addWeblink.stepSettings')}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {currentStep === 1 && (
              <div key="step-1">
                <p className="text-gray-600 mb-6">
                  {t('knowledgeBases.addWeblink.urlDescription') ||
                    '每行输入一个URL，支持 http:// 和 https:// 链接（如网页、微信公众号文章等）'}
                </p>
                <textarea
                  value={urlText}
                  onChange={e => setUrlText(e.target.value)}
                  placeholder={t('knowledgeBases.addWeblink.urlPlaceholder') || 'https://example.com/page\nhttps://mp.weixin.qq.com/...'}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {t('knowledgeBases.addWeblink.urlHint') || '单次最多50个URL'}
                </p>
                {addedUrls.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      {t('knowledgeBases.addWeblink.selectedUrls') || '已添加的URL'}
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {addedUrls.map((url, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <Link2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <span
                              className="text-sm text-gray-900 truncate block max-w-xs md:max-w-sm lg:max-w-md"
                              title={url}
                            >
                              {url}
                            </span>
                            <span className="text-xs text-green-600 flex-shrink-0 ml-2">
                              ✓ {t('knowledgeBases.addWeblink.addedLabel')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-green-600">
                      {t('knowledgeBases.addWeblink.allUrlsAdded') || 'URL已添加，可直接进入下一步'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && renderStep2()}
          </div>

          {/* 底部按钮 */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <button type="button" onClick={handleClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white">
              {t('common.cancel')}
            </button>

            <div className="flex items-center space-x-2">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {t('common.buttons.previous')}
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                disabled={
                  isLoading ||
                  isTransitioning ||
                  (currentStep === 1 && validateUrls(parseUrls(urlText)).valid.length === 0) ||
                  (currentStep === 2 && formData.enableGraphEnhancement && (!formData.llmModelId || !modelTestPassed))
                }
                className={`px-4 py-2 rounded-lg flex items-center ${
                  currentStep === 2
                    ? formData.enableGraphEnhancement && (!formData.llmModelId || !modelTestPassed)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                    : validateUrls(parseUrls(urlText)).valid.length > 0
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                {isLoading ? (
                  <span key="loading-text">{t('common.saving')}</span>
                ) : (
                  <span key="next-text" className="flex items-center">
                    {currentStep === 1 && addedWeblinkIds.length === 0
                      ? (t('knowledgeBases.addWeblink.addAndNext') || '添加并下一步')
                      : t('common.buttons.next')}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddWeblinkDialog
