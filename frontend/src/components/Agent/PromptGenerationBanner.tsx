import React from 'react'
import { Button } from '@mui/material'

export interface PromptGenerationBannerProps {
  isGenerating: boolean
  candidatePrompt: string
  readonly: boolean
  onCancel: () => void
  onAdopt: () => void
}

export const PromptGenerationBanner: React.FC<PromptGenerationBannerProps> = ({ isGenerating, candidatePrompt, readonly, onCancel, onAdopt }) => (
  <>
    {(isGenerating || candidatePrompt) && !readonly && (
      <div className="rounded-md border border-purple-200 bg-purple-50/70 px-3 py-2 flex items-center gap-3 text-sm leading-5">
        <span className="text-purple-800">{isGenerating ? '正在生成提示词...' : '已生成提示词（可预览并选择是否采纳）'}</span>
        <div className="flex-1" />
        <Button variant="outlined" size="small" color="inherit" onClick={onCancel}>
          取消
        </Button>
        <Button variant="contained" size="small" color="primary" onClick={onAdopt} disabled={isGenerating}>
          采纳
        </Button>
      </div>
    )}
  </>
)
