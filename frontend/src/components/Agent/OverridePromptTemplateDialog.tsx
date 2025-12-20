import React from 'react'
import { t } from 'i18next'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Typography } from '@mui/material'
import { AlertTriangle } from 'lucide-react'

interface OverridePromptTemplateDialogProps {
  open: boolean
  onClose: () => void
  onJump: () => void // 不覆盖直接跳转
  onOverwrite: () => void // 覆盖并跳转
}

const OverridePromptTemplateDialog: React.FC<OverridePromptTemplateDialogProps> = ({ open, onClose, onJump, onOverwrite }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <span>{t('agents.agentEditor.enhanced.previewDebug.dialogs.goToTemplateManagement')}</span>
        </div>
      </DialogTitle>
      <DialogContent>
        <div className="space-y-3">
          <Typography variant="body2">{t('agents.agentEditor.enhanced.orchestration.overwritePromptTemplateDialog')}</Typography>
          <Alert severity="warning">
            <div className="text-sm">
              <div className="font-medium">操作说明：</div>
              <ul className="list-disc list-inside mt-1">
                <li>{t('agents.agentEditor.enhanced.orchestration.overwriteAndJump')}</li>
                <li>{t('agents.agentEditor.enhanced.orchestration.notOverwriteAndJump')}</li>
              </ul>
            </div>
          </Alert>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('agents.agentEditor.enhanced.orchestration.cancel')}</Button>
        <Button variant="contained" color="primary" onClick={onJump}>
          不覆盖跳转
        </Button>
        <Button variant="contained" color="warning" startIcon={<AlertTriangle className="w-4 h-4" />} onClick={onOverwrite}>
          覆盖跳转
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default OverridePromptTemplateDialog
