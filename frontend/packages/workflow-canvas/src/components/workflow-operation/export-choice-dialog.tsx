/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Modal, Radio, Button, Typography, Tag } from '@douyinfe/semi-ui'
import { t } from '../../i18n'

export type WorkflowExportChoiceMode = 'canvas' | 'dsl'

export interface WorkflowExportChoiceDialogProps {
  visible: boolean
  defaultMode?: WorkflowExportChoiceMode
  onCancel: () => void
  onConfirm: (mode: WorkflowExportChoiceMode) => void | Promise<void>
  confirmLoading?: boolean
}

const cardBase: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  borderRadius: '10px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--semi-color-border)',
  padding: '14px 16px',
  cursor: 'pointer',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
  outline: 'none',
}

const radioGroupLayout: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
}

const optionHeaderRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minWidth: 0,
}

const cardSelected: React.CSSProperties = {
  borderColor: 'var(--semi-color-primary)',
  backgroundColor: 'var(--semi-color-primary-light-default)',
  boxShadow: '0 0 0 1px var(--semi-color-primary)',
}

function readRadioValue(e: unknown): WorkflowExportChoiceMode | null {
  if (e === 'canvas' || e === 'dsl') {
    return e
  }
  if (e && typeof e === 'object' && 'target' in e) {
    const t = (e as { target?: { value?: string } }).target?.value
    if (t === 'canvas' || t === 'dsl') {
      return t
    }
  }
  return null
}

export const WorkflowExportChoiceDialog: React.FC<WorkflowExportChoiceDialogProps> = ({
  visible,
  defaultMode = 'canvas',
  onCancel,
  onConfirm,
  confirmLoading = false,
}) => {
  const [mode, setMode] = useState<WorkflowExportChoiceMode>(defaultMode)

  useEffect(() => {
    if (visible) {
      setMode(defaultMode)
    }
  }, [visible, defaultMode])

  const onGroupChange = useCallback((e: unknown) => {
    const v = readRadioValue(e)
    if (v) {
      setMode(v)
    }
  }, [])

  const selectCanvas = useCallback(() => setMode('canvas'), [])
  const selectDsl = useCallback(() => setMode('dsl'), [])

  const modalFooter = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        width: '100%',
      }}
    >
      <Button theme="light" onClick={onCancel} disabled={confirmLoading}>
        {t('workflowCanvas.exportChoice.cancel')}
      </Button>
      <Button type="primary" theme="solid" onClick={() => void onConfirm(mode)} loading={confirmLoading}>
        {t('workflowCanvas.exportChoice.confirm')}
      </Button>
    </div>
  )

  return (
    <Modal
      title={t('workflowCanvas.exportChoice.title')}
      visible={visible}
      onCancel={onCancel}
      footer={modalFooter}
      width={520}
      maskClosable={!confirmLoading}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 16, lineHeight: 1.6 }}>
          {t('workflowCanvas.exportChoice.intro')}
        </Typography.Text>

        <Radio.Group value={mode} onChange={onGroupChange} style={radioGroupLayout}>
          <div
            role="button"
            tabIndex={0}
            onClick={selectCanvas}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                selectCanvas()
              }
            }}
            style={{
              ...cardBase,
              marginBottom: 12,
              ...(mode === 'canvas' ? cardSelected : {}),
            }}
          >
            <div style={optionHeaderRow}>
              <Radio value="canvas">
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--semi-color-text-0)' }}>
                  {t('workflowCanvas.exportChoice.canvasTitle')}
                </span>
              </Radio>
              <Tag size="small" color="green">
                {t('workflowCanvas.exportChoice.canvasNotice')}
              </Tag>
            </div>
            <Typography.Paragraph
              type="tertiary"
              size="small"
              style={{ margin: '10px 0 0 28px', marginBottom: 0, lineHeight: 1.65 }}
            >
              {t('workflowCanvas.exportChoice.canvasDesc')}
            </Typography.Paragraph>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={selectDsl}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                selectDsl()
              }
            }}
            style={{
              ...cardBase,
              ...(mode === 'dsl' ? cardSelected : {}),
            }}
          >
            <div style={optionHeaderRow}>
              <Radio value="dsl">
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--semi-color-text-0)' }}>
                  {t('workflowCanvas.exportChoice.dslTitle')}
                </span>
              </Radio>
              <Tag size="small" color="orange">
                {t('workflowCanvas.exportChoice.dslNotice')}
              </Tag>
            </div>
            <Typography.Paragraph
              type="tertiary"
              size="small"
              style={{ margin: '10px 0 0 28px', marginBottom: 0, lineHeight: 1.65 }}
            >
              {t('workflowCanvas.exportChoice.dslDesc')}
            </Typography.Paragraph>
          </div>
        </Radio.Group>

        <div
          style={{
            marginTop: 16,
            padding: '10px 12px',
            borderRadius: 8,
            backgroundColor: 'var(--semi-color-fill-0)',
            border: '1px solid var(--semi-color-border)',
          }}
        >
          <Typography.Text type="tertiary" size="small" style={{ lineHeight: 1.65 }}>
            {t('workflowCanvas.exportChoice.hint')}
          </Typography.Text>
        </div>
      </div>
    </Modal>
  )
}
