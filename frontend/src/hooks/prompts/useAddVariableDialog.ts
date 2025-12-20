import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { VariableData, PromptParameter, PromptMessage, ComparisonGroupData } from '@/types/promptType'

// Hook 参数接口
interface UseAddVariableDialogProps {
  // 主页面状态
  parameters: PromptParameter[]
  setParameters: (params: PromptParameter[] | ((prev: PromptParameter[]) => PromptParameter[])) => void
  promptMessages: PromptMessage[]
  templateEngine: 'normal' | 'jinja2'

  // 对比组状态
  comparisonGroupsData: ComparisonGroupData[]
  setComparisonGroupsData: React.Dispatch<React.SetStateAction<ComparisonGroupData[]>>

  // 对话框状态
  setAddVariableDialogOpen: (open: boolean) => void
  setGroupAddVariableDialogOpen: (state: { open: boolean; groupId?: number }) => void
  setEditVariableDialogOpen: (open: boolean) => void
  setEditingVariableIndex: (index: number | null) => void
  setEditingVariableData: (data: (VariableData & { originalName?: string }) | null) => void

  // 编辑状态
  editingVariableIndex: number | null

  // 通用函数
  setHasUnsavedChanges: (hasChanges: boolean) => void
  triggerAutoSave: (data?: any) => void
  showSnackbar: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void
}

// Hook 返回值接口
interface UseAddVariableDialogReturn {
  handleAddVariableFromDialog: (variableData: VariableData, groupId?: number) => void
  handleEditVariableSave: (variableData: VariableData) => void
}

export const useAddVariableDialog = ({
  parameters,
  setParameters,
  promptMessages,
  templateEngine,
  comparisonGroupsData,
  setComparisonGroupsData,
  setAddVariableDialogOpen,
  setGroupAddVariableDialogOpen,
  setEditVariableDialogOpen,
  setEditingVariableIndex,
  setEditingVariableData,
  editingVariableIndex,
  setHasUnsavedChanges,
  triggerAutoSave,
  showSnackbar,
}: UseAddVariableDialogProps): UseAddVariableDialogReturn => {
  const { t } = useTranslation()

  // 处理新增变量（支持主页面和对比模式下不同组的添加）
  const handleAddVariableFromDialog = useCallback(
    (variableData: VariableData, groupId?: number) => {
      // 判断是否为对比模式下的组变量添加
      const isGroupMode = groupId !== undefined && groupId !== null
      const logPrefix = isGroupMode ? `[GROUP-VAR-ADD-${groupId}]` : '[MAIN-VAR-ADD]'

      console.log(`🔧 ${logPrefix} 组变量添加`, { variableData, groupId: groupId })

      // 如果是组模式但groupId为空，则报错并返回
      if (isGroupMode && (groupId === null || groupId === undefined)) {
        console.error(`🔧 ${logPrefix} groupId为空`, { groupId, variableData })
        return
      }

      console.log(`🔧 ${logPrefix} 开始处理变量添加`, {
        variableData,
        groupId,
        isGroupMode,
        parametersLength: parameters.length,
      })
      console.log(`🔧 ${logPrefix} 当前templateEngine: ${templateEngine}`)

      // 根据模式获取目标组数据和消息列表
      let targetMessages: PromptMessage[] = promptMessages
      let targetGroup = null

      if (isGroupMode) {
        targetGroup = comparisonGroupsData.find(g => g.id === groupId)
        if (!targetGroup) {
          console.error(`🔧 ${logPrefix} 未找到目标组`, { groupId, comparisonGroupsData })
          return
        }
        targetMessages = targetGroup.messages
        console.log(`🔧 ${logPrefix} 目标组现有参数数量: ${targetGroup.parameters?.length || 0}`)
      }

      // 检查变量是否在placeholder消息中出现
      const placeholderVars: string[] = []
      if (templateEngine === 'jinja2') {
        targetMessages.forEach(msg => {
          if (msg.role === 'placeholder' && msg.content.trim()) {
            placeholderVars.push(msg.content.trim())
          }
        })
      }

      const isPlaceholderType = placeholderVars.includes(variableData.name)
      console.log(`🔧 ${logPrefix} 变量类型判断`, { variableData, placeholderVars, isPlaceholderType })

      // 添加新变量
      const newParam: PromptParameter = {
        name: variableData.name,
        value: variableData.value,
        description: isPlaceholderType ? `Placeholder变量: ${variableData.name}` : `${variableData.dataType}类型变量`,
        type: isPlaceholderType ? 'placeholder' : 'text',
        dataType: variableData.dataType,
        // 如果是placeholder类型，添加默认的消息序列
        messages: isPlaceholderType
          ? [
              {
                id: Date.now().toString(),
                role: 'user' as const,
                content: '',
              },
            ]
          : undefined,
      }

      console.log(`🔧 ${logPrefix} 新增变量`, newParam)

      if (isGroupMode) {
        // 对比模式：更新指定组的参数列表
        setComparisonGroupsData(
          comparisonGroupsData.map(g => {
            if (g.id === groupId) {
              const updatedParameters = [...(g.parameters || []), newParam]
              console.log(`🔧 ${logPrefix} 组更新后参数数量: ${updatedParameters.length}`)
              return { ...g, parameters: updatedParameters }
            }
            return g
          }),
        )

        // 关闭组变量对话框
        setGroupAddVariableDialogOpen({ open: false })
      } else {
        // 主页面模式：更新主参数列表
        const newParameters = [...parameters, newParam]
        console.log(`🔧 ${logPrefix} 更新后参数数量: ${newParameters.length}`)
        setParameters(newParameters)

        // 使用更新后的参数列表触发自动保存
        triggerAutoSave({
          parameters: newParameters,
        })

        // 关闭主变量对话框
        setAddVariableDialogOpen(false)
      }

      // 标记为有未保存的更改并触发自动保存
      setHasUnsavedChanges(true)
      if (isGroupMode) {
        triggerAutoSave()
      }

      showSnackbar(t('components.prompts.promptEditPage.variableAddSuccess'), 'success')
    },
    [
      parameters,
      promptMessages,
      templateEngine,
      comparisonGroupsData,
      setComparisonGroupsData,
      setAddVariableDialogOpen,
      setGroupAddVariableDialogOpen,
      setParameters,
      setHasUnsavedChanges,
      triggerAutoSave,
      showSnackbar,
      t,
    ],
  )

  // 处理编辑变量保存
  const handleEditVariableSave = useCallback(
    (variableData: VariableData) => {
      if (editingVariableIndex === null) return

      // 更新变量
      const newParameters = [...parameters]
      newParameters[editingVariableIndex] = {
        ...newParameters[editingVariableIndex],
        name: variableData.name,
        value: variableData.value,
        description: `${variableData.dataType}类型变量`,
        dataType: variableData.dataType,
      }

      setParameters(newParameters)

      // 使用更新后的参数列表触发自动保存
      setHasUnsavedChanges(true)
      triggerAutoSave({
        parameters: newParameters,
      })

      // 重置状态
      setEditVariableDialogOpen(false)
      setEditingVariableIndex(null)
      setEditingVariableData(null)

      showSnackbar(t('components.prompts.promptEditPage.variableUpdateSuccess'), 'success')
    },
    [
      editingVariableIndex,
      parameters,
      setParameters,
      setHasUnsavedChanges,
      triggerAutoSave,
      setEditVariableDialogOpen,
      setEditingVariableIndex,
      setEditingVariableData,
      showSnackbar,
      t,
    ],
  )

  return {
    handleAddVariableFromDialog,
    handleEditVariableSave,
  }
}
