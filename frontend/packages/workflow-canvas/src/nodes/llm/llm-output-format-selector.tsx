/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'
import { Select } from '@douyinfe/semi-ui'

import { OutputFormat } from './type'
import { useTranslation } from '../../i18n'
import { t } from '../../i18n'
import { useIsSidebar } from '../../hooks'

const FORMAT_OPTIONS = [
  { value: OutputFormat.TEXT, labelKey: t('workflowCanvas.nodes.llm.outputFormat.text') },
  { value: OutputFormat.MARKDOWN, labelKey: t('workflowCanvas.nodes.llm.outputFormat.markdown') },
  { value: OutputFormat.JSON, labelKey: t('workflowCanvas.nodes.llm.outputFormat.json') },
]

const FORMAT_LABEL_MAP: Record<OutputFormat, string> = {
  [OutputFormat.TEXT]: t('workflowCanvas.nodes.llm.outputFormat.text'),
  [OutputFormat.MARKDOWN]: t('workflowCanvas.nodes.llm.outputFormat.markdown'),
  [OutputFormat.JSON]: t('workflowCanvas.nodes.llm.outputFormat.json'),
}

export function LLMOutputFormatSelector() {
  const { t } = useTranslation()
  const isSidebar = useIsSidebar()

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
