import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit, Trash2, Database, Tag, Check, X, Cpu } from 'lucide-react'
import { KnowledgeBase } from '@/types/knowledgeBase'
import { useKnowledgeBaseStore } from '@/stores/useKnowledgeBaseStore'
import { useAuthStore } from '@/stores/useAuthStore'
import UnifiedSnackbar, { useUnifiedSnackbar } from '@/Common/UnifiedSnackbar'
import { useEmbeddingModel, KnowledgeBaseService } from '@test-agentstudio/api-client'
import { validateKnowledgeBaseName } from '../utils/validation'

interface KnowledgeBaseCardProps {
  knowledgeBase: KnowledgeBase
  viewMode: 'grid' | 'list'
  onEdit: () => void
  onDelete: () => void
  onClick: () => void
}

const KnowledgeBaseCard: React.FC<KnowledgeBaseCardProps> = ({ knowledgeBase, viewMode, onEdit, onDelete, onClick }) => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { updateKnowledgeBase, isLoading } = useKnowledgeBaseStore()
  const { snackbar, showSuccess, showError, closeSnackbar } = useUnifiedSnackbar()

  // 获取 Embedding 模型信息
  const { data: embeddingModel } = useEmbeddingModel(knowledgeBase.embedding_model_config_id?.toString() || '', knowledgeBase.space_id || user?.spaceId || '')

  // 编辑状态相关
  const [editingField, setEditingField] = useState<'name' | 'description' | null>(null)
  const [editingName, setEditingName] = useState<string>('')
  const [editingDescription, setEditingDescription] = useState<string>('')
  const [nameError, setNameError] = useState<string>('')
  const [existingNames, setExistingNames] = useState<string[]>([])

  // 获取所有知识库名称用于重复检查
  useEffect(() => {
    if (editingField === 'name' && user?.spaceId) {
      const fetchAllKnowledgeBaseNames = async () => {
        try {
          const allNames: string[] = []
          let page = 1
          const pageSize = 100
          let hasMore = true

          while (hasMore) {
            const response = await KnowledgeBaseService.getKnowledgeBases({
              space_id: user.spaceId,
              page: page,
              size: pageSize,
            })
            if (response.code === 200 && response.data?.items) {
              const names = response.data.items.map((item: any) => item.name).filter((name: string) => name && name !== knowledgeBase.name) // 排除当前知识库
              allNames.push(...names)

              // 检查是否还有更多数据
              const total = response.data.total || 0
              const fetched = page * pageSize
              hasMore = fetched < total
              page++
            } else {
              hasMore = false
            }
          }

          setExistingNames(allNames)
        } catch (error) {
          console.error('Failed to fetch knowledge base names:', error)
        }
      }
      fetchAllKnowledgeBaseNames()
    }
  }, [editingField, user?.spaceId, knowledgeBase.name])

  // 当 knowledgeBase prop 更新时，如果不在编辑状态，同步更新编辑状态的值
  useEffect(() => {
    if (!editingField) {
      setEditingName(knowledgeBase.name)
      setEditingDescription(knowledgeBase.desc || knowledgeBase.description || '')
    }
  }, [knowledgeBase, editingField])

  // 处理点击进入编辑状态
  const handleStartEditing = (field: 'name' | 'description', e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡
    setEditingField(field)
    setEditingName(knowledgeBase.name)
    setEditingDescription(knowledgeBase.desc || knowledgeBase.description || '')
    setNameError('')

    // 短暂延迟后聚焦到输入框
    setTimeout(() => {
      const inputElement = document.getElementById(`edit-input-${knowledgeBase.id}-${field}`)
      if (inputElement) {
        inputElement.focus()
        // 全选输入框内容
        if (inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement) {
          inputElement.select()
        }
      }
    }, 100)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setEditingName(newName)

    let error: string | null = null

    // 先检查基本验证（特殊字符、长度等）
    error = validateKnowledgeBaseName(newName, t, 'knowledgeBases.edit.nameRequired')

    // 如果基本验证通过，检查重复名称
    if (!error && newName.trim()) {
      const isDuplicate = existingNames.some(existingName => existingName === newName)
      if (isDuplicate) {
        error = t('knowledgeBases.form.nameExists')
      }
    }

    setNameError(error || '')
  }

  const handleSaveEditing = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editingField || !user?.spaceId) return

    if (editingField === 'name') {
      const nameError = validateKnowledgeBaseName(editingName, t, 'knowledgeBases.edit.nameRequired')
      if (nameError) {
        setNameError(nameError)
        return
      }
      // 检查重复名称
      if (editingName.trim()) {
        const isDuplicate = existingNames.some(existingName => existingName === editingName)
        if (isDuplicate) {
          setNameError(t('knowledgeBases.form.nameExists'))
          return
        }
      }
    }

    try {
      await updateKnowledgeBase({
        kb_id: knowledgeBase.id,
        space_id: user.spaceId,
        name: editingName.trim(), // 去除首尾空格
        desc: editingDescription.trim(),
      })
      showSuccess(t('knowledgeBases.update.success'))
      setEditingField(null)
      setNameError('')
    } catch (error: any) {
      const errorMessage = error?.message || t('knowledgeBases.update.error')
      if (errorMessage.includes('已存在')) {
        setNameError(errorMessage)
      } else {
        showError(errorMessage)
      }
    }
  }

  const handleCancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingField(null)
    setNameError('')
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // 按下Enter键保存编辑，不触发默认行为（表单提交）
      e.preventDefault()
      handleSaveEditing(e as any)
    } else if (e.key === 'Escape') {
      // 按下Escape键取消编辑
      handleCancelEditing(e as any)
    }
  }

  // 获取知识库类型的显示文本
  const getTypeDisplayText = (type?: string) => {
    if (!type || type === 'unknown') return t('knowledgeBases.card.documentType')
    switch (type.toLowerCase()) {
      case 'text':
      case 'document':
        return t('knowledgeBases.card.documentType')
      default:
        return type
    }
  }

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  // 列表视图
  if (viewMode === 'list') {
    return (
      <>
        <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* 名称编辑 */}
                  {editingField === 'name' ? (
                    <div className="mb-1">
                      <div className="relative">
                        <input
                          id={`edit-input-${knowledgeBase.id}-name`}
                          type="text"
                          value={editingName}
                          onChange={handleNameChange}
                          onKeyDown={handleKeyDown}
                          className={`w-full px-3 py-1 border-2 rounded-lg focus:outline-none focus:ring-1 pr-24 ${
                            nameError ? 'border-red-500 focus:ring-red-500' : 'border-blue-500 focus:ring-blue-500'
                          }`}
                          placeholder={t('knowledgeBases.edit.namePlaceholder')}
                          maxLength={100}
                        />
                        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                          <span className={`text-xs mr-1 ${editingName.length >= 100 ? 'text-red-500' : 'text-gray-500'}`}>{editingName.length}/100</span>
                          <button
                            onClick={handleSaveEditing}
                            disabled={isLoading || !!nameError}
                            className={`p-1 rounded ${nameError ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:bg-green-100'}`}
                            title={t('common.tooltips.save')}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={handleCancelEditing} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title={t('common.tooltips.cancel')}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
                    </div>
                  ) : (
                    <h3
                      className="text-lg font-medium text-gray-900 truncate cursor-pointer hover:text-blue-600 transition-colors duration-200"
                      onClick={e => handleStartEditing('name', e)}
                      title={t('common.tooltips.clickToEditName')}
                    >
                      {knowledgeBase.name}
                    </h3>
                  )}

                  {/* 描述编辑 */}
                  {editingField === 'description' ? (
                    <div className="relative">
                      <textarea
                        id={`edit-input-${knowledgeBase.id}-description`}
                        value={editingDescription}
                        onChange={e => setEditingDescription(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full px-3 py-1 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] text-sm pr-20"
                        placeholder={t('knowledgeBases.edit.descriptionPlaceholder')}
                        maxLength={2000}
                      />
                      <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                        <span className={`text-xs mr-1 ${editingDescription.length >= 2000 ? 'text-red-500' : 'text-gray-500'}`}>{editingDescription.length}/2000</span>
                        <button
                          onClick={handleSaveEditing}
                          disabled={isLoading}
                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                          title={t('common.tooltips.save')}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={handleCancelEditing} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title={t('common.tooltips.cancel')}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="text-sm text-gray-500 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors duration-200"
                      onClick={e => handleStartEditing('description', e)}
                      title={t('common.tooltips.clickToEditDescription')}
                    >
                      {knowledgeBase.desc || knowledgeBase.description || t('knowledgeBases.noDescription')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Tag className="w-4 h-4" />
                  <span>{getTypeDisplayText(knowledgeBase.type)}</span>
                </div>
                {embeddingModel && (
                  <div className="flex items-center space-x-1" title={`${t('knowledgeBases.card.embeddingModel')}: ${embeddingModel.name} (${embeddingModel.modelId})`}>
                    <Cpu className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">
                      {embeddingModel.name}
                      {embeddingModel.modelId && <span className="text-gray-500 ml-1">({embeddingModel.modelId})</span>}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={e => handleActionClick(e, onEdit)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                  title={t('common.buttons.edit')}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={e => handleActionClick(e, onDelete)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  title={t('common.buttons.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <UnifiedSnackbar snackbar={snackbar} onClose={closeSnackbar} />
      </>
    )
  }

  // 网格视图
  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
        <div className="p-4 pb-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {/* 名称编辑 */}
              {editingField === 'name' ? (
                <div className="mb-1">
                  <div className="relative">
                    <input
                      id={`edit-input-${knowledgeBase.id}-name`}
                      type="text"
                      value={editingName}
                      onChange={handleNameChange}
                      onKeyDown={handleKeyDown}
                      className={`w-full px-3 py-1 border-2 rounded-lg focus:outline-none focus:ring-1 pr-24 ${
                        nameError ? 'border-red-500 focus:ring-red-500' : 'border-blue-500 focus:ring-blue-500'
                      }`}
                      placeholder={t('knowledgeBases.edit.namePlaceholder')}
                      maxLength={100}
                    />
                    <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                      <span className={`text-xs mr-1 ${editingName.length >= 100 ? 'text-red-500' : 'text-gray-500'}`}>{editingName.length}/100</span>
                      <button
                        onClick={handleSaveEditing}
                        disabled={isLoading || !!nameError}
                        className={`p-1 rounded ${nameError ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:bg-green-100'}`}
                        title={t('common.tooltips.save')}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={handleCancelEditing} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title={t('common.tooltips.cancel')}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
                </div>
              ) : (
                <h3
                  className="text-lg font-medium text-gray-900 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors duration-200"
                  onClick={e => handleStartEditing('name', e)}
                  title={t('common.tooltips.clickToEditName')}
                >
                  {knowledgeBase.name}
                </h3>
              )}
            </div>
          </div>
          {/* 描述编辑 */}
          {editingField === 'description' ? (
            <div className="relative mt-1">
              <textarea
                id={`edit-input-${knowledgeBase.id}-description`}
                value={editingDescription}
                onChange={e => setEditingDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-1 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] text-sm pr-20"
                placeholder={t('knowledgeBases.edit.descriptionPlaceholder')}
                maxLength={2000}
              />
              <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                <span className={`text-xs mr-1 ${editingDescription.length >= 2000 ? 'text-red-500' : 'text-gray-500'}`}>{editingDescription.length}/2000</span>
                <button
                  onClick={handleSaveEditing}
                  disabled={isLoading}
                  className="p-1 text-green-600 hover:bg-green-100 rounded"
                  title={t('common.tooltips.save')}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={handleCancelEditing} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title={t('common.tooltips.cancel')}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-gray-500 line-clamp-2 mt-1 cursor-pointer hover:text-blue-600 transition-colors duration-200"
              onClick={e => handleStartEditing('description', e)}
              title={t('common.tooltips.clickToEditDescription')}
            >
              {knowledgeBase.desc || knowledgeBase.description || t('knowledgeBases.noDescription')}
            </p>
          )}
        </div>
        <div className="p-4 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex flex-col space-y-2 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Tag className="w-4 h-4" />
                <span>{getTypeDisplayText(knowledgeBase.type)}</span>
              </div>
              {embeddingModel && (
                <div className="flex items-center space-x-1" title={`Embedding 模型: ${embeddingModel.name} (${embeddingModel.modelId})`}>
                  <Cpu className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">
                    {embeddingModel.name}
                    {embeddingModel.modelId && <span className="text-gray-500 ml-1">({embeddingModel.modelId})</span>}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={e => handleActionClick(e, onEdit)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                title={t('common.buttons.edit')}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={e => handleActionClick(e, onDelete)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                title={t('common.buttons.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <UnifiedSnackbar snackbar={snackbar} onClose={closeSnackbar} />
    </>
  )
}

export default KnowledgeBaseCard

