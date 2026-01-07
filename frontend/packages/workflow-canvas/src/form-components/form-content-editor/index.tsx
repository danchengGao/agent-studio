/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'
import { Switch } from '@douyinfe/semi-ui'

import { IFlowTemplateValue, PromptEditorWithInputs } from '../../form-materials'
import { FormItem } from '../../form-components'
import { useIsSidebar } from '../../hooks'
import { useTranslation } from '../../i18n'

interface FormContentEditorProps {
  label?: string
  fieldPrefix?: string
  defaultCollapsed?: boolean
}

export function FormContentEditor({ label, fieldPrefix = 'inputs', defaultCollapsed }: FormContentEditorProps) {
  const { t } = useTranslation()
  const displayLabel = label || t('workflowCanvas.formContentEditor.outputContent')
  const isSidebar = useIsSidebar()

  if (!isSidebar) {
    return null
  }

  return (
    <Field<Record<string, any> | undefined> name={`${fieldPrefix}.inputParameters`}>
      {({ field: inputParametersField }) => {
        // Convert inputParameters to the format expected by PromptEditorWithInputs
        const inputsValues = inputParametersField.value || {}

        return (
          <>
            <FormItem
              name={displayLabel}
              vertical
              defaultCollapsed={defaultCollapsed}
              customComponent={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>{t('workflowCanvas.formContentEditor.streamingOutput')}</span>
                  <Field<boolean> name={`${fieldPrefix}.streaming`}>
                    {({ field }) => (
                      <Switch
                        checked={field.value ?? false}
                        onChange={field.onChange}
                        size="small"
                        style={
                          {
                            '--semi-color-success': '#1890ff',
                            '--semi-color-success-hover': '#40a9ff',
                            '--semi-color-success-active': '#096dd9',
                          } as React.CSSProperties
                        }
                      />
                    )}
                  </Field>
                </div>
              }
            >
              <Field<IFlowTemplateValue> name={`${fieldPrefix}.content`}>
                {({ field }) => (
                  <PromptEditorWithInputs
                    disableMarkdownHighlight={false}
                    style={{ flexGrow: 4 }}
                    onChange={value => field.onChange(value as any)}
                    value={field.value}
                    inputsValues={inputsValues}
                  />
                )}
              </Field>
            </FormItem>
          </>
        )
      }}
    </Field>
  )
}
