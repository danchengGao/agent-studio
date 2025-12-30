import React, { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Typography, Button, CircularProgress } from '@mui/material'
import { useScopedTranslation } from '@/i18n'

interface AgentSettingsDialogProps {
  open: boolean
  initialName: string
  initialDescription: string
  initialIcon: string
  onClose: () => void
  onConfirm: (name: string, description: string, icon: string) => Promise<void> | void
  iconOptions?: string[]
}

const DEFAULT_ICON_OPTIONS = ['🤖', '🧠', '💡', '🔧', '📊', '💬', '🎯', '🚀', '🌟', '⚡', '🎨', '📝', '🔍', '💻', '🌍', '💰', '🏥', '🎓', '🏠', '🛒']

const AgentSettingsDialog: React.FC<AgentSettingsDialogProps> = ({
  open,
  initialName,
  initialDescription,
  initialIcon,
  onClose,
  onConfirm,
  iconOptions = DEFAULT_ICON_OPTIONS,
}) => {
  const { t } = useScopedTranslation('agents.settingDialog')
  const [name, setName] = useState(initialName || '')
  const [description, setDescription] = useState(initialDescription || '')
  const [icon, setIcon] = useState(initialIcon || '🤖')
  const [saving, setSaving] = useState(false)

  // 定义长度限制
  const NAME_MAX_LENGTH = 100
  const DESCRIPTION_MAX_LENGTH = 500

  useEffect(() => {
    if (open) {
      setName(initialName || '')
      setDescription(initialDescription || '')
      setIcon(initialIcon || '🤖')
    }
  }, [open, initialName, initialDescription, initialIcon])

  const handleConfirm = async () => {
    if (!name.trim()) return
    try {
      setSaving(true)
      await Promise.resolve(onConfirm(name.trim(), description, icon))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('title')}</DialogTitle>
      <DialogContent dividers>
        <TextField
          label={t('fields.name.label')}
          fullWidth
          required
          margin="dense"
          value={name}
          onChange={e => {
            const value = e.target.value
            if (value.length <= NAME_MAX_LENGTH) {
              setName(value)
            }
          }}
          placeholder={t('fields.name.placeholder')}
          helperText={
            !name.trim()
              ? t('fields.name.helper.required')
              : name.length > NAME_MAX_LENGTH * 0.85
                ? t('fields.name.helper.tooLong', { max: NAME_MAX_LENGTH, current: name.length })
                : t('fields.name.helper.normal', { max: NAME_MAX_LENGTH, current: name.length })
          }
          error={!name.trim() || name.length > NAME_MAX_LENGTH}
        />
        <TextField
          label={t('fields.description.label')}
          fullWidth
          multiline
          rows={4}
          margin="dense"
          value={description}
          onChange={e => {
            const value = e.target.value
            if (value.length <= DESCRIPTION_MAX_LENGTH) {
              setDescription(value)
            }
          }}
          placeholder={t('fields.description.placeholder')}
          helperText={
            description.length > DESCRIPTION_MAX_LENGTH * 0.9
              ? t('fields.description.helper.tooLong', { max: DESCRIPTION_MAX_LENGTH, current: description.length })
              : t('fields.description.helper.normal', { max: DESCRIPTION_MAX_LENGTH, current: description.length })
          }
          error={description.length > DESCRIPTION_MAX_LENGTH}
        />

        <div className="mt-3">
          <label className="block text-sm font-bold text-gray-800 mb-4">{t('icon.label')}</label>
          <div className="grid grid-cols-10 gap-3 p-6 bg-gray-50 rounded-xl border border-gray-200">
            {iconOptions.map((item, index) => (
              <IconButton
                key={index}
                onClick={() => setIcon(item)}
                className={`w-14 h-14 text-2xl hover:bg-white hover:shadow-sm transition-all duration-200 ${
                  icon === item ? 'bg-blue-100 border-2 border-blue-500 shadow-sm scale-110' : 'hover:scale-105'
                }`}
              >
                {item}
              </IconButton>
            ))}
          </div>
          <div className="mt-3 text-center">
            <Typography variant="body2" className="text-gray-500">
              {t('icon.current')}
              <span className="text-2xl">{icon || '🤖'}</span>
            </Typography>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('buttons.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={saving || !name.trim() || name.length > NAME_MAX_LENGTH || description.length > DESCRIPTION_MAX_LENGTH}
        >
          {t('buttons.save')}
          {saving && <CircularProgress size={16} className="ml-2" />}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AgentSettingsDialog
