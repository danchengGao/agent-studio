import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Save, Copy, GitBranch, Code, Sparkles, Edit } from 'lucide-react'
import { Button, Typography, IconButton } from '@mui/material'
import { ConditionalTooltip } from './index'
import { formatDraftDateTime } from '@/utils/prompts/utils'
import type { ComparisonGroupData } from '@/types/promptType'

export interface PromptEditHeaderProps {
  isNew: boolean
  prompt: {
    name: string
    description: string
  }
  loading: boolean
  isReadOnlyMode: boolean
  onOpenEditInfoDialog: () => void
  isNewPromptScenario: boolean
  isDraftEdited: boolean
  draftSavedTime: Date | null
  latestVersion: string
  isComparisonMode: boolean
  onEnterComparisonMode: () => void
  onNavigateToOptimization: () => void
  onOpenVersionHistory: () => void
  onSubmitVersion: () => void
  onExitComparison: () => void
  comparisonGroupsData: ComparisonGroupData[]
  onAddControlGroup: () => void
}

const PromptEditHeader: React.FC<PromptEditHeaderProps> = ({
  isNew,
  prompt,
  loading,
  isReadOnlyMode,
  onOpenEditInfoDialog,
  isNewPromptScenario,
  isDraftEdited,
  draftSavedTime,
  latestVersion,
  isComparisonMode,
  onEnterComparisonMode,
  onNavigateToOptimization,
  onOpenVersionHistory,
  onSubmitVersion,
  onExitComparison,
  comparisonGroupsData,
  onAddControlGroup,
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex items-center bg-white/60 backdrop-blur-sm p-4 border border-gray-200/60 shadow-sm">
      <IconButton
        onClick={() => navigate('/dashboard/prompts')}
        className="hover:bg-gray-100/80 transition-colors duration-200"
        sx={{
          '&:hover': {
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            transform: 'translateX(-2px)',
          },
          transition: 'all 0.2s ease',
        }}
      >
        <ArrowLeft className="w-5 h-5 text-gray-600" />
      </IconButton>
      <div className="flex items-center gap-3 flex-1 min-w-0 ml-4">
        <div className="min-w-0" style={{ maxWidth: '50%' }}>
          <ConditionalTooltip title={isNew ? t('prompts.promptEdit.header.createPrompt') : prompt.name || t('prompts.promptEdit.header.promptName')}>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent truncate cursor-pointer">
              {isNew ? t('prompts.promptEdit.header.createPrompt') : prompt.name || t('prompts.promptEdit.header.promptName')}
            </h1>
          </ConditionalTooltip>
          <ConditionalTooltip
            title={isNew ? t('prompts.promptEdit.header.createDescription') : prompt.description || t('prompts.promptEdit.header.promptDescription')}
          >
            <p className="text-gray-600 mt-1 truncate cursor-pointer">
              {isNew ? t('prompts.promptEdit.header.createDescription') : prompt.description || t('prompts.promptEdit.header.promptDescription')}
            </p>
          </ConditionalTooltip>
        </div>
        <IconButton
          onClick={onOpenEditInfoDialog}
          className="text-blue-600 hover:bg-blue-50 flex-shrink-0"
          title={t('prompts.promptEdit.header.editBasicInfo')}
          disabled={loading || isReadOnlyMode}
        >
          <Edit className="w-5 h-5" />
        </IconButton>
      </div>

      <div className="flex items-center space-x-6">
        <div
          className={`flex items-center space-x-3 transition-opacity ${isReadOnlyMode ? 'opacity-60' : 'opacity-100'}`}
          style={{ pointerEvents: isReadOnlyMode ? 'none' : 'auto' }}
        >
          {/* 状态信息 - 只有在非新建场景或用户已编辑时才显示 */}
          {(!isNewPromptScenario || isDraftEdited) && (
            <div className="flex items-center space-x-4 mr-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isDraftEdited ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                <Typography variant="body2" className={`text-sm font-medium ${isDraftEdited ? 'text-orange-600' : 'text-green-600'}`}>
                  {isDraftEdited ? t('prompts.promptEdit.header.modifiedNotSubmitted') : t('prompts.promptEdit.header.submitted')}
                </Typography>
              </div>

              {/* 根据状态显示不同信息 */}
              {isDraftEdited
                ? draftSavedTime && (
                    <div className="flex items-center space-x-2">
                      <Typography variant="body2" className="text-gray-500 text-sm">
                        {t('prompts.promptEdit.header.draftSavedTime')}: {formatDraftDateTime(draftSavedTime)}
                      </Typography>
                    </div>
                  )
                : latestVersion && (
                    <div className="flex items-center space-x-2">
                      <Typography variant="body2" className="text-gray-500 text-sm">
                        {t('prompts.promptEdit.header.latestVersion')}: {latestVersion}
                      </Typography>
                    </div>
                  )}
            </div>
          )}

          {!isComparisonMode ? (
            <>
              <Button
                variant="outlined"
                startIcon={<Code />}
                onClick={onEnterComparisonMode}
                sx={{
                  borderColor: '#e5e7eb',
                  color: '#6b7280',
                  '&:hover': {
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.05)',
                    color: '#f97316',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.15)',
                  },
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500,
                }}
              >
                {t('prompts.promptEdit.header.enterComparisonMode')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Sparkles />}
                onClick={onNavigateToOptimization}
                sx={{
                  borderColor: '#e5e7eb',
                  color: '#6b7280',
                  '&:hover': {
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.05)',
                    color: '#a855f7',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.15)',
                  },
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500,
                }}
              >
                {t('prompts.promptEdit.header.promptOptimization')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<GitBranch />}
                onClick={onOpenVersionHistory}
                sx={{
                  borderColor: '#e5e7eb',
                  color: '#6b7280',
                  '&:hover': {
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    color: '#10b981',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
                  },
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500,
                }}
              >
                {t('prompts.promptEdit.header.versionHistory')}
              </Button>

              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={onSubmitVersion}
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 8px 25px rgba(59, 130, 246, 0.3)',
                  },
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                }}
              >
                {t('prompts.promptEdit.header.submitNewVersion')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                startIcon={<ArrowLeft />}
                onClick={onExitComparison}
                sx={{
                  borderColor: '#e5e7eb',
                  color: '#6b7280',
                  '&:hover': {
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    color: '#3b82f6',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                  },
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500,
                }}
              >
                {t('prompts.promptEdit.header.exitComparison')}
              </Button>
              <Button
                variant="contained"
                startIcon={<Copy />}
                onClick={onAddControlGroup}
                disabled={comparisonGroupsData.length >= 3}
                sx={{
                  background:
                    comparisonGroupsData.length >= 3
                      ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
                  },
                  '&:disabled': {
                    background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)',
                    color: '#6b7280',
                  },
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                }}
              >
                增加对照组 ({comparisonGroupsData.length - 1}/2)
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PromptEditHeader
