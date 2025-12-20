import React from 'react'
import { Snackbar, Alert } from '@mui/material'

export interface SnackbarMessage {
  open: boolean
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

export interface UnifiedSnackbarProps {
  snackbar: SnackbarMessage
  onClose: () => void
  anchorOrigin?: {
    vertical: 'top' | 'bottom'
    horizontal: 'left' | 'center' | 'right'
  }
}

const UnifiedSnackbar: React.FC<UnifiedSnackbarProps> = ({ snackbar, onClose, anchorOrigin = { vertical: 'top', horizontal: 'center' } }) => {
  const { open, message, severity, duration = 3000 } = snackbar

  const handleSnackbarClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    // 允许点击关闭按钮或自动关闭，但阻止点击外部区域关闭
    if (reason === 'clickaway') {
      return
    }
    onClose()
  }

  const handleAlertClose = () => {
    // Alert 的关闭按钮点击事件
    onClose()
  }

  // 确保 message 始终是字符串，防止渲染对象导致错误
  const safeMessage = typeof message === 'string' ? message : String(message || '操作失败')

  return (
    <Snackbar open={open} autoHideDuration={duration} onClose={handleSnackbarClose} anchorOrigin={anchorOrigin}>
      <Alert severity={severity} onClose={handleAlertClose} sx={{ width: '100%' }}>
        {safeMessage}
      </Alert>
    </Snackbar>
  )
}

// 创建hook来管理snackbar状态
export const useUnifiedSnackbar = () => {
  const [snackbar, setSnackbar] = React.useState<SnackbarMessage>({
    open: false,
    message: '',
    severity: 'info',
    duration: 3000,
  })
  const showTimerRef = React.useRef<number | null>(null)

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 3000) => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    setSnackbar(prev => ({ ...prev, open: false }))
    showTimerRef.current = window.setTimeout(() => {
      // 确保 message 始终是字符串
      let safeMessage: string
      if (typeof message === 'string') {
        safeMessage = message
      } else if (message && typeof message === 'object') {
        // 如果是对象，尝试提取消息
        if (Array.isArray(message)) {
          // 如果是数组，提取第一个元素的 msg 或 message
          const firstItem = message[0]
          if (firstItem && typeof firstItem === 'object') {
            safeMessage = firstItem.msg || firstItem.message || '操作失败'
          } else {
            safeMessage = String(firstItem) || '操作失败'
          }
        } else {
          safeMessage = (message as any).msg || (message as any).message || '操作失败'
        }
      } else {
        safeMessage = String(message) || '操作失败'
      }
      setSnackbar({ open: true, message: safeMessage, severity, duration })
      showTimerRef.current = null
    }, 30)
  }

  const showSuccess = (message: string, duration?: number) => {
    showSnackbar(message, 'success', duration)
  }

  const showError = (message: string, duration?: number) => {
    showSnackbar(message, 'error', duration)
  }

  const showWarning = (message: string, duration?: number) => {
    showSnackbar(message, 'warning', duration)
  }

  const showInfo = (message: string, duration?: number) => {
    showSnackbar(message, 'info', duration)
  }

  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  React.useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { message: string | any; severity?: 'success' | 'error' | 'warning' | 'info'; duration?: number }
        if (!detail || !detail.message) return
        // 确保 message 是字符串
        const message = typeof detail.message === 'string' ? detail.message : String(detail.message)
        showSnackbar(message, detail.severity || 'error', detail.duration ?? 3000)
      } catch {
        // 忽略事件处理中的错误，避免影响其他功能
      }
    }
    window.addEventListener('global-snackbar', handler as EventListener)
    return () => window.removeEventListener('global-snackbar', handler as EventListener)
  }, [])

  return {
    snackbar,
    showSnackbar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    closeSnackbar,
    setSnackbar,
  }
}

export default UnifiedSnackbar
