/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'
import { Select } from '@douyinfe/semi-ui'

import { OutputFormat } from './type'
import { useTranslation } from '../../i18n'
import { t } from '../../i18n'

const FORMAT_OPTIONS = [
  { value: OutputFormat.TEXT, labelKey: t('workflowCanvas.nodes.llm.outputFormat.text') },
  { value: OutputFormat.MARKDOWN, labelKey: t('workflowCanvas.nodes.llm.outputFormat.markdown') },
  { value: OutputFormat.JSON, labelKey: t('workflowCanvas.nodes.llm.outputFormat.json') },
]

export function LLMOutputFormatSelector() {
  const { t } = useTranslation()

  return (
    <Field name="output_format">
      {({ field }) => (
        <Select
          value={field.value || OutputFormat.TEXT}
          onChange={value => field.onChange(value as OutputFormat)}
          placeholder={t('workflowCanvas.nodes.llm.outputFormat.placeholder')}
          optionList={FORMAT_OPTIONS.map(opt => ({
            value: opt.value,
            label: t(opt.labelKey),
          }))}
          style={{ width: 120 }}
          size="small"
        />
      )}
    </Field>
  )
}
