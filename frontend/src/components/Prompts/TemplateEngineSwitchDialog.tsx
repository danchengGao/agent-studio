import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'

export interface TemplateEngineSwitchDialogProps {
  open: boolean
  pendingTemplateEngine: 'normal' | 'jinja2'
  onClose: () => void
  onConfirm: () => void
}

const TemplateEngineSwitchDialog: React.FC<TemplateEngineSwitchDialogProps> = ({
  open,
  pendingTemplateEngine,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-6 h-6 text-orange-500" />
          <span>{t('components.prompts.templateEngineSwitchDialog.title')}</span>
        </div>
      </DialogTitle>
      <DialogContent>
        <div className="space-y-4 py-4">
          <Typography variant="body1" className="text-gray-700">
            {t('components.prompts.templateEngineSwitchDialog.warning')}
          </Typography>
          <Alert severity="warning">
            <Typography variant="body2" component="div">
              {pendingTemplateEngine === 'jinja2' ? (
                <>
                  {t('components.prompts.templateEngineSwitchDialog.switchToJinja2.title')}
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li>{t('components.prompts.templateEngineSwitchDialog.switchToJinja2.autoDetect')}</li>
                    <li>{t('components.prompts.templateEngineSwitchDialog.switchToJinja2.manualManage')}</li>
                    <li>{t('components.prompts.templateEngineSwitchDialog.switchToJinja2.syntaxAdjust')}</li>
                  </ul>
                </>
              ) : (
                <>
                  {t('components.prompts.templateEngineSwitchDialog.switchToNormal.title')}
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li>{t('components.prompts.templateEngineSwitchDialog.switchToNormal.autoDetect')}</li>
                    <li>{t('components.prompts.templateEngineSwitchDialog.switchToNormal.manualDelete')}</li>
                    <li>{t('components.prompts.templateEngineSwitchDialog.switchToNormal.complexSyntax')}</li>
                  </ul>
                </>
              )}
            </Typography>
          </Alert>
        </div>
      </DialogContent>
      <DialogActions className="px-6 py-4">
        <Button onClick={onClose} className="text-gray-600 hover:bg-gray-100">
          {t('components.prompts.templateEngineSwitchDialog.cancel')}
        </Button>
        <Button onClick={onConfirm} variant="contained" color="warning" startIcon={<AlertCircle className="w-4 h-4" />}>
          {t('components.prompts.templateEngineSwitchDialog.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TemplateEngineSwitchDialog
