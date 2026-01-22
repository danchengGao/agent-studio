import React from 'react'
import { TextField, Typography, Box } from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface LimitedTextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  disabled?: boolean
  fullWidth?: boolean
  variant?: 'outlined' | 'filled' | 'standard'
  label?: string
  sx?: object
  autoFocus?: boolean
  onKeyPress?: (e: React.KeyboardEvent) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  onBlur?: () => void
}

const LimitedTextInput: React.FC<LimitedTextInputProps> = ({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength = 200,
  disabled = false,
  fullWidth = true,
  variant = 'outlined',
  label,
  sx = {},
  autoFocus = false,
  onKeyPress,
  onKeyDown,
  onBlur,
}) => {
  const { t } = useTranslation()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (newValue.length <= maxLength) {
      onChange(newValue)
    }
  }

  const handleBlur = () => {
    if (onBlur) {
      onBlur()
    }
  }

  const currentLength = (value || '').length
  const isOverLimit = currentLength >= maxLength

  return (
    <TextField
      fullWidth={fullWidth}
      multiline
      rows={rows}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      variant={variant}
      disabled={disabled}
      label={label}
      autoFocus={autoFocus}
      onKeyPress={onKeyPress}
      onKeyDown={onKeyDown}
      inputProps={{ maxLength }}
      sx={{
        marginTop: '4px',
        '& .MuiInputBase-root': {
          overflow: 'hidden',
        },
        '& .MuiOutlinedInput-root': {
          position: 'relative',
          '& textarea': {
            padding: '0px',
          },
          '& fieldset': {
            borderColor: '#d1d5db',
            borderWidth: '1px',
          },
          '&:hover fieldset': {
            borderColor: '#9ca3af',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#3b82f6',
          },
        },
        ...sx,
      }}
      InputProps={{
        endAdornment: (
          <Box sx={{ position: 'absolute', right: 8, bottom: 0, pointerEvents: 'none' }}>
            <Typography
              variant="caption"
              sx={{
                color: isOverLimit ? '#ef4444' : '#6b7280',
                fontSize: '0.75rem',
              }}
            >
              {currentLength}/{maxLength}
            </Typography>
          </Box>
        ),
      }}
    />
  )
}

export default LimitedTextInput
