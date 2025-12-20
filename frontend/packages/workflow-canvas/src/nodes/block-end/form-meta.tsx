/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormRenderProps, FormMeta } from '@flowgram.ai/free-layout-editor'
import { Square } from 'lucide-react'

import { FlowNodeJSON } from '../../typings'

export const renderForm = ({}: FormRenderProps<FlowNodeJSON>) => (
  <>
    <div
      style={{
        width: 60,
        height: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Square
        size={32}
        style={{
          color: '#dc2626',
          cursor: 'move',
        }}
      />
      <span
        style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#dc2626',
          marginTop: '4px',
        }}
      >
        结束
      </span>
    </div>
  </>
)

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
}
