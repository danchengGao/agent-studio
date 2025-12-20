import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, X, Sparkles, Edit3, Bot, Loader2 } from 'lucide-react'
import { TextField, Button, Typography, Card, Alert, IconButton, InputAdornment, Divider } from '@mui/material'
import UnifiedSnackbar, { SnackbarMessage } from '../../Common/UnifiedSnackbar'
import { useCreateAgent } from '@test-agentstudio/api-client'
import { CreateAgentRequest } from '@test-agentstudio/api-client'
import { useAuthStore } from '../../stores/useAuthStore'
import { ENV_CONFIG } from '../../config/environment'

interface AgentEntryData {
  editMode: 'manual' | 'ai'
  name: string
  description: string
  icon: string
}

const AgentEditorEntryPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [agentData, setAgentData] = useState<AgentEntryData>({
    editMode: 'manual',
    name: '',
    description: '',
    icon: '🤖',
  })

  const [errors, setErrors] = useState<Partial<AgentEntryData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<SnackbarMessage>({ open: false, message: '', severity: 'success' })

  // 使用React Query的mutation hook
  const createAgentMutation = useCreateAgent()

  // Predefined icon options
  const iconOptions = ['🤖', '🧠', '💡', '🔧', '📊', '💬', '🎯', '🚀', '🌟', '⚡', '🎨', '📝', '🔍', '💻', '🌍', '💰', '🏥', '🎓', '🏠', '🛒']

  const validateForm = (): boolean => {
    const newErrors: Partial<AgentEntryData> = {}

    if (!agentData.name.trim()) {
      newErrors.name = t('agents.agentEntry.form.nameRequired')
    }

    if (!agentData.description.trim()) {
      newErrors.description = t('agents.agentEntry.form.descriptionRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  const getDefaultSpaceId = () => {
    return user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID
  }
  const handleConfirm = async () => {
    if (!validateForm()) return

    setIsLoading(true)

    try {
      // 构建API请求体
      const createAgentRequest: CreateAgentRequest = {
        space_id: getDefaultSpaceId(), // TODO: 从应用状态获取实际的space_id
        agent_name: agentData.name,
        description: agentData.description,
        icon: agentData.icon ? agentData.icon : undefined,
      }

      // 调用API创建智能体
      const response = await createAgentMutation.mutateAsync(createAgentRequest)

      if (response.code === 0 || response.code === 200) {
        // // Mock API call to get agent info
        setSnackbar({ open: true, message: t('agents.agentEntry.messages.createSuccess'), severity: 'success' })

        // Wait for the snackbar to be visible before navigating
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Navigate to the main editor page with the complete agent info
        navigate(`/dashboard/agents/${response.data.agent_id}`, {
          state: {
            agentEntryData: agentData,
            isNew: true,
            botId: response.data.agent_id,
            // agentInfo: mockAgentInfoResponse.data.agent_info,
            // agentOptionData: mockAgentInfoResponse.data.agent_option_info
          },
        })
      } else {
        setSnackbar({
          open: true,
          message: `${t('agents.agentEntry.messages.createFailed')}: ${response.message || t('agents.agentEntry.messages.unknownError')}`,
          severity: 'error',
        })
      }
    } catch (error) {
      console.error('API调用失败:', error)

      // API调用失败时显示错误信息
      setSnackbar({ open: true, message: t('agents.agentEntry.messages.createErrorRetry'), severity: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/dashboard/agents')
  }

  const handleIconSelect = (icon: string) => {
    setAgentData(prev => ({ ...prev, icon }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Button
            variant="outlined"
            startIcon={<ArrowLeft />}
            onClick={handleCancel}
            className="border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            {t('agents.agentEntry.return')}
          </Button>
        </div>

        {/* Main content */}
        <Card className="shadow-xl border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4">
            <div className="flex items-center justify-center space-x-2">
              <Bot className="w-6 h-6 text-white" />
              <Typography variant="h5" className="text-white font-semibold">
                {t('agents.agentEntry.title')}
              </Typography>
            </div>
          </div>

          <div className="p-8">
            <div className="space-y-10">
              {/* Edit Mode Selection */}
              <div className="mb-8">
                <div className="grid grid-cols-2 gap-6">
                  {/* Manual Edit Card */}
                  <div
                    onClick={() => setAgentData(prev => ({ ...prev, editMode: 'manual' }))}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:scale-105 ${
                      agentData.editMode === 'manual' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className={`p-3 rounded-full ${agentData.editMode === 'manual' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <Edit3 className={`w-8 h-8 ${agentData.editMode === 'manual' ? 'text-blue-600' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <div className={`text-lg font-bold mb-1 ${agentData.editMode === 'manual' ? 'text-blue-800' : 'text-gray-800'}`}>
                          {t('agents.agentEntry.editMode.manual')}
                        </div>
                        <div className="text-sm text-gray-600 leading-relaxed">
                          {t('agents.agentEntry.editMode.manualDescription')}
                          <br />
                          {t('agents.agentEntry.editMode.manualFeatures')}
                          <br />
                          {t('agents.agentEntry.editMode.manualForAdvanced')}
                        </div>
                      </div>
                      {agentData.editMode === 'manual' && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Edit Card */}
                  <div className="p-4 border-2 rounded-xl cursor-not-allowed transition-all duration-200 border-gray-200 bg-gray-50 opacity-60">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="p-3 rounded-full bg-gray-100">
                        <Sparkles className="w-8 h-8 text-gray-400" />
                      </div>
                      <div>
                        <div className="text-lg font-bold mb-1 text-gray-500">{t('agents.agentEntry.editMode.ai')}</div>
                        <div className="text-sm text-gray-400 leading-relaxed">
                          {t('agents.agentEntry.editMode.aiDescription')}
                          <br />
                          {t('agents.agentEntry.editMode.aiSimplified')}
                          <br />
                          {t('agents.agentEntry.editMode.aiQuickStart')}
                        </div>
                        <div className="mt-3 px-3 py-1 bg-yellow-100 border border-yellow-200 rounded-full">
                          <div className="text-xs text-yellow-700 font-medium">{t('agents.agentEntry.editMode.comingSoon')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Divider className="my-6" />

              <div className="space-y-8">
                {/* Agent Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-3">
                    {t('agents.agentEntry.form.name')} <span style={{ color: 'red' }}>*</span>
                  </label>
                  <TextField
                    fullWidth
                    required
                    value={agentData.name}
                    onChange={e => setAgentData(prev => ({ ...prev, name: e.target.value }))}
                    onBlur={() => {
                      if (!agentData.name.trim()) {
                        setErrors(prev => ({ ...prev, name: '请输入智能体名称' }))
                      } else {
                        setErrors(prev => ({ ...prev, name: '' }))
                      }
                    }}
                    placeholder="例如：智能客服助手"
                    error={!!errors.name}
                    helperText={errors.name || (!agentData.name.trim() ? '为您的智能体起一个描述性的名称' : `${agentData.name.length}/100`)}
                    inputProps={{ maxLength: 100 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Bot className="text-gray-400 w-5 h-5" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </div>

                {/* Agent Description */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-3">
                    功能描述 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={4}
                    value={agentData.description}
                    onChange={e => setAgentData(prev => ({ ...prev, description: e.target.value }))}
                    onBlur={() => {
                      if (!agentData.description.trim()) {
                        setErrors(prev => ({ ...prev, description: '请输入功能描述' }))
                      } else {
                        setErrors(prev => ({ ...prev, description: '' }))
                      }
                    }}
                    placeholder="详细描述智能体的功能、用途和行为特征..."
                    error={!!errors.description}
                    helperText={errors.description || (!agentData.description.trim() ? '详细描述智能体的功能和行为' : `${agentData.description.length}/500`)}
                    inputProps={{ maxLength: 500 }}
                  />
                </div>

                {/* Agent Icon Selection */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-4">{t('agents.agentEntry.form.selectIcon')}</label>
                  <div className="grid grid-cols-10 gap-3 p-6 bg-gray-50 rounded-xl border border-gray-200">
                    {iconOptions.map((icon, index) => (
                      <IconButton
                        key={index}
                        onClick={() => handleIconSelect(icon)}
                        className={`w-14 h-14 text-2xl hover:bg-white hover:shadow-sm transition-all duration-200 ${
                          agentData.icon === icon ? 'bg-blue-100 border-2 border-blue-500 shadow-sm scale-110' : 'hover:scale-105'
                        }`}
                      >
                        {icon}
                      </IconButton>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <Typography variant="body2" className="text-gray-500">
                      {t('agents.agentEntry.form.currentSelection')}: <span className="text-2xl">{agentData.icon}</span>
                    </Typography>
                  </div>
                </div>
              </div>

              {/* AI Edit Mode Info */}
              {agentData.editMode === 'ai' && (
                <Alert severity="info" icon={<Sparkles className="w-6 h-6" />} className="border border-blue-200 bg-blue-50">
                  <Typography variant="body1" className="text-blue-800">
                    <strong>{t('agents.agentEntry.aiMode.autoGenerate')}:</strong>
                    {t('agents.agentEntry.aiMode.description')}
                  </Typography>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-6 pt-8">
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<X />}
                  onClick={handleCancel}
                  className="px-8 py-3 text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                >
                  {t('agents.agentEntry.actions.cancel')}
                </Button>

                <Button
                  variant="contained"
                  size="large"
                  startIcon={isLoading ? <Loader2 className="animate-spin" /> : <Check />}
                  onClick={handleConfirm}
                  disabled={!agentData.name.trim() || !agentData.description.trim() || isLoading}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-sm hover:shadow-xl transition-all duration-200"
                >
                  {isLoading ? t('agents.agentEntry.actions.creating') : t('agents.agentEntry.actions.confirm')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-12 text-center">
          <Typography variant="body2" className="text-gray-500">
            {t('agents.agentEntry.footer.text')}
          </Typography>
        </div>
      </div>

      <UnifiedSnackbar
        snackbar={snackbar}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </div>
  )
}

export default AgentEditorEntryPage
