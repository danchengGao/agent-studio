import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, CircularProgress } from '@mui/material'
import { Rocket, Upload } from 'lucide-react'

interface PublishDialogProps {
  open: boolean
  pluginName: string
  pluginId: string
  onClose: () => void
  onPublish: (version: string, versionDesc: string) => void
  loading?: boolean
}

const PublishDialog: React.FC<PublishDialogProps> = ({ open, pluginName, pluginId, onClose, onPublish, loading = false }) => {
  const [version, setVersion] = useState('v0.0.1')
  const [versionDesc, setVersionDesc] = useState('')

  const handleSubmit = () => {
    if (!version.trim()) {
      return
    }

    if (!versionDesc.trim()) {
      return
    }

    onPublish(version.trim(), versionDesc.trim())
  }

  const handleCancel = () => {
    if (!loading) {
      setVersion('v0.0.1')
      setVersionDesc('')
      onClose()
    }
  }

  const isSubmitDisabled = loading || !version.trim() || !versionDesc.trim()

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle className="flex items-center space-x-2">
        <Rocket className="w-5 h-5 text-blue-600" />
        <span>发布插件</span>
      </DialogTitle>

      <DialogContent>
        <Box className="space-y-4">
          {/* Plugin Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <Typography variant="subtitle2" color="text.secondary" className="mb-1">
              插件名称
            </Typography>
            <Typography variant="body1" className="font-medium">
              {pluginName}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" className="mb-1 mt-2">
              插件ID
            </Typography>
            <Typography variant="body2" color="text.secondary" className="font-mono">
              {pluginId}
            </Typography>
          </div>

          {/* Version Input */}
          <div>
            <TextField
              fullWidth
              label="版本号"
              placeholder="例如: v1.0.0"
              value={version}
              onChange={e => setVersion(e.target.value)}
              disabled={loading}
              helperText="请输入版本号，推荐使用语义化版本格式 (如 v1.0.0)"
              className="mb-2"
            />
          </div>

          {/* Version Description */}
          <div>
            <TextField
              fullWidth
              label="版本描述"
              placeholder="描述此版本的更新内容..."
              value={versionDesc}
              onChange={e => setVersionDesc(e.target.value)}
              disabled={loading}
              multiline
              rows={3}
              helperText="请详细描述此版本的更新内容、新功能或修复的问题"
            />
          </div>
        </Box>
      </DialogContent>

      <DialogActions className="p-6">
        <Button onClick={handleCancel} disabled={loading} variant="outlined">
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} /> : <Upload className="w-4 h-4" />}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? '发布中...' : '确认发布'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PublishDialog
