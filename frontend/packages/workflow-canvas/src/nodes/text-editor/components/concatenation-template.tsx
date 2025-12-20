import { Field, type FieldRenderProps } from '@flowgram.ai/free-layout-editor'

import { IFlowTemplateValue, PromptEditorWithInputs } from '../../../form-materials'
import { FormItem } from '../../../form-components'
import { useIsSidebar } from '../../../hooks'

export function ConcatenationTemplate() {
  const isSidebar = useIsSidebar()
  if (!isSidebar) {
    return null
  }

  return (
    <Field name="inputs.textEditorParam.editType">
      {({ field }: FieldRenderProps<string>) => {
        if (field.value === 'StringConcatenation') {
          return (
            <FormItem name="字符串拼接模板" vertical>
              <Field<Record<string, any> | undefined> name="inputs.inputParameters">
                {({ field: inputParametersField }) => {
                  const inputsValues = inputParametersField.value || {}
                  return (
                    <>
                      <Field<IFlowTemplateValue> name="inputs.textEditorParam.concatenateFormat">
                        {({ field }) => (
                          <PromptEditorWithInputs
                            {...({ disableMarkdownHighlight: false } as any)}
                            style={{ flexGrow: 4 }}
                            onChange={value => field.onChange(value as any)}
                            value={field.value}
                            inputsValues={inputsValues}
                          />
                        )}
                      </Field>
                    </>
                  )
                }}
              </Field>
            </FormItem>
          )
        }
        return <div />
      }}
    </Field>
  )
}
