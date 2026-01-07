import React from 'react'
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { Button } from '@mui/material'
import { TextField } from '@mui/material'
import { Save } from '@mui/icons-material'
import { useScopedTranslation } from '@/i18n'

export type SavePromptForm = {
  promptKey: string
  promptName: string
  promptVersion: string
  promptDesc: string
}

export type ExistingPromptInfo = {
  id: number | string
  latestVersion: string
}

interface SavePromptDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  saving: boolean
  existingPromptInfo?: ExistingPromptInfo
  saveForm: SavePromptForm
  setSaveForm: React.Dispatch<React.SetStateAction<SavePromptForm>>
}

import { isPromptKeyValid, isPromptNameValid, shouldDisableSaveConfirm, hasPromptKeyError, hasPromptNameError } from './helper/promptHelpers'
import { isVersionFormatValid, compareVersions } from './helper/promptHelpers'

const SavePromptDialog: React.FC<SavePromptDialogProps> = ({ open, onClose, onConfirm, saving, existingPromptInfo, saveForm, setSaveForm }) => {
  const [touched, setTouched] = React.useState<{ key: boolean; name: boolean; version: boolean }>({ key: false, name: false, version: false })
  const { t } = useScopedTranslation('agents.agentEditor.systemPrompt.savePromptDialog')
  const latestVersion = existingPromptInfo?.latestVersion

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pt: 1.5, pb: 1 }}>{t('title')}</DialogTitle>
      <DialogContent dividers sx={{ pt: 1.5, pb: 1.5 }}>
        <TextField
          label={t('fields.promptKeyLabel')}
          value={saveForm.promptKey}
          onChange={e => setSaveForm(s => ({ ...s, promptKey: e.target.value }))}
          onBlur={() => setTouched(t => ({ ...t, key: true }))}
          fullWidth
          size="small"
          margin="dense"
          disabled={!!existingPromptInfo}
          error={
            !existingPromptInfo &&
            (hasPromptKeyError(saveForm.promptKey, saveForm.promptName) || (saveForm.promptKey.trim() !== '' && !isPromptKeyValid(saveForm.promptKey)))
          }
          helperText={
            existingPromptInfo
              ? t('fields.promptKeyHelperExisting')
              : saveForm.promptKey.trim() !== '' && !isPromptKeyValid(saveForm.promptKey)
                ? t('fields.promptKeyHelperInvalid')
                : ''
          }
        />
        <TextField
          label={t('fields.promptNameLabel')}
          value={saveForm.promptName}
          onChange={e => setSaveForm(s => ({ ...s, promptName: e.target.value }))}
          onBlur={() => setTouched(t => ({ ...t, name: true }))}
          fullWidth
          size="small"
          margin="dense"
          disabled={!!existingPromptInfo}
          error={touched.name && hasPromptNameError(saveForm.promptName, saveForm.promptKey)}
          helperText={
            existingPromptInfo
              ? t('fields.promptNameHelperExisting')
              : !isPromptNameValid(saveForm.promptName) && saveForm.promptKey.trim() !== ''
                ? t('fields.promptNameHelperRequired')
                : ''
          }
        />
        <TextField
          label={t('fields.versionLabel')}
          value={saveForm.promptVersion}
          onChange={e => setSaveForm(s => ({ ...s, promptVersion: e.target.value }))}
          onBlur={() => setTouched(t => ({ ...t, version: true }))}
          placeholder={t('fields.versionPlaceholder')}
          fullWidth
          size="small"
          margin="dense"
          error={
            touched.version &&
            ((saveForm.promptVersion.trim() !== '' && !isVersionFormatValid(saveForm.promptVersion)) ||
              (!!existingPromptInfo?.latestVersion &&
                isVersionFormatValid(saveForm.promptVersion) &&
                compareVersions(saveForm.promptVersion, existingPromptInfo.latestVersion) <= 0))
          }
          helperText={
            !latestVersion
              ? saveForm.promptVersion.trim() !== '' && !isVersionFormatValid(saveForm.promptVersion)
                ? t('fields.versionHelperFormat')
                : ''
              : saveForm.promptVersion.trim() !== '' && !isVersionFormatValid(saveForm.promptVersion)
                ? t('fields.versionHelperFormat')
                : isVersionFormatValid(saveForm.promptVersion) && compareVersions(saveForm.promptVersion, latestVersion) <= 0
                  ? t('fields.versionHelperMustGreaterExisting', { latestVersion })
                  : t('fields.versionHelperFormatAndGreater', { latestVersion })
          }
        />
        <TextField
          label={t('fields.descLabel')}
          value={saveForm.promptDesc}
          onChange={e => setSaveForm(s => ({ ...s, promptDesc: e.target.value }))}
          fullWidth
          multiline
          minRows={4}
          size="small"
          margin="dense"
        />
      </DialogContent>
      <DialogActions sx={{ py: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          {t('actions.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          startIcon={<Save />}
          disabled={saving || shouldDisableSaveConfirm(saveForm.promptKey, saveForm.promptName, saveForm.promptVersion, existingPromptInfo?.latestVersion)}
          variant="contained"
          color="success"
        >
          {t('actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SavePromptDialog
