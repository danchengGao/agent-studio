/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'
import { Select } from '@douyinfe/semi-ui'

import { OutputFormat } from '../llm/type'
import { useTranslation } from '../../i18n'
import { useIsSidebar } from '../../hooks'

export function ReactAgentOutputFormatSelector() {
  const { t } = useTranslation()
  const isSidebar = useIsSidebar()

  const FORMAT_OPTIONS = [
    { value: OutputFormat.TEXT, labelKey: 'workflowCanvas.nodes.llm.outputFormat.text' as const },
  ]

  const FORMAT_LABEL_MAP: Record<OutputFormat, string> = {
    [OutputFormat.TEXT]: t('workflowCanvas.nodes.llm.outputFormat.text'),
  }

  return (
    <Field name="output_format">
      {({ field }) => {
        const currentValue = field.value || OutputFormat.TEXT

        if (!isSidebar) {
          return (
            <span style={{ fontSize: '12px', color: '#999' }}>
              {FORMAT_LABEL_MAP[currentValue]}
            </span>
          )
        }

        return (
          <Select
            value={currentValue}
            onChange={value => field.onChange(value as OutputFormat)}
            placeholder={t('workflowCanvas.nodes.llm.outputFormat.placeholder')}
            optionList={FORMAT_OPTIONS.map(opt => ({
              value: opt.value,
              label: t(opt.labelKey),
            }))}
            style={{ width: 120 }}
            size="small"
          />
        )
      }}
    </Field>
  )
}
