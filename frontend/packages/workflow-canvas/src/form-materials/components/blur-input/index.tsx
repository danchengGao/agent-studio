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
  maxBytes?: number
}

export function BlurInput(props: InputProps) {
  const { validateVariable, maxBytes, ...restProps } = props
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>('')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    setValue(props.value as string)
  }, [props.value])

  const validateValue = (val: string) => {
    if (validateVariable) {
      const result = validateVariableName(val)
      if (!result.isValid) {
        setError(result.message || '变量名格式不正确')
        return false
      }
    }
    setError('')
    return true
  }

  // 计算当前值的字节长度
  const currentByteLength = new Blob([value]).size

  return (
    <div className="blur-input-wrapper">
      <Input
        ref={props.ref}
        {...restProps}
        value={value}
        validateStatus={error ? 'error' : undefined}
        suffix={maxBytes && focused ? (
          <span style={{ fontSize: '12px', color: '#999' }}>
            {currentByteLength}/{maxBytes}
          </span>
        ) : undefined}
        onChange={val => {
          let newValue = val
          // 实时限制字节长度
          if (maxBytes !== undefined) {
            const byteLength = new Blob([val]).size
            if (byteLength > maxBytes) {
              // 截断到最大字节长度
              let truncated = ''
              for (let i = 0; i < val.length; i++) {
                const testStr = truncated + val[i]
                if (new Blob([testStr]).size <= maxBytes) {
                  truncated = testStr
                } else {
                  break
                }
              }
              newValue = truncated
            }
          }
          if (error) {
            setError('')
          }
          setValue(newValue)
        }}
        onFocus={e => {
          setFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={e => {
          setFocused(false)
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
