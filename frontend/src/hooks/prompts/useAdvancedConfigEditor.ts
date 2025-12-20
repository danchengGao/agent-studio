import { useCallback } from 'react'
import type { PromptParameter } from '@/types/promptType'
import type { VariableData, VariableDataType } from '@/components/Prompts'

// Hook 参数接口
interface UseAdvancedConfigEditorProps {
  // 参数列表
  parameters: PromptParameter[]

  // 状态设置函数
  setEditingVariableIndex: (index: number | null) => void
  setEditingVariableData: (data: (VariableData & { originalName?: string }) | null) => void
  setEditVariableDialogOpen: (open: boolean) => void
  setParameters: React.Dispatch<React.SetStateAction<PromptParameter[]>>
  setHasUnsavedChanges: (value: boolean) => void
  triggerAutoSave: (data: { parameters?: PromptParameter[] }) => void
}

// Hook 返回值接口
interface UseAdvancedConfigEditorReturn {
  handleEditVariable: (index: number) => void
  validateAndClearParameterValue: (paramName: string, value: string) => void
}

export const useAdvancedConfigEditor = ({
  parameters,
  setEditingVariableIndex,
  setEditingVariableData,
  setEditVariableDialogOpen,
  setParameters,
  setHasUnsavedChanges,
  triggerAutoSave,
}: UseAdvancedConfigEditorProps): UseAdvancedConfigEditorReturn => {
  // 处理编辑变量
  const handleEditVariable = useCallback(
    (index: number) => {
      const param = parameters[index]
      setEditingVariableIndex(index)
      setEditingVariableData({
        name: param.name,
        value: param.value,
        dataType: (param.dataType || 'string') as VariableDataType,
        originalName: param.name, // 保存原始名称用于验证
      })
      setEditVariableDialogOpen(true)
    },
    [parameters, setEditingVariableIndex, setEditingVariableData, setEditVariableDialogOpen],
  )

  // 验证并清空无效的参数值（失去焦点时调用）
  const validateAndClearParameterValue = useCallback(
    (paramName: string, value: string) => {
      setParameters(prev => {
        const updatedParameters = prev.map(param => {
          if (param.name === paramName) {
            // 使用当前状态中的值，确保获取到最新的值
            const currentValue = param.value
            let validatedValue = currentValue

            if (param.dataType === 'integer') {
              // 验证整数格式
              if (currentValue.trim() && !/^-?\d+$/.test(currentValue.trim())) {
                validatedValue = '' // 清空无效输入
              }
            } else if (param.dataType === 'number') {
              // 验证浮点数格式
              if (currentValue.trim() && !/^-?\d*\.?\d+$/.test(currentValue.trim())) {
                validatedValue = '' // 清空无效输入
              }
            } else if (param.dataType === 'object') {
              // 验证JSON对象格式
              if (currentValue.trim()) {
                try {
                  JSON.parse(currentValue.trim())
                } catch (error) {
                  validatedValue = '' // 清空无效JSON
                }
              }
            }

            return { ...param, value: validatedValue }
          }
          return param
        })

        // 如果值发生了变化，触发自动保存
        const changedParam = updatedParameters.find(p => p.name === paramName)
        const originalParam = prev.find(p => p.name === paramName)
        if (changedParam && originalParam && changedParam.value !== originalParam.value) {
          setHasUnsavedChanges(true)
          triggerAutoSave({ parameters: updatedParameters })
        }

        return updatedParameters
      })
    },
    [setParameters, setHasUnsavedChanges, triggerAutoSave],
  )

  return {
    handleEditVariable,
    validateAndClearParameterValue,
  }
}
