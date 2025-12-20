import React, { useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '@test-agentstudio/base-ui'
import { Button, Input } from '@test-agentstudio/base-ui'

interface AgentUserInputDialogProps {
  open: boolean
  interactionMsg: string | string[]
  onSubmit: (input: Record<string, string>) => void
  onCancel: () => void
}

export const AgentUserInputDialog: React.FC<AgentUserInputDialogProps> = ({
  open,
  interactionMsg,
  onSubmit,
  onCancel,
}) => {
  // 将interactionMsg统一处理为数组格式
  const fieldNames = Array.isArray(interactionMsg) ? interactionMsg : [interactionMsg]

  // 为每个字段初始化状态
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    fieldNames.reduce((acc, fieldName) => {
      acc[fieldName] = ''
      return acc
    }, {} as Record<string, string>)
  )

  // 检查所有必填字段是否都已填写
  const allFieldsFilled = fieldNames.every(fieldName => fieldValues[fieldName]?.trim())

  const handleSubmit = () => {
    if (allFieldsFilled) {
      const trimmedValues = Object.entries(fieldValues).reduce((acc, [key, value]) => {
        acc[key] = value.trim()
        return acc
      }, {} as Record<string, string>)

      onSubmit(trimmedValues)
      // 重置表单
      setFieldValues(
        fieldNames.reduce((acc, fieldName) => {
          acc[fieldName] = ''
          return acc
        }, {} as Record<string, string>)
      )
    }
  }

  const handleCancel = () => {
    setFieldValues(
      fieldNames.reduce((acc, fieldName) => {
        acc[fieldName] = ''
        return acc
      }, {} as Record<string, string>)
    )
    onCancel()
  }

  const handleFieldChange = (fieldName: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent, fieldName?: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // 如果是最后一个字段，直接提交；否则聚焦到下一个字段
      const currentIndex = fieldNames.indexOf(fieldName || '')
      if (currentIndex === fieldNames.length - 1) {
        handleSubmit()
      } else {
        const nextField = fieldNames[currentIndex + 1]
        const nextInput = document.querySelector(`input[data-field="${nextField}"]`) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
        }
      }
    }
  }

  return (
    <Modal open={open} onOpenChange={handleCancel}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>请输入所需信息以继续执行智能体</ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            {Array.isArray(interactionMsg) ? (
              <div>请填写以下信息：
                <ul className="list-disc list-inside ml-4 mt-2">
                  {interactionMsg.map((field, index) => (
                    <li key={index}>{field}</li>
                  ))}
                </ul>
              </div>
            ) : (
              interactionMsg
            )}
          </div>
          <div className="space-y-3">
            {fieldNames.map((fieldName, index) => (
              <div key={fieldName} className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  {fieldName}
                </label>
                <Input
                  data-field={fieldName}
                  value={fieldValues[fieldName] || ''}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, fieldName)}
                  placeholder={`请输入${fieldName}...`}
                  className="w-full"
                  autoFocus={index === 0}
                />
              </div>
            ))}
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allFieldsFilled}
          >
            提交
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}