import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, RadioGroup, FormControlLabel, Radio, Card, Alert, IconButton, Box } from '@mui/material'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface ComparisonGroup {
  id: number
  isBaseGroup: boolean
  prompt: any
  modelConfig: any
  parameters: any[]
  messages: any[]
  messageInputValues: any
  chatMessages: any[]
}

export interface ExitComparisonDialogProps {
  open: boolean
  comparisonGroups: ComparisonGroup[]
  onClose: () => void
  onExit: (selectedGroupId: 'none' | number) => void
}

const ExitComparisonDialog: React.FC<ExitComparisonDialogProps> = ({ open, comparisonGroups, onClose, onExit }) => {
  const { t } = useTranslation()
  const [selectedExitGroup, setSelectedExitGroup] = useState<'none' | number>('none')

  const handleClose = () => {
    setSelectedExitGroup('none')
    onClose()
  }

  const handleExit = () => {
    onExit(selectedExitGroup)
    setSelectedExitGroup('none')
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="span">
            {t('components.prompts.exitComparisonDialog.title')}
          </Typography>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <X className="w-5 h-5" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <div className="space-y-4 py-4">
          <Typography variant="body1" className="text-gray-700">
            {t('components.prompts.exitComparisonDialog.description')}
          </Typography>

          {/* 组选择区域 */}
          <div className="space-y-3">
            <Typography variant="h6" className="text-gray-800 font-medium">
              {t('components.prompts.exitComparisonDialog.selectContent')}
            </Typography>

            <RadioGroup value={selectedExitGroup} onChange={e => setSelectedExitGroup(e.target.value === 'none' ? 'none' : parseInt(e.target.value))}>
              {/* 保持当前内容不变选项 */}
              <div
                className={`p-3 border-2 rounded-lg cursor-pointer transition-all mb-4 ${
                  selectedExitGroup === 'none' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedExitGroup('none')}
              >
                <FormControlLabel
                  value="none"
                  control={<Radio className={selectedExitGroup === 'none' ? 'text-blue-600' : ''} />}
                  label={
                    <div>
                      <Typography variant="subtitle1" className="font-medium text-gray-800">
                        {t('components.prompts.exitComparisonDialog.keepCurrent')}
                      </Typography>
                      <Typography variant="body2" className="text-gray-600">
                        {t('components.prompts.exitComparisonDialog.keepCurrentDescription')}
                      </Typography>
                    </div>
                  }
                />
              </div>

              {/* 各个组的选项 */}
              {comparisonGroups.map((group, index) => (
                <div
                  key={group.id}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedExitGroup === group.id
                      ? group.isBaseGroup
                        ? 'border-green-500 bg-green-50'
                        : 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${index < comparisonGroups.length - 1 ? 'mb-4' : ''}`}
                  onClick={() => setSelectedExitGroup(group.id)}
                >
                  <FormControlLabel
                    value={group.id}
                    control={<Radio className={group.isBaseGroup ? 'text-green-600' : 'text-orange-600'} />}
                    label={
                      <div>
                        <Typography variant="subtitle1" className="font-medium text-gray-800">
                          {group.isBaseGroup ? t('components.prompts.exitComparisonDialog.baseGroup') : t('components.prompts.exitComparisonDialog.controlGroup', { number: group.id })}
                        </Typography>
                        <Typography variant="body2" className="text-gray-600">
                          {group.isBaseGroup 
                            ? t('components.prompts.exitComparisonDialog.useBaseGroupDescription')
                            : t('components.prompts.exitComparisonDialog.useControlGroupDescription', { number: group.id })}
                        </Typography>
                      </div>
                    }
                  />
                </div>
              ))}
            </RadioGroup>

            {/* 警告提示 */}
            {selectedExitGroup !== 'none' && (
              <Alert severity="warning">
                <Typography variant="body2">
                  <strong>{t('components.prompts.exitComparisonDialog.warning')}</strong>{t('components.prompts.exitComparisonDialog.warningDescription')}
                </Typography>
                <ul className="list-disc list-inside mt-2 text-sm">
                  <li>{t('components.prompts.exitComparisonDialog.overwritePrompt')}</li>
                  <li>{t('components.prompts.exitComparisonDialog.overwriteVariables')}</li>
                  <li>{t('components.prompts.exitComparisonDialog.overwriteModel')}</li>
                  <li>{t('components.prompts.exitComparisonDialog.overwriteTools')}</li>
                  <li>{t('components.prompts.exitComparisonDialog.appendChatHistory')}</li>
                </ul>
              </Alert>
            )}
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          {t('components.prompts.exitComparisonDialog.cancel')}
        </Button>
        <Button onClick={handleExit} variant="contained" color="primary">
          {selectedExitGroup === 'none' ? t('components.prompts.exitComparisonDialog.exitDirectly') : t('components.prompts.exitComparisonDialog.overwriteAndExit')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ExitComparisonDialog
