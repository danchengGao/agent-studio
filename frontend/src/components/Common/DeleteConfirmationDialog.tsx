import React from 'react'
import { X, Trash2, Loader2, AlertTriangle } from 'lucide-react'

export interface DeleteConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  itemType?: 'agent' | 'workflow' | 'model' | 'plugin'
  itemName?: string
  isLoading?: boolean
  title?: string
  message?: string
  confirmButtonText?: string
  cancelButtonText?: string
  iconType?: 'danger' | 'warning'
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemType,
  itemName,
  isLoading = false,
  title,
  message,
  confirmButtonText,
  cancelButtonText = '取消',
  iconType = 'danger',
}) => {
  // Default titles and messages based on item type
  const getDefaultTitle = () => {
    switch (itemType) {
      case 'agent':
        return '删除智能体'
      case 'workflow':
        return '删除工作流'
      case 'model':
        return '删除模型'
      case 'plugin':
        return '删除插件'
      default:
        return '删除确认'
    }
  }

  const getDefaultMessage = () => {
    switch (itemType) {
      case 'agent':
        return `确定要删除智能体"${itemName}"吗？此操作无法撤销。`
      case 'workflow':
        return `确定要删除工作流"${itemName}"吗？此操作无法撤销。`
      case 'model':
        return `确定要删除模型"${itemName}"吗？此操作无法撤销。`
      case 'plugin':
        return `确定要删除插件"${itemName}"吗？此操作无法撤销。`
      default:
        return `确定要删除"${itemName}"吗？此操作无法撤销。`
    }
  }

  const getDefaultConfirmButtonText = () => {
    switch (itemType) {
      case 'agent':
        return '删除智能体'
      case 'workflow':
        return '删除工作流'
      case 'model':
        return '删除模型'
      case 'plugin':
        return '删除插件'
      default:
        return '删除'
    }
  }

  const displayTitle = title || getDefaultTitle()
  const displayMessage = message || getDefaultMessage()
  const displayConfirmButtonText = confirmButtonText || getDefaultConfirmButtonText()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors" disabled={isLoading}>
          <X className="w-6 h-6" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 ${iconType === 'warning' ? 'bg-orange-100' : 'bg-red-100'} rounded-full flex items-center justify-center`}>
            {iconType === 'warning' ? <AlertTriangle className="w-8 h-8 text-orange-600" /> : <Trash2 className="w-8 h-8 text-red-600" />}
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">{displayTitle}</h3>
          <p className="text-gray-600 text-lg leading-relaxed">{displayMessage}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelButtonText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                删除中...
              </>
            ) : (
              displayConfirmButtonText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmationDialog
