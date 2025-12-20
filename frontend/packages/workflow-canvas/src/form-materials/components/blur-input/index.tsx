/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react'

import { Input } from '@douyinfe/semi-ui'

import { validateVariableName } from '../../validate'

type InputProps = React.ComponentPropsWithRef<typeof Input> & {
  validateVariable?: boolean
}

export function BlurInput(props: InputProps) {
  const { validateVariable, ...restProps } = props
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    setValue(props.value as string)
  }, [props.value])

  const validateValue = (val: string) => {
    if (validateVariable) {
      const result = validateVariableName(val)
      if (!result.isValid) {
        setError(result.message || '变量名格式不正确')
        return false
      } else {
        setError('')
        return true
      }
    }
    return true
  }

  return (
    <div className="blur-input-wrapper">
      <Input
        ref={props.ref}
        {...restProps}
        value={value}
        validateStatus={error ? 'error' : undefined}
        onChange={val => {
          setValue(val)
          // 实时清除错误，但只有失焦时才校验
          if (error && validateVariable) {
            setError('')
          }
        }}
        onBlur={e => {
          if (validateVariable) {
            if (validateValue(value)) {
              props.onChange?.(value, e)
            }
          } else {
            props.onChange?.(value, e)
          }
          props.onBlur?.(e)
        }}
      />
      {error && (
        <div
          style={{
            color: '#d91a1a',
            fontSize: '12px',
            marginTop: '4px',
            lineHeight: '1.2',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
