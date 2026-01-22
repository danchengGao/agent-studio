import React from 'react'
import { TextField, Button } from '@mui/material'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ComparisonGroupData } from '@/types/promptType'
import { handleInputEnterKey } from '@/utils/prompts/utils'

export interface DebugInputAreaGroupProps {
  comparisonInputMessage: string
  onInputChange: (value: string) => void
  onSend: () => void
  onClear: () => void
  comparisonGroupsData: ComparisonGroupData[]
}

const DebugInputAreaGroup: React.FC<DebugInputAreaGroupProps> = ({ comparisonInputMessage, onInputChange, onSend, onClear, comparisonGroupsData }) => {
  const { t } = useTranslation()

  const isProcessing = comparisonGroupsData.find(g => g.id === 0)?.isProcessing || false || comparisonGroupsData.some(g => g.isProcessing)

  return (
    <div className="p-2 bg-white border border-gray-200 shadow-sm">
      <div className="relative">
        <TextField
          fullWidth
          multiline
          rows={2}
          placeholder={t('prompts.promptEdit.comparisonMode.comparisonInputPlaceholder')}
          value={comparisonInputMessage}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleInputEnterKey(false, onInputChange, onSend) as React.KeyboardEventHandler<HTMLDivElement>}
          disabled={isProcessing}
          sx={{
            backgroundColor: 'white',
            '& .MuiOutlinedInput-root': {
              fontSize: '14px',
              '& fieldset': {
                borderColor: '#e5e7eb',
              },
              '&:hover fieldset': {
                borderColor: '#d1d5db',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#16a34a',
              },
              '& textarea': {
                resize: 'none',
                overflow: 'auto',
              },
            },
          }}
        />
        <div className="flex justify-between items-center" style={{ marginTop: '8px', marginBottom: '0px' }}>
          <Button size="small" startIcon={<Trash2 className="w-3 h-3" />} onClick={onClear} className="text-gray-600 hover:bg-gray-50 text-xs">
            {t('prompts.promptEdit.comparisonMode.clearAll')}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onSend}
            disabled={isProcessing}
            startIcon={
              isProcessing ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              ) : (
                <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )
            }
            sx={{
              background: 'linear-gradient(to right, #16a34a, #15803d)',
              '&:hover': {
                background: 'linear-gradient(to right, #15803d, #166534)',
              },
              fontSize: '12px',
              padding: '4px 12px',
            }}
          >
            {t('prompts.promptEdit.promptDebug.send')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DebugInputAreaGroup
