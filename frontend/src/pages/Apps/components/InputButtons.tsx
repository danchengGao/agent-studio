/**
 * Input Buttons Component
 * 输入框按钮组件 - 模型选择和触发按钮
 */

import React from 'react'
import { ChevronDown } from 'lucide-react'
import ModelIcon from '@/assets/icons/modelManagement.svg?react'
import { RADIUS_BUTTON, BUTTON_HOVER_EFFECTS, BUTTON_TRANSITION, FOCUS_RING } from '../constants/styles'

// ==================== 模型选择按钮 ====================

export interface ModelSelectButtonProps {
  selectedModel: string
  isLoading: boolean
  models: string[]
  onClick: () => void
  buttonRef: React.RefObject<HTMLButtonElement | null>
}

export const ModelSelectButton: React.FC<ModelSelectButtonProps> = ({
  selectedModel,
  isLoading,
  models,
  onClick,
  buttonRef,
}) => {
  if (isLoading) {
    return <div className="text-xs text-gray-400 px-2">加载中...</div>
  }
  if (models.length === 0) {
    return <div className="text-xs text-gray-400 px-2">暂无模型</div>
  }

  const hasSelectedModel = !!selectedModel

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1.5 ${RADIUS_BUTTON}
        text-sm font-medium
        bg-transparent text-gray-500
        ${BUTTON_HOVER_EFFECTS}
        ${FOCUS_RING}
        ${BUTTON_TRANSITION}
      `}
      title={selectedModel || '选择模型'}
    >
      <ModelIcon className="w-3.5 h-3.5" />
      <span className="max-w-[120px] truncate">
        {selectedModel || '选择模型'}
      </span>
      {hasSelectedModel && <ChevronDown className="w-3.5 h-3.5" />}
    </button>
  )
}

// ==================== 触发按钮 ====================

export interface TriggerButtonsProps {
  onAtClick: () => void
  onHashClick: () => void
}

export const TriggerButtons: React.FC<TriggerButtonsProps> = ({
  onAtClick,
  onHashClick,
}) => {
  const buttonClass = `
    px-3 py-1.5 ${RADIUS_BUTTON}
    bg-transparent border-none
    text-sm font-medium text-gray-500
    ${BUTTON_HOVER_EFFECTS}
    ${FOCUS_RING}
    ${BUTTON_TRANSITION}
  `

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onAtClick}
        className={buttonClass}
        title="选择智能体"
      >
        @
      </button>
      {/* 暂时隐藏 # 资源选择按钮 */}
      {/* <button
        onClick={onHashClick}
        className={buttonClass}
        title="选择资源"
      >
        #
      </button> */}
    </div>
  )
}

export default ModelSelectButton
