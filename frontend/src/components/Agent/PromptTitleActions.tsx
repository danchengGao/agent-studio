import React from 'react'
import { Tooltip, IconButton } from '@mui/material'
import { MessageSquare, Settings, Upload, Sparkles } from 'lucide-react'

export interface PromptTitleActionsProps {
  readonly: boolean
  isGenerating: boolean
  candidatePrompt: string
  saving: boolean
  systemPrompt: string
  onOptimize: () => void
  onAssociate: () => void
  onSave: () => void
}

export const PromptTitleActions: React.FC<PromptTitleActionsProps> = ({
  readonly,
  isGenerating,
  candidatePrompt,
  saving,
  systemPrompt,
  onOptimize,
  onAssociate,
  onSave,
}) => (
  <>
    <Tooltip title={(readonly || isGenerating || !systemPrompt.trim()) && !systemPrompt.trim() ? '请先输入内容' : '优化提示词'} arrow>
      <span style={{ cursor: readonly || isGenerating || !systemPrompt.trim() ? 'not-allowed' : 'pointer' }}>
        <IconButton
          aria-label="优化提示词"
          onClick={onOptimize}
          disabled={readonly || isGenerating || !systemPrompt.trim()}
          size="small"
          className="border border-purple-300 text-purple-700 hover:border-purple-400 hover:bg-purple-50"
        >
          <Sparkles className="w-5 h-5" />
        </IconButton>
      </span>
    </Tooltip>
    <Tooltip title="关联提示词" arrow>
      <span style={{ cursor: readonly ? 'not-allowed' : 'pointer' }}>
        <IconButton
          aria-label="关联提示词"
          onClick={onAssociate}
          disabled={readonly}
          size="small"
          className="border border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50"
        >
          <div className="relative inline-flex">
            <MessageSquare className="w-5 h-5 text-gray-500" />
            <Settings className="w-3 h-3 text-gray-600 absolute -right-0 -bottom-0 bg-white rounded-full p-[1px] border border-gray-200" />
          </div>
        </IconButton>
      </span>
    </Tooltip>
    <Tooltip
      title={(readonly || saving || isGenerating || !!candidatePrompt || !systemPrompt.trim()) && !systemPrompt.trim() ? '请先输入内容' : '提交新版本'}
      arrow
    >
      <span style={{ cursor: readonly || saving || isGenerating || !!candidatePrompt || !systemPrompt.trim() ? 'not-allowed' : 'pointer' }}>
        <IconButton
          aria-label="提交新版本"
          onClick={onSave}
          disabled={readonly || saving || isGenerating || !!candidatePrompt || !systemPrompt.trim()}
          size="small"
          className="ml-2 border border-green-300 text-green-700 hover:border-green-400 hover:bg-green-50"
        >
          <Upload className="w-5 h-5" />
        </IconButton>
      </span>
    </Tooltip>
  </>
)
