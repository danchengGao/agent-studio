import React from 'react'
import { Tooltip, IconButton } from '@mui/material'
import { MessageSquare, Settings, Upload, Sparkles } from 'lucide-react'
import { useScopedTranslation } from '@/i18n'

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
}) => {
  const { t } = useScopedTranslation('agents.agentEditor.systemPrompt.titleActions')
  const trimmedEmpty = !systemPrompt.trim()

  const optimizeDisabled = readonly || isGenerating || trimmedEmpty
  const saveDisabled = readonly || saving || isGenerating || !!candidatePrompt || trimmedEmpty

  const needContentTooltip = t('needContent')

  return (
    <>
      <Tooltip title={optimizeDisabled && trimmedEmpty ? needContentTooltip : t('optimizePrompt')} arrow>
        <span style={{ cursor: optimizeDisabled ? 'not-allowed' : 'pointer' }}>
          <IconButton
            aria-label={t('optimizePrompt')}
            onClick={onOptimize}
            disabled={optimizeDisabled}
            size="small"
            className="border border-purple-300 text-purple-700 hover:border-purple-400 hover:bg-purple-50"
          >
            <Sparkles className="w-5 h-5" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('associatePrompt')} arrow>
        <span style={{ cursor: readonly ? 'not-allowed' : 'pointer' }}>
          <IconButton
            aria-label={t('associatePrompt')}
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
      <Tooltip title={saveDisabled && trimmedEmpty ? needContentTooltip : t('saveNewVersion')} arrow>
        <span style={{ cursor: saveDisabled ? 'not-allowed' : 'pointer' }}>
          <IconButton
            aria-label={t('saveNewVersion')}
            onClick={onSave}
            disabled={saveDisabled}
            size="small"
            className="ml-2 border border-green-300 text-green-700 hover:border-green-400 hover:bg-green-50"
          >
            <Upload className="w-5 h-5" />
          </IconButton>
        </span>
      </Tooltip>
    </>
  )
}
