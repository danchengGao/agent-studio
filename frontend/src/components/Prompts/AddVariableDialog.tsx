import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  RadioGroup,
  Radio,
  IconButton,
} from '@mui/material'
import { Plus, X, Edit } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import JsonEditor from './JsonEditor'

// 数据类型定义
export type VariableDataType = 'string' | 'integer' | 'float' | 'boolean' | 'object' | 'array<string>' | 'array<integer>' | 'array<float>'

// 变量数据接口
export interface VariableData {
  name: string
  value: string
  dataType: VariableDataType
}

// 组件Props接口
export interface AddVariableDialogProps {
  open: boolean
  templateEngine: 'normal' | 'jinja2'
  existingVariableNames: string[]
  onClose: () => void
  onAdd: (variable: VariableData) => void
  // 编辑模式相关props
  isEditMode?: boolean
  editingVariable?: VariableData & { originalName?: string } // 编辑时的原始变量数据
}

const AddVariableDialog: React.FC<AddVariableDialogProps> = ({
  open,
  templateEngine,
  existingVariableNames,
  onClose,
  onAdd,
  isEditMode = false,
  editingVariable,
}) => {
  const { t } = useTranslation()
  // 内部状态
  const [variableName, setVariableName] = useState('')
  const [variableDataType, setVariableDataType] = useState<VariableDataType>('string')
  const [variableValue, setVariableValue] = useState('')
  const [nameError, setNameError] = useState('')
  const [valueError, setValueError] = useState('')

  // 编辑模式初始化
  useEffect(() => {
    if (isEditMode && editingVariable && open) {
      setVariableName(editingVariable.name)
      setVariableDataType(editingVariable.dataType)
      setVariableValue(editingVariable.value)
      setNameError('')
      setValueError('')
    } else if (!isEditMode && open) {
      // 新增模式时重置状态
      setVariableName('')
      setVariableDataType('string')
      setVariableValue('')
      setNameError('')
      setValueError('')
    }
  }, [isEditMode, editingVariable, open])

  // 验证变量名称
  const validateVariableName = (name: string): boolean => {
    // 变量名格式：字母、数字、下划线、连字符，且不能以数字开头
    const regex = /^[a-zA-Z_-][a-zA-Z0-9_-]*$/
    const maxLength = 50

    // 检查长度限制
    if (name.length > maxLength) {
      return false
    }

    return regex.test(name)
  }

  // 验证变量值格式
  const validateVariableValue = (value: string, dataType: VariableDataType): string => {
    // 在Jinja2模式下，变量值不是必填的
    if (!value.trim()) {
      if (templateEngine === 'jinja2') {
        return '' // Jinja2模式下允许空值
      }
      return t('components.prompts.addVariableDialog.valueCannotBeEmpty', { type: dataType })
    }

    switch (dataType) {
      case 'string':
        // String类型无特殊格式要求
        return ''

      case 'integer':
        if (!/^-?\d+$/.test(value.trim())) {
          return t('components.prompts.addVariableDialog.invalidInteger')
        }
        return ''

      case 'float':
        if (!/^-?\d+(\.\d+)?$/.test(value.trim())) {
          return t('components.prompts.addVariableDialog.invalidFloat')
        }
        return ''

      case 'boolean':
        if (!['true', 'false'].includes(value.toLowerCase())) {
          return t('components.prompts.addVariableDialog.invalidBoolean')
        }
        return ''

      case 'object':
        try {
          JSON.parse(value)
          return ''
        } catch {
          return t('components.prompts.addVariableDialog.invalidJsonObject')
        }

      case 'array<string>':
        try {
          const parsed = JSON.parse(value)
          if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
            return t('components.prompts.addVariableDialog.invalidStringArray')
          }
          return ''
        } catch {
          return t('components.prompts.addVariableDialog.invalidJsonArray')
        }

      case 'array<integer>':
        try {
          const parsed = JSON.parse(value)
          if (!Array.isArray(parsed) || !parsed.every(item => Number.isInteger(item))) {
            return t('components.prompts.addVariableDialog.invalidIntegerArray')
          }
          return ''
        } catch {
          return t('components.prompts.addVariableDialog.invalidJsonArray')
        }

      case 'array<float>':
        try {
          const parsed = JSON.parse(value)
          if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'number')) {
            return t('components.prompts.addVariableDialog.invalidFloatArray')
          }
          return ''
        } catch {
          return t('components.prompts.addVariableDialog.invalidJsonArray')
        }

      default:
        return ''
    }
  }

  // 获取变量值输入提示
  const getValueHelperText = (dataType: VariableDataType): string => {
    switch (dataType) {
      case 'string':
        return t('components.prompts.addVariableDialog.helperText.string')
      case 'integer':
        return t('components.prompts.addVariableDialog.helperText.integer')
      case 'float':
        return t('components.prompts.addVariableDialog.helperText.float')
      case 'boolean':
        return t('components.prompts.addVariableDialog.helperText.boolean')
      case 'object':
        return t('components.prompts.addVariableDialog.helperText.object')
      case 'array<string>':
        return t('components.prompts.addVariableDialog.helperText.arrayString')
      case 'array<integer>':
        return t('components.prompts.addVariableDialog.helperText.arrayInteger')
      case 'array<float>':
        return t('components.prompts.addVariableDialog.helperText.arrayFloat')
      default:
        return ''
    }
  }

  // 重置表单
  const resetForm = () => {
    if (!isEditMode) {
      setVariableName('')
      setVariableDataType('string')
      setVariableValue('')
    }
    setNameError('')
    setValueError('')
  }

  // 处理关闭
  const handleClose = () => {
    resetForm()
    onClose()
  }

  // 处理添加
  const handleAdd = () => {
    // 验证变量名
    if (!variableName) {
      setNameError(t('components.prompts.addVariableDialog.nameCannotBeEmpty'))
      return
    }

    if (variableName.length > 50) {
      setNameError(t('components.prompts.addVariableDialog.nameTooLong', { max: 50, current: variableName.length }))
      return
    }

    if (!validateVariableName(variableName)) {
      setNameError(t('components.prompts.addVariableDialog.invalidNameFormat'))
      return
    }

    // 检查变量名是否已存在（编辑模式下排除当前编辑的变量）
    const otherVariableNames =
      isEditMode && editingVariable ? existingVariableNames.filter(name => name !== editingVariable.originalName) : existingVariableNames

    if (otherVariableNames.includes(variableName)) {
      setNameError(t('components.prompts.addVariableDialog.nameExists'))
      return
    }

    // 验证变量值
    const valueValidationError = validateVariableValue(variableValue, variableDataType)
    if (valueValidationError) {
      setValueError(valueValidationError)
      return
    }

    // 添加变量
    onAdd({
      name: variableName,
      value: variableValue,
      dataType: variableDataType,
    })

    // 重置表单并关闭对话框
    resetForm()
    onClose()
  }

  // 处理变量名变化
  const handleNameChange = (value: string) => {
    setVariableName(value)

    // 实时验证变量名
    if (value) {
      if (value.length > 50) {
        setNameError(t('components.prompts.addVariableDialog.nameTooLong', { max: 50, current: value.length }))
      } else if (!validateVariableName(value)) {
        setNameError(t('components.prompts.addVariableDialog.invalidNameFormat'))
      } else if (existingVariableNames.includes(value)) {
        setNameError(t('components.prompts.addVariableDialog.nameExists'))
      } else {
        setNameError('')
      }
    } else {
      setNameError('')
    }
  }

  // 处理数据类型变化
  const handleDataTypeChange = (newDataType: VariableDataType) => {
    setVariableDataType(newDataType)
    // 当数据类型改变时，重新验证当前值
    setValueError(validateVariableValue(variableValue, newDataType))
    // 如果切换到boolean类型，设置默认值
    if (newDataType === 'boolean' && !['true', 'false'].includes(variableValue.toLowerCase())) {
      setVariableValue('true')
    }
  }

  // 处理变量值变化
  const handleValueChange = (value: string) => {
    setVariableValue(value)
    setValueError(validateVariableValue(value, variableDataType))
  }

  // 当模板引擎变化时，处理Array类型
  useEffect(() => {
    if (templateEngine === 'jinja2') {
      // Jinja2模式下不支持Array类型，如果当前选择的是Array类型，重置为string
      if (variableDataType.startsWith('array<')) {
        setVariableDataType('string')
        setVariableValue('')
        setValueError('')
      }
    }
  }, [templateEngine, variableDataType])

  // 当数据类型为boolean时，确保有默认值
  useEffect(() => {
    if (variableDataType === 'boolean' && !variableValue) {
      setVariableValue('true')
    }
  }, [variableDataType, variableValue])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'bg-gradient-to-br from-blue-50/50 to-indigo-50/50',
      }}
    >
      <DialogTitle className="bg-white/90 backdrop-blur-sm border-b border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isEditMode ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
              }`}
            >
              {isEditMode ? <Edit className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
            </div>
            <Typography variant="h6" className="text-gray-800 font-semibold">
              {isEditMode ? t('components.prompts.addVariableDialog.editTitle') : t('components.prompts.addVariableDialog.addTitle')}
            </Typography>
          </div>
          <IconButton onClick={handleClose} size="small" className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </IconButton>
        </div>
      </DialogTitle>

      <DialogContent className="p-6">
        <div className="space-y-4 pt-4">
          <TextField
            fullWidth
            label={t('components.prompts.addVariableDialog.nameLabel')}
            value={variableName}
            onChange={e => handleNameChange(e.target.value)}
            error={!!nameError}
            helperText={nameError || t('components.prompts.addVariableDialog.nameHelperText')}
            required
            inputProps={{ maxLength: 50 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                position: 'relative',
                '& input': {
                  paddingRight: '60px',
                },
              },
            }}
            InputProps={{
              className: 'bg-white/60',
              endAdornment: (
                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <Typography variant="caption" sx={{ color: variableName.length >= 50 ? '#ef4444' : '#6b7280', fontSize: '0.75rem' }}>
                    {variableName.length}/50
                  </Typography>
                </div>
              ),
            }}
          />

          <FormControl fullWidth>
            <InputLabel>{t('components.prompts.addVariableDialog.dataTypeLabel')}</InputLabel>
            <Select
              value={variableDataType}
              onChange={e => handleDataTypeChange(e.target.value as VariableDataType)}
              label={t('components.prompts.addVariableDialog.dataTypeLabel')}
              className="bg-white/60"
            >
              <MenuItem value="string">{t('components.prompts.addVariableDialog.dataType.string')}</MenuItem>
              <MenuItem value="integer">{t('components.prompts.addVariableDialog.dataType.integer')}</MenuItem>
              <MenuItem value="float">{t('components.prompts.addVariableDialog.dataType.float')}</MenuItem>
              <MenuItem value="boolean">{t('components.prompts.addVariableDialog.dataType.boolean')}</MenuItem>
              <MenuItem value="object">{t('components.prompts.addVariableDialog.dataType.object')}</MenuItem>
              {/* Jinja2模式下不显示Array类型 */}
              {templateEngine !== 'jinja2' && (
                <>
                  <MenuItem value="array<string>">{t('components.prompts.addVariableDialog.dataType.arrayString')}</MenuItem>
                  <MenuItem value="array<integer>">{t('components.prompts.addVariableDialog.dataType.arrayInteger')}</MenuItem>
                  <MenuItem value="array<float>">{t('components.prompts.addVariableDialog.dataType.arrayFloat')}</MenuItem>
                </>
              )}
            </Select>
          </FormControl>

          {/* 根据数据类型显示不同的输入组件 */}
          {variableDataType === 'boolean' ? (
            <FormControl component="fieldset" fullWidth>
              <Typography variant="subtitle2" className="mb-2 text-gray-700">
                {t('components.prompts.addVariableDialog.valueLabel')}
              </Typography>
              <RadioGroup
                value={variableValue}
                onChange={e => handleValueChange(e.target.value)}
                row
                className="bg-white/60 p-3 rounded border border-gray-200"
              >
                <FormControlLabel value="true" control={<Radio size="small" />} label={t('components.prompts.addVariableDialog.true')} className="mr-6" />
                <FormControlLabel value="false" control={<Radio size="small" />} label={t('components.prompts.addVariableDialog.false')} />
              </RadioGroup>
              {valueError && (
                <Typography variant="caption" className="text-red-500 mt-1">
                  {valueError}
                </Typography>
              )}
            </FormControl>
          ) : variableDataType === 'object' ? (
            <div>
              <Typography variant="subtitle2" className="mb-2 text-gray-700">
                {t('components.prompts.addVariableDialog.valueLabel')}
              </Typography>
              <JsonEditor
                value={variableValue}
                onChange={handleValueChange}
                placeholder={t('components.prompts.addVariableDialog.jsonObjectPlaceholder')}
                minHeight={100}
                maxHeight={200}
                error={!!valueError}
                helperText={valueError || getValueHelperText(variableDataType)}
              />
            </div>
          ) : (
            <TextField
              fullWidth
              label={t('components.prompts.addVariableDialog.valueLabel')}
              value={variableValue}
              onChange={e => handleValueChange(e.target.value)}
              error={!!valueError}
              helperText={valueError || getValueHelperText(variableDataType)}
              InputProps={{
                className: 'bg-white/60',
              }}
            />
          )}
        </div>
      </DialogContent>

      <DialogActions className="bg-gray-50/50 px-6 py-4 border-t border-gray-100">
        <Button onClick={handleClose} className="text-gray-600 hover:bg-gray-100">
          {t('components.prompts.addVariableDialog.cancel')}
        </Button>
        <Button
          onClick={handleAdd}
          variant="contained"
          disabled={!variableName || !!nameError || !!valueError}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
        >
          {isEditMode ? t('components.prompts.addVariableDialog.save') : t('components.prompts.addVariableDialog.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddVariableDialog
