/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useRef, useEffect } from 'react'

import { Field, FieldRenderProps } from '@flowgram.ai/free-layout-editor'
import { Typography, Input } from '@douyinfe/semi-ui'

import { Title } from './styles'
import { Feedback } from '../feedback'
const { Text } = Typography

export function TitleInput(props: { titleEdit: boolean; updateTitleEdit: (setEdit: boolean) => void; editable?: boolean }): JSX.Element {
  const { titleEdit, updateTitleEdit, editable = true } = props
  const ref = useRef<any>(null)
  const titleEditing = titleEdit
  useEffect(() => {
    if (titleEditing) {
      ref.current?.focus()
    }
  }, [titleEditing])

  return (
    <Title>
      <Field name="title">
        {({ field: { value, onChange }, fieldState }: FieldRenderProps<string>) => (
          <div style={{ minHeight: 32, display: 'flex', alignItems: 'center' }}>
            {titleEditing && editable ? (
              <Input value={value} onChange={onChange} ref={ref} onBlur={() => updateTitleEdit(false)} />
            ) : (
              <Text ellipsis={{ showTooltip: true }}>{value}</Text>
            )}
            <Feedback errors={fieldState?.errors} />
          </div>
        )}
      </Field>
    </Title>
  )
}
