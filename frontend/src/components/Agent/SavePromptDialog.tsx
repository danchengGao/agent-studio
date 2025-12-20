import React from 'react'
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { Button } from '@mui/material'
import { TextField } from '@mui/material'
import { Save } from '@mui/icons-material'

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
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pt: 1.5, pb: 1 }}>保存提示词</DialogTitle>
      <DialogContent dividers sx={{ pt: 1.5, pb: 1.5 }}>
        <TextField
          label="提示词 Key"
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
              ? '已有绑定关系，Key不可修改'
              : saveForm.promptKey.trim() !== '' && !isPromptKeyValid(saveForm.promptKey)
                ? '只能包含英文字母、数字、下划线（_）、连字符（-），必须以英文字母开头'
                : ''
          }
        />
        <TextField
          label="提示词名称"
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
              ? '已有绑定关系，名称不可修改'
              : !isPromptNameValid(saveForm.promptName) && saveForm.promptKey.trim() !== ''
                ? '名称不能为空'
                : ''
          }
        />
        <TextField
          label="提交版本"
          value={saveForm.promptVersion}
          onChange={e => setSaveForm(s => ({ ...s, promptVersion: e.target.value }))}
          onBlur={() => setTouched(t => ({ ...t, version: true }))}
          placeholder="如 1.0.1"
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
            !existingPromptInfo?.latestVersion
              ? saveForm.promptVersion.trim() !== '' && !isVersionFormatValid(saveForm.promptVersion)
                ? '版本号需为 x.x.x 格式'
                : ''
              : saveForm.promptVersion.trim() !== '' && !isVersionFormatValid(saveForm.promptVersion)
                ? '版本号需为 x.x.x 格式'
                : isVersionFormatValid(saveForm.promptVersion) && compareVersions(saveForm.promptVersion, existingPromptInfo.latestVersion) <= 0
                  ? `版本号必须大于已存在的版本 ${existingPromptInfo.latestVersion}`
                  : `需为 x.x.x，并且大于当前最新版本 ${existingPromptInfo.latestVersion}`
          }
        />
        <TextField
          label="版本说明"
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
          取消
        </Button>
        <Button
          onClick={onConfirm}
          startIcon={<Save />}
          disabled={saving || shouldDisableSaveConfirm(saveForm.promptKey, saveForm.promptName, saveForm.promptVersion, existingPromptInfo?.latestVersion)}
          variant="contained"
          color="success"
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SavePromptDialog
