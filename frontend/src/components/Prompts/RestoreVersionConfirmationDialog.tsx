import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface RestoreVersionConfirmationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

const RestoreVersionConfirmationDialog: React.FC<RestoreVersionConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <span>{t('components.prompts.promptEditPage.revertConfirmTitle')}</span>
        </div>
      </DialogTitle>
      <DialogContent>
        <Typography>{t('components.prompts.promptEditPage.revertConfirmMessage')}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} className="text-gray-600 hover:bg-gray-50">
          {t('components.prompts.promptEditPage.cancel')}
        </Button>
        <Button onClick={onConfirm} variant="contained" className="bg-orange-500 hover:bg-orange-600">
          {t('components.prompts.promptEditPage.confirmRevert')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RestoreVersionConfirmationDialog
