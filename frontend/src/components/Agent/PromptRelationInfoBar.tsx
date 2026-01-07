import React from 'react'
import { Tooltip, IconButton, TextField, MenuItem, Chip } from '@mui/material'
import { Unlink, ExternalLink } from 'lucide-react'
import { useScopedTranslation } from '@/i18n'

export interface PromptRelationInfoBarProps {
  currentRelation: { promptId: string; promptVersion: string; promptName: string } | null
  readonly: boolean
  safeSelectedVersion: string
  selectedVersion: string
  latestVersion?: string
  versionOptions: { id: string; version: string }[]
  versionLoading: boolean
  onVersionChange: (v: string) => void
  onOpenOverrideDialog: () => void
  onOpenUnlinkConfirm: () => void
}

export const PromptRelationInfoBar: React.FC<PromptRelationInfoBarProps> = ({
  currentRelation,
  readonly,
  safeSelectedVersion,
  selectedVersion,
  latestVersion,
  versionOptions,
  versionLoading,
  onVersionChange,
  onOpenOverrideDialog,
  onOpenUnlinkConfirm,
}) => {
  const { t } = useScopedTranslation('agents.agentEditor.systemPrompt.relationBar')

  if (!currentRelation || readonly) return null

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/70 px-3 py-1 flex items-center gap-2 text-sm leading-4">
      <Tooltip title={t('tooltipGoToTemplate')} arrow>
        <span className="inline-flex items-center gap-1 text-blue-700 cursor-pointer hover:underline" onClick={onOpenOverrideDialog}>
          <span className="font-medium">{currentRelation.promptName}</span>
          <ExternalLink className="w-3 h-3 text-blue-600" />
        </span>
      </Tooltip>
      <div className="inline-flex items-center gap-2">
        <TextField
          select
          size="small"
          margin="none"
          value={safeSelectedVersion}
          onChange={e => onVersionChange(String((e.target as any).value))}
          disabled={readonly || versionLoading || versionOptions.length === 0}
          className="w-32"
          sx={{
            m: 0,
            '& .MuiOutlinedInput-root': { height: 24, minHeight: 24, padding: 0 },
            '& .MuiSelect-select': { paddingTop: 0, paddingBottom: 0, minHeight: 'unset', lineHeight: '24px' },
            '& .MuiInputBase-input': { padding: '0 8px' },
            '& .MuiSelect-icon': { right: 6 },
            '& .MuiOutlinedInput-root.Mui-disabled': { cursor: 'not-allowed' },
            '& .MuiInputBase-input.Mui-disabled': { cursor: 'not-allowed' },
            '& .MuiSelect-select.Mui-disabled': { cursor: 'not-allowed' },
          }}
        >
          {versionOptions.map(v => (
            <MenuItem key={v.id} value={v.version}>
              {v.version || '1.0.0'}
            </MenuItem>
          ))}
        </TextField>
        {selectedVersion && latestVersion ? (
          selectedVersion === latestVersion ? (
            <Chip
              size="small"
              label={t('chipLatest')}
              color="success"
              variant="outlined"
              sx={{ borderRadius: 1, height: 24, display: 'inline-flex', alignItems: 'center' }}
            />
          ) : (
            <Tooltip title={t('tooltipHasNewVersion', { latestVersion })} arrow>
              <Chip
                size="small"
                label={t('chipHistory')}
                color="warning"
                variant="outlined"
                sx={{ borderRadius: 1, height: 24, display: 'inline-flex', alignItems: 'center' }}
              />
            </Tooltip>
          )
        ) : null}
      </div>
      <div className="flex-1" />
      <Tooltip title={t('tooltipUnlink')} arrow>
        <span style={{ cursor: readonly ? 'not-allowed' : 'pointer' }}>
          <IconButton
            aria-label={t('ariaUnlink')}
            onClick={onOpenUnlinkConfirm}
            size="small"
            className="border border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50"
            disabled={readonly}
          >
            <Unlink className="w-4 h-4" />
          </IconButton>
        </span>
      </Tooltip>
    </div>
  )
}
