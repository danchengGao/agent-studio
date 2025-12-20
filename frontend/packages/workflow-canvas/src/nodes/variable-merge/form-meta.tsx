/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormRenderProps, Field, FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'
import { Select } from '@douyinfe/semi-ui'

import { IFlowValue, InputsValues, provideJsonSchemaOutputs, syncVariableTitle, DisplaySchemaTag } from '../../form-materials'
import { useScopeAvailable } from '@flowgram.ai/editor'
import { validation } from './validation'
import { FormHeader, FormContent, FormItem, FormDisplay } from '../../form-components'
import { useIsSidebar } from '../../hooks'
import { VariableGroupManager } from './components'
import { VariableMergeNodeJSON, MergeStrategy, VariableGroup } from './types'

export const VariableMergeFormRender = (props: FormRenderProps<VariableMergeNodeJSON>) => {
  const isSidebar = useIsSidebar()
  const { form } = props
  const available = useScopeAvailable()

  const transformGroupsForUI = (exportGroups: VariableGroup[]): VariableGroup[] => {
    if (!exportGroups || exportGroups.length === 0) return exportGroups || []

    let inputParameters = {}
    if (form && typeof form.getValueIn === 'function') {
      inputParameters = form.getValueIn('inputs.inputParameters') || {}
    }

    return exportGroups.map((group, groupIndex) => {
      const originalItems: string[] = []

      group.items.forEach(inputName => {
        const inputParam = (inputParameters as Record<string, any>)[inputName]
        if (inputParam && inputParam.content && Array.isArray(inputParam.content)) {
          originalItems.push(inputParam.content.join('.'))
        } else {
          originalItems.push('')
        }
      })

      return {
        name: group.name,
        type: group.type,
        items: originalItems,
      }
    })
  }

  const transformGroupsForExport = (uiGroups: VariableGroup[]): VariableGroup[] => {
    const transformedGroups: VariableGroup[] = []
    let inputCounter = 1

    uiGroups.forEach(group => {
      const transformedItems: string[] = []
      group.items.forEach(() => {
        transformedItems.push(`input${inputCounter}`)
        inputCounter++
      })

      transformedGroups.push({
        name: group.name,
        type: group.type,
        items: transformedItems,
      })
    })

    return transformedGroups
  }

  const handleNodeStructureChange = (inputParameters: Record<string, any>, outputs: Record<string, any>) => {
    if (form && typeof form.setValueIn === 'function') {
      form.setValueIn('inputs.inputParameters', inputParameters)

      form.setValueIn('outputs', {
        type: 'object',
        properties: outputs,
      })
    }
  }

  // 非sidebar模式下显示变量分组和输出
  if (!isSidebar) {
    return (
      <>
        <FormHeader />
        <FormContent>
          <Field<VariableGroup[]> name={`inputs.variableMerge`} defaultValue={[]}>
            {({ field }) => {
              const groups = field.value || []
              const displayGroups = form ? transformGroupsForUI(groups) : groups

              // 获取 inputParameters 用于检查变量引用
              const inputParameters = form ? form.getValueIn('inputs.inputParameters') || {} : {}

              return (
                <FormDisplay
                  label={'输出'}
                  content={
                    <div className="gedit-m-display-inputs-wrapper">
                      {displayGroups.map((group, index) => {
                        const hasStructuralError =
                          !group.name || group.name.trim() === '' || !group.items || !Array.isArray(group.items) || group.items.length === 0

                        let hasVariableReferenceError = false
                        const originalGroup = groups[index]

                        if (originalGroup && Array.isArray(originalGroup.items)) {
                          for (const variableName of originalGroup.items) {
                            const inputParam = inputParameters[variableName]

                            if (!inputParam || inputParam.type !== 'ref') {
                              hasVariableReferenceError = true
                              break
                            }

                            const variable = available.getByKeyPath(inputParam.content)
                            if (!variable) {
                              hasVariableReferenceError = true
                              break
                            }
                          }
                        }

                        const hasError = hasStructuralError || hasVariableReferenceError

                        return (
                          <div key={index} className="gedit-m-variable-item">
                            <DisplaySchemaTag
                              title={group.name || `Group${index + 1}`}
                              value={{ type: group.type || 'string' }}
                              showIconInTree={true}
                              warning={hasError}
                            />
                          </div>
                        )
                      })}
                    </div>
                  }
                />
              )
            }}
          </Field>
        </FormContent>
      </>
    )
  }

  return (
    <>
      <FormHeader />
      <FormContent>
        <Field<MergeStrategy> name={`inputs.mergeStrategy`}>
          {({ field }) => (
            <FormItem name="聚合策略">
              <Select style={{ width: '100%' }} value={field.value || MergeStrategy.FIRST_NON_NULL} onChange={value => field.onChange(value as MergeStrategy)}>
                <Select.Option value={MergeStrategy.FIRST_NON_NULL}>返回每个分组中第一个非空的值</Select.Option>
              </Select>
            </FormItem>
          )}
        </Field>

        <Field<VariableGroup[]> name={`inputs.variableMerge`} defaultValue={[]}>
          {({ field }) => (
            <VariableGroupManager
              groups={form ? transformGroupsForUI(field.value || []) : field.value || []}
              onGroupsChange={groups => field.onChange(form ? transformGroupsForExport(groups) : groups)}
              onNodeStructureChange={handleNodeStructureChange}
            />
          )}
        </Field>

        <Field<Record<string, IFlowValue>> name={`inputs.inputParameters`} defaultValue={{}}>
          {({ field }) => (
            <div style={{ display: 'none' }}>
              <InputsValues value={field.value} onChange={value => field.onChange(value as Record<string, IFlowValue>)} />
            </div>
          )}
        </Field>
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta = {
  render: VariableMergeFormRender,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
  },
} as FormMeta<VariableMergeNodeJSON>
