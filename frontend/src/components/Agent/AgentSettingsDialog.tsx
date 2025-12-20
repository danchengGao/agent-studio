import React, { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Typography, Button, CircularProgress } from '@mui/material'

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
      <DialogTitle>编辑智能体信息</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="名称"
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
          placeholder="例如：智能客服助手"
          helperText={
            !name.trim()
              ? '请输入智能体名称'
              : name.length > NAME_MAX_LENGTH * 0.85
                ? `名称过长，请控制在${NAME_MAX_LENGTH}字符以内（当前：${name.length}/${NAME_MAX_LENGTH}）`
                : `为您的智能体起一个描述性的名称（${name.length}/${NAME_MAX_LENGTH}）`
          }
          error={!name.trim() || name.length > NAME_MAX_LENGTH}
        />
        <TextField
          label="功能描述"
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
          placeholder="详细描述智能体的功能、用途和行为特征..."
          helperText={
            description.length > DESCRIPTION_MAX_LENGTH * 0.9
              ? `描述过长，请控制在${DESCRIPTION_MAX_LENGTH}字符以内（当前：${description.length}/${DESCRIPTION_MAX_LENGTH}）`
              : `详细描述智能体的功能和行为（${description.length}/${DESCRIPTION_MAX_LENGTH}）`
          }
          error={description.length > DESCRIPTION_MAX_LENGTH}
        />

        <div className="mt-3">
          <label className="block text-sm font-bold text-gray-800 mb-4">选择图标</label>
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
              当前选择：<span className="text-2xl">{icon || '🤖'}</span>
            </Typography>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={saving || !name.trim() || name.length > NAME_MAX_LENGTH || description.length > DESCRIPTION_MAX_LENGTH}
        >
          保存
          {saving && <CircularProgress size={16} className="ml-2" />}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AgentSettingsDialog
