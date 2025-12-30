import React from 'react'
import { Button } from '@mui/material'
import { useScopedTranslation } from '@/i18n'

export interface PromptGenerationBannerProps {
  isGenerating: boolean
  candidatePrompt: string
  readonly: boolean
  onCancel: () => void
  onAdopt: () => void
}

export const PromptGenerationBanner: React.FC<PromptGenerationBannerProps> = ({ isGenerating, candidatePrompt, readonly, onCancel, onAdopt }) => {
  const { t } = useScopedTranslation('agents.agentEditor.systemPrompt.generationBanner')
  if (!(isGenerating || candidatePrompt) || readonly) return null

  return (
    <div className="rounded-md border border-purple-200 bg-purple-50/70 px-3 py-2 flex items-center gap-3 text-sm leading-5">
      <span className="text-purple-800">{isGenerating ? t('generating') : t('generated')}</span>
      <div className="flex-1" />
      <Button variant="outlined" size="small" color="inherit" onClick={onCancel}>
        {t('cancel')}
      </Button>
      <Button variant="contained" size="small" color="primary" onClick={onAdopt} disabled={isGenerating}>
        {t('adopt')}
      </Button>
    </div>
  )
}
