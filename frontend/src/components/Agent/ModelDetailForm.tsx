import { useState, useEffect, useRef } from 'react'
import { TextField, Box, Slider, Typography, Tooltip, IconButton } from '@mui/material'
import { ModelDetail } from '../../types/agentTypes'

interface ModelDetailFormProps {
  modelDetail: ModelDetail
  onModelDetailChange: (updatedModel: ModelDetail) => void
  readonly?: boolean
}

// 定义错误状态接口
interface ValidationErrors {
  temperature?: string
  // max_tokens?: string
  top_p?: string
  timeout?: string
}

export const ModelDetailForm = (props: ModelDetailFormProps) => {
  const { modelDetail, onModelDetailChange, readonly = false } = props
  // 直接使用传入的 modelDetail，确保所有值都有定义
  // 取消ts校验
  const [localModel, setLocalModel] = useState<ModelDetail>({
    model_name: modelDetail.model_name || '',
    model_id: modelDetail.model_id || 0,
    model_type: modelDetail.model_type || '',
    model_provider: modelDetail.model_provider || '',
    temperature: modelDetail.temperature ?? 0.7,
    top_p: modelDetail.top_p ?? 0.9,
    max_tokens: modelDetail.max_tokens ?? 4000,
    timeout: modelDetail.timeout ?? 60,
    api_key: modelDetail.api_key || '',
    api_base: modelDetail.api_base || '',
    streaming: modelDetail.streaming ?? true,
    is_active: modelDetail.is_active ?? true,
  })
  const [errors, setErrors] = useState<ValidationErrors>({})

  const CORRECTION_DELAY = 500
  const correctionTimers = useRef<Partial<Record<keyof ModelDetail, number>>>({})
  useEffect(() => {
    return () => {
      Object.values(correctionTimers.current).forEach(id => {
        if (id) clearTimeout(id)
      })
    }
  }, [])

  // 字段配置 + 通用规范化/校验
  // type FieldKey = 'temperature' | 'top_p' | 'max_tokens' | 'timeout'
  type FieldKey = 'temperature' | 'top_p' | 'timeout'
  type FieldMeta = { label: string; min: number; max?: number; step?: number; decimals?: number; integerOnly?: boolean; unitSuffix?: string }
  const FIELD_META: Record<FieldKey, FieldMeta> = {
    temperature: { label: '温度', min: 0, max: 2, step: 0.1, decimals: 1 },
    top_p: { label: '核采样', min: 0, max: 1, step: 0.1, decimals: 1 },
    // max_tokens: { label: '最大输出Token数', min: 100, step: 1, integerOnly: true },
    timeout: { label: '超时时间(s)', min: 1, max: 300, step: 1, integerOnly: true },
  }

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
  const roundToStep = (value: number, step: number) => Math.round(value / step) * step

  const normalizeValue = (field: keyof ModelDetail, rawValue: any): number => {
    const meta = FIELD_META[field as keyof typeof FIELD_META]
    let v = Number(rawValue ?? 0)
    if (Number.isNaN(v)) v = 0
    if (meta.max !== undefined) {
      v = clamp(v, meta.min, meta.max)
    } else {
      v = Math.max(meta.min, v)
    }
    if (meta.integerOnly) {
      v = Math.round(v)
    } else if (meta.step) {
      v = roundToStep(v, meta.step)
      if (meta.decimals !== undefined) v = Number(v.toFixed(meta.decimals))
    }
    return v
  }

  const validateField = (field: keyof ModelDetail, value: any): string => {
    const meta = FIELD_META[field as keyof typeof FIELD_META]
    if (value === null || value === undefined || isNaN(value)) {
      return `${meta.label}不能为空`
    }
    const v = Number(value)
    if (meta.max !== undefined) {
      if (v < meta.min || v > meta.max) {
        return `${meta.label}必须在 ${meta.min}-${meta.max} 之间`
      }
    } else {
      if (v < meta.min) {
        return `${meta.label}必须大于等于 ${meta.min}${meta.unitSuffix ?? ''}`
      }
    }
    if (meta.integerOnly && !Number.isInteger(v)) {
      return `${meta.label}必须是整数`
    }
    return ''
  }

  // 当外部 modelDetail 变化时更新本地状态
  useEffect(() => {
    setLocalModel({
      model_name: modelDetail.model_name || '',
      model_id: modelDetail.model_id || 0,
      model_type: modelDetail.model_type || '',
      model_provider: modelDetail.model_provider || '',
      temperature: modelDetail.temperature ?? 0.7,
      top_p: modelDetail.top_p ?? 0.9,
      max_tokens: modelDetail.max_tokens ?? 4000,
      timeout: modelDetail.timeout ?? 60,
      api_key: modelDetail.api_key || '',
      api_base: modelDetail.api_base || '',
      streaming: modelDetail.streaming ?? true,
      is_active: modelDetail.is_active ?? true,
    })
    // 重置错误状态
    setErrors({})
  }, [modelDetail])

  // 校验函数已重构为通用版本（见上）

  // 处理字段变化 - 立即更新，确保保存时使用最新值
  const handleFieldChange = (field: keyof ModelDetail, value: any) => {
    const updatedModel = { ...localModel, [field]: value }
    setLocalModel(updatedModel)
    setErrors(prev => ({ ...prev, [field]: '' }))
    // 立即通知父组件更新，确保保存时使用最新值
    onModelDetailChange(updatedModel)
    // 延迟规范化值（不影响保存，只是UI显示）
    scheduleAutoCorrect(field, value)
  }

  // 处理失焦事件（自动纠正数值并校验）
  const handleBlur = (field: keyof ModelDetail) => {
    const value = localModel[field] as number
    // 规范化值
    const corrected = normalizeValue(field, value)
    const updatedModel = { ...localModel, [field]: corrected }
    if (corrected !== value) {
      setLocalModel(updatedModel)
      // 立即通知父组件更新规范化后的值
      onModelDetailChange(updatedModel)
    }
    const errorMessage = validateField(field, corrected)
    setErrors(prev => ({ ...prev, [field]: errorMessage }))
  }

  const scheduleAutoCorrect = (field: keyof ModelDetail, raw: any) => {
    const prev = correctionTimers.current[field]
    if (prev) clearTimeout(prev)
    correctionTimers.current[field] = window.setTimeout(() => {
      const corrected = normalizeValue(field, raw)
      const current = localModel[field] as number
      const updatedModel = { ...localModel, [field]: corrected }
      if (!Number.isNaN(corrected) && corrected !== current) {
        setLocalModel(updatedModel)
      }
      onModelDetailChange(updatedModel)
      const errorMessage = validateField(field, corrected)
      setErrors(prev => ({ ...prev, [field]: errorMessage }))
    }, CORRECTION_DELAY)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">{FIELD_META.timeout.label}</Typography>
        <TextField
          type="number"
          value={localModel.timeout}
          onChange={e => handleFieldChange('timeout', parseInt(e.target.value))}
          onBlur={() => handleBlur('timeout')}
          inputProps={{ step: 1, min: 1, max: 300 }}
          size="small"
          margin="dense"
          error={!!errors.timeout}
          disabled={readonly}
          sx={{
            '& .MuiInputBase-root.Mui-disabled': { cursor: 'not-allowed' },
            '& .MuiInputBase-input.Mui-disabled': { cursor: 'not-allowed' },
          }}
        />
      </Box>
      {errors.timeout && (
        <Typography variant="caption" color="error">
          {errors.timeout}
        </Typography>
      )}
      {/* <Box sx={{ display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">{FIELD_META.max_tokens.label}</Typography>
        <TextField
          type="number"
          value={localModel.max_tokens}
          onChange={e => handleFieldChange('max_tokens', parseInt(e.target.value))}
          onBlur={() => handleBlur('max_tokens')}
          inputProps={{ step: 100, min: 100 }}
          size="small"
          margin="dense"
          error={!!errors.max_tokens}
          disabled={readonly}
          sx={{
            '& .MuiInputBase-root.Mui-disabled': { cursor: 'not-allowed' },
            '& .MuiInputBase-input.Mui-disabled': { cursor: 'not-allowed' },
          }}
        />
      </Box> */}
      {/* {errors.max_tokens && (
        <Typography variant="caption" color="error">
          {errors.max_tokens}
        </Typography>
      )} */}
      {/* 温度 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: 180 }}>
          <Typography variant="body2">{FIELD_META.temperature.label}</Typography>
          <Tooltip
            title="temperature:控制模型生成结果的随机性与创造性。值越高，输出越随机、多样；值越低，结果越确定、保守。范围通常为0~2，推荐设置0.1~1.0。示例：0.7（平衡随机性与一致性）、1.2（更具创造性的输出）。"
            placement="top"
            arrow
          >
            <IconButton size="small" sx={{ p: 0, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <Slider
            value={localModel.temperature}
            min={0}
            max={2}
            step={0.1}
            marks={[
              { value: 0, label: '0' },
              { value: 2, label: '2' },
            ]}
            valueLabelDisplay="auto"
            onChange={(_, val) => handleFieldChange('temperature', Array.isArray(val) ? Number(val[0]) : Number(val))}
            sx={{
              width: '100%',
              my: 0,
              '& .MuiSlider-markLabel': { fontSize: 12, color: 'text.secondary', mt: -0.5 },
              '&.Mui-disabled': { cursor: 'not-allowed' },
            }}
            disabled={readonly}
          />
        </Box>
        <Box sx={{ width: 160, display: 'flex', alignItems: 'center', position: 'relative', zIndex: 2, ml: 1.5 }}>
          <TextField
            type="number"
            value={localModel.temperature}
            onChange={e => handleFieldChange('temperature', parseFloat(e.target.value))}
            onBlur={() => handleBlur('temperature')}
            inputProps={{ step: 0.1, min: 0, max: 2 }}
            size="small"
            margin="dense"
            error={!!errors.temperature}
            fullWidth
            disabled={readonly}
            sx={{
              '& .MuiInputBase-root.Mui-disabled': { cursor: 'not-allowed' },
              '& .MuiInputBase-input.Mui-disabled': { cursor: 'not-allowed' },
            }}
          />
        </Box>
      </Box>
      {errors.temperature && (
        <Typography variant="caption" color="error">
          {errors.temperature}
        </Typography>
      )}

      {/* Top P */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: 180 }}>
          <Typography variant="body2">{FIELD_META.top_p.label}</Typography>
          <Tooltip
            title="Top-p:选择累计概率达到p的最小词集合进行采样。动态调整候选词的数量，平衡输出的多样性和质量。建议：通常设置为0.9-0.95，与温度配合使用时建议只调整其中一个。"
            placement="top"
            arrow
          >
            <IconButton size="small" sx={{ p: 0, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <Slider
            value={localModel.top_p}
            min={0}
            max={1}
            step={0.1}
            marks={[
              { value: 0, label: '0' },
              { value: 1, label: '1' },
            ]}
            valueLabelDisplay="auto"
            onChange={(_, val) => handleFieldChange('top_p', Array.isArray(val) ? Number(val[0]) : Number(val))}
            sx={{
              width: '100%',
              my: 0,
              '& .MuiSlider-markLabel': { fontSize: 12, color: 'text.secondary', mt: -0.5 },
              '&.Mui-disabled': { cursor: 'not-allowed' },
            }}
            disabled={readonly}
          />
        </Box>
        <Box sx={{ width: 160, display: 'flex', alignItems: 'center', position: 'relative', zIndex: 2, ml: 1.5 }}>
          <TextField
            type="number"
            value={localModel.top_p}
            onChange={e => handleFieldChange('top_p', parseFloat(e.target.value))}
            onBlur={() => handleBlur('top_p')}
            inputProps={{ step: 0.1, min: 0, max: 1 }}
            size="small"
            margin="dense"
            error={!!errors.top_p}
            fullWidth
            disabled={readonly}
            sx={{
              '& .MuiInputBase-root.Mui-disabled': { cursor: 'not-allowed' },
              '& .MuiInputBase-input.Mui-disabled': { cursor: 'not-allowed' },
            }}
          />
        </Box>
      </Box>
      {errors.top_p && (
        <Typography variant="caption" color="error">
          {errors.top_p}
        </Typography>
      )}
    </Box>
  )
}

export default ModelDetailForm
