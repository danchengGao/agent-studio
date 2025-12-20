import { Field, type FieldRenderProps } from '@flowgram.ai/free-layout-editor'

import { FormItem, FormSelect } from '../../../form-components'
import { useIsSidebar } from '../../../hooks'

interface TextEditTypeOption {
  label: string
  value: string
}

// 文本处理方式选项
const editTypeOptions: TextEditTypeOption[] = [
  { label: '字符串拼接', value: 'StringConcatenation' },
  { label: '字符串分隔', value: 'StringSplitting' },
]

export function TypeSelector() {
  const isSidebar = useIsSidebar()

  if (!isSidebar) {
    return null
  }

  return (
    <FormItem name="文本处理方式" vertical>
      <Field name="inputs.textEditorParam.editType" defaultValue="StringConcatenation">
        {({ field }: FieldRenderProps<string>) => {
          return <FormSelect value={field.value} onChange={field.onChange} options={editTypeOptions} />
        }}
      </Field>
    </FormItem>
  )
}
