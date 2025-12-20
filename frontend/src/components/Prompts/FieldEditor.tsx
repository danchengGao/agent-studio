import React from 'react'
import { Box, Typography, FormControl, Select, MenuItem, TextField } from '@mui/material'
import { FileText, Code, FileJson, FileCode } from 'lucide-react'
import JsonEditor from './JsonEditor'
import AdvancedCodeMirrorEditor from './AdvancedCodeMirrorEditor'
import CodeEditor from './CodeEditor'

export type FieldType = 'PlainText' | 'Code' | 'JSON' | 'Markdown'

interface FieldEditorProps {
  label: string
  value: string
  fieldType: FieldType
  language?: string
  placeholder?: string
  maxLength?: number
  showCharCount?: boolean
  allowedTypes?: FieldType[] // 限制可选择的类型
  disabled?: boolean // 新增：禁用编辑
  labelClassName?: string // 新增：自定义 label 样式
  labelVariant?: 'subtitle1' | 'subtitle2' | 'body1' | 'body2' | 'caption' | 'h6' // 新增：Typography variant
  hideLabel?: boolean // 新增：是否隐藏 label
  onValueChange: (value: string) => void
  onTypeChange: (type: FieldType) => void
  onLanguageChange?: (language: string) => void
}

const FieldEditor: React.FC<FieldEditorProps> = ({
  label,
  value,
  fieldType,
  language = 'javascript',
  placeholder = '请输入内容...',
  maxLength,
  showCharCount = true,
  allowedTypes = ['PlainText', 'Code', 'JSON', 'Markdown'], // 默认允许所有类型
  disabled = false, // 默认不禁用
  labelClassName = 'text-gray-700 font-semibold', // 默认样式
  labelVariant = 'subtitle2', // 默认 Typography variant
  hideLabel = false, // 默认显示 label
  onValueChange,
  onTypeChange,
  onLanguageChange,
}) => {
  // 获取字段类型图标
  const getFieldTypeIcon = (type: FieldType) => {
    switch (type) {
      case 'PlainText':
        return <FileText className="w-3 h-3" />
      case 'Code':
        return <Code className="w-3 h-3" />
      case 'JSON':
        return <FileJson className="w-3 h-3" />
      case 'Markdown':
        return <FileCode className="w-3 h-3" />
      default:
        return <FileText className="w-3 h-3" />
    }
  }

  // 渲染编辑器组件
  const renderEditor = () => {
    switch (fieldType) {
      case 'PlainText':
        return (
          <TextField
            fullWidth
            multiline
            rows={4}
            value={value}
            onChange={e => onValueChange(e.target.value)}
            placeholder={placeholder}
            variant="outlined"
            disabled={disabled}
            inputProps={maxLength ? { maxLength } : undefined}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: disabled ? '#e5e7eb' : '#3b82f6',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: disabled ? '#e5e7eb' : '#1d4ed8',
                },
              },
              '& .MuiOutlinedInput-input': {
                paddingRight: '12px',
              },
            }}
          />
        )
      case 'Code':
        return (
          <CodeEditor
            value={value}
            onChange={onValueChange}
            placeholder={placeholder}
            disabled={disabled}
            minHeight={200}
            maxHeight={300}
            maxLength={maxLength}
            language={language}
            showLanguageSelector={true}
            onLanguageChange={onLanguageChange}
          />
        )
      case 'JSON':
        return (
          <JsonEditor
            value={value}
            onChange={onValueChange}
            placeholder={placeholder}
            disabled={disabled}
            minHeight={200}
            maxHeight={300}
            maxLength={maxLength}
          />
        )
      case 'Markdown':
        return (
          <AdvancedCodeMirrorEditor
            value={value}
            onChange={onValueChange}
            placeholder={placeholder}
            disabled={disabled}
            minHeight={200}
            maxHeight={300}
            maxLength={maxLength}
          />
        )
      default:
        return null
    }
  }

  return (
    <Box className="relative">
      <div className="flex items-center justify-between mb-3">
        {!hideLabel && label && (
          <Typography variant={labelVariant} className={labelClassName}>
            {label}
          </Typography>
        )}
        {/* 类型选择器 - 只有多个类型可选时才显示 */}
        {allowedTypes.length > 1 && !disabled ? (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={fieldType}
              onChange={e => onTypeChange(e.target.value as FieldType)}
              disabled={disabled}
              sx={{ borderRadius: 2 }}
              renderValue={selected => (
                <div className="flex items-center gap-2">
                  {getFieldTypeIcon(selected)}
                  <span>{selected === 'PlainText' ? 'PlainText' : selected}</span>
                </div>
              )}
            >
              {allowedTypes.map(type => (
                <MenuItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    {getFieldTypeIcon(type)}
                    <span>{type === 'PlainText' ? 'PlainText' : type}</span>
                  </div>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          // 只有一个类型时显示类型标识
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
            {getFieldTypeIcon(fieldType)}
            <span className="text-sm text-gray-600">{fieldType === 'PlainText' ? 'PlainText' : fieldType}</span>
          </div>
        )}
      </div>
      {/* 编辑器 */}
      <div className="relative">{renderEditor()}</div>
      {/* 字符计数 (显示在编辑器外部右下角) */}
      {showCharCount && (
        <div className={`flex justify-end mt-1 mr-3 text-sm ${maxLength && value.length >= maxLength ? 'text-red-500' : 'text-gray-500'}`}>
          {value.length}
          {maxLength && `/${maxLength}`}
        </div>
      )}
    </Box>
  )
}

export default FieldEditor
