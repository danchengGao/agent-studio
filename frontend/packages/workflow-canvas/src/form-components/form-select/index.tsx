/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Select } from '@douyinfe/semi-ui'

import './index.css'

export interface FormSelectProps {
  value?: string | string[]
  onChange?: (value: string | string[]) => void
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  multiple?: boolean
  innerBottomSlot?: React.ReactNode
}

export function FormSelect({ value, onChange, options = [], placeholder, disabled, className, style, multiple = false, innerBottomSlot }: FormSelectProps) {
  return (
    <Select
      value={value}
      onChange={onChange}
      optionList={options}
      placeholder={placeholder}
      disabled={disabled}
      className={`gedit-m-form-select ${multiple ? 'gedit-m-form-select-multiple' : ''} ${className || ''}`}
      style={style}
      multiple={multiple}
      innerBottomSlot={innerBottomSlot}
      showClear={!multiple}
    />
  )
}
