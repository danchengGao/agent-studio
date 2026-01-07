import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChangePassword } from '@test-agentstudio/api-client'
import { useAuthStore } from '../../stores/useAuthStore'
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from '@test-agentstudio/base-ui'
import { Eye, EyeOff, Key } from 'lucide-react'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const changePasswordMutation = useChangePassword()

  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.currentPassword) {
      newErrors.currentPassword = t('auth.changePassword.errors.currentPasswordRequired')
    }

    if (!formData.newPassword) {
      newErrors.newPassword = t('auth.changePassword.errors.newPasswordRequired')
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = t('auth.changePassword.errors.passwordTooShort')
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.changePassword.errors.confirmPasswordRequired')
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.changePassword.errors.passwordsNotMatch')
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = t('auth.changePassword.errors.samePassword')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      if (!user?.id) {
        console.error('用户信息不存在')
        return
      }

      await changePasswordMutation.mutateAsync({
        ...formData,
        userId: user.id
      })
      // 成功后关闭弹窗并重置表单
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setErrors({})
      onClose()
      // 这里可以添加成功提示
    } catch (error) {
      console.error('密码修改失败:', error)
      // 错误处理已经在 useChangePassword hook 中处理
    }
  }

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))

    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleClose = () => {
    // 重置表单和错误
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    setErrors({})
    onClose()
  }

  return (
    <Modal open={isOpen} onOpenChange={(open) => {
      console.log('Modal onOpenChange triggered with open:', open)
      if (!open) {
        handleClose()
      }
    }}>
      <ModalContent className="max-w-md z-[9999]">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            {t('auth.changePassword.title')}
          </ModalTitle>
          <ModalDescription>
            {t('auth.changePassword.description') || '请输入当前密码和新密码来修改您的账户密码'}
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.changePassword.currentPassword')}
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={handleInputChange('currentPassword')}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 ${
                  errors.currentPassword ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={t('auth.changePassword.currentPasswordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.currentPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.changePassword.newPassword')}
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={handleInputChange('newPassword')}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 ${
                  errors.newPassword ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={t('auth.changePassword.newPasswordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.newPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.changePassword.confirmPassword')}
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 ${
                  errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={t('auth.changePassword.confirmPasswordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <ModalFooter className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={changePasswordMutation?.isLoading}
            >
              {t('common.buttons.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={changePasswordMutation?.isLoading}
            >
              {changePasswordMutation?.isLoading ? t('common.status.loading') : t('auth.changePassword.submit')}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

export default ChangePasswordModal