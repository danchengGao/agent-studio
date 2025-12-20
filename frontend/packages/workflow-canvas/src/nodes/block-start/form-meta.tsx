/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormRenderProps, FormMeta } from '@flowgram.ai/free-layout-editor'
import { PlayCircle } from 'lucide-react'

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
      <PlayCircle
        size={32}
        style={{
          color: '#16a34a',
          cursor: 'move',
        }}
      />
      <span
        style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#16a34a',
          marginTop: '4px',
        }}
      >
        开始
      </span>
    </div>
  </>
)

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
}
