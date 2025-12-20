/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
import React from 'react'

import { FlowNodeJSON, Field, FormMeta } from '@flowgram.ai/free-layout-editor'
import { SubCanvasRender } from '@flowgram.ai/free-container-plugin'
import { PrivateScopeProvider, ValidateTrigger } from '@flowgram.ai/editor'
import {
  BatchOutputs,
  createBatchOutputsFormPlugin,
  IFlowValue,
  IFlowConstantRefValue,
  DisplayOutputs,
  InputsValues,
  InjectDynamicValueInput,
  provideBatchInputEffect,
  DisplayInputsValues,
  IFlowRefValue,
} from '../../form-materials'
import { provideLoopEffect } from './effects'

import { FormHeader, FormContent, FormItem, Feedback, FormSelect, FormDisplay } from '../../form-components'
import { useIsSidebar, useNodeRenderContext } from '../../hooks'
import { useObjectList } from '../../form-materials'
import { validation } from './validation'

export enum LoopType {
  ARRAY_LOOP = 'arrayLoop',
  NUM_LOOP = 'numLoop',
}

interface LoopNodeJSON extends FlowNodeJSON {
  data: {
    title?: string
    inputs?: {
      loopParam?: {
        type?: LoopType
        loopNum?: IFlowValue
        loopArray?: Record<string, IFlowValue | undefined>
        intermediateVar?: {
          result?: IFlowRefValue
          item?: IFlowRefValue
        }
      }
    }
    outputs?: {
      type: 'object'
      properties?: Record<string, unknown>
    }
  }
}

const ArrayInputsValues = ({
  value,
  onChange,
  schema,
}: {
  value?: Record<string, IFlowValue | undefined>
  onChange: (value?: Record<string, IFlowValue | undefined>) => void
  schema?: unknown
}) => {
  const { list, add } = useObjectList<IFlowValue | undefined>({
    value,
    onChange,
    sortIndexKey: 'extra.index',
  })

  React.useEffect(() => {
    const isEmpty = !value || Object.keys(value).length === 0
    if (isEmpty && list.length === 0) {
      add({
        type: 'constant',
        content: [],
        schema: { type: 'array' },
      })
    }
  }, [value, list.length, add])

  return (
    <InputsValues
      value={value}
      onChange={onChange}
      schema={schema}
      showAddButton={true}
      deleteable={true}
      onValidateKey={(key, itemId, allItems) => {
        if (key === 'index') {
          return '不允许使用 "index" 作为变量名（保留字）'
        }
        const isDuplicate = allItems.some(item => item.id !== itemId && item.key === key)
        if (isDuplicate && key) {
          return `变量名 "${key}" 已存在`
        }
        return undefined
      }}
      defaultItem={{
        type: 'constant',
        content: [],
        schema: { type: 'array' },
      }}
    />
  )
}

export const LoopFormRender = () => {
  const isSidebar = useIsSidebar()
  const { node } = useNodeRenderContext()
  const formHeight = 110

  const loopSettings = (
    <>
      {/* 循环类型选择 - 始终显示 */}
      <FormItem name="循环类型" vertical>
        <Field<LoopType> name={`inputs.loopParam.type`}>
          {({ field }) => (
            <FormSelect
              style={{ width: '100%' }}
              value={field.value || LoopType.NUM_LOOP}
              onChange={(value: string | string[]) => {
                if (typeof value === 'string') {
                  field.onChange(value as LoopType)
                }
              }}
              options={[
                { label: '指定循环次数', value: LoopType.NUM_LOOP },
                { label: '数组循环', value: LoopType.ARRAY_LOOP },
              ]}
            />
          )}
        </Field>
      </FormItem>

      <Field<LoopType> name={`inputs.loopParam.type`}>
        {({ field }) => {
          if (field.value === LoopType.NUM_LOOP) {
            return (
              <FormItem name="循环次数" vertical>
                <Field<IFlowValue> name={`inputs.loopParam.loopNum`}>
                  {({ field: numField }) => (
                    <PrivateScopeProvider>
                      <InjectDynamicValueInput
                        style={{ width: '100%' }}
                        value={numField.value as IFlowConstantRefValue}
                        onChange={value => {
                          if (value?.type === 'constant' && typeof value.content === 'number') {
                            const safeValue = Math.max(1, Math.min(1000, value.content))
                            numField.onChange({
                              ...value,
                              content: safeValue,
                            } as IFlowValue)
                          } else {
                            numField.onChange(value as IFlowValue)
                          }
                        }}
                        schema={{ type: 'integer' }}
                      />
                    </PrivateScopeProvider>
                  )}
                </Field>
              </FormItem>
            )
          }
          return <div />
        }}
      </Field>

      <Field<LoopType> name={`inputs.loopParam.type`}>
        {({ field }) => {
          if (field.value === LoopType.ARRAY_LOOP) {
            return (
              <FormItem name="循环数组" vertical>
                <Field<Record<string, IFlowValue | undefined> | undefined> name={`inputs.loopParam.loopArray`}>
                  {({ field: arrayField }) => (
                    <PrivateScopeProvider>
                      <ArrayInputsValues value={arrayField.value} onChange={value => arrayField.onChange(value)} schema={{ type: 'array' }} />
                    </PrivateScopeProvider>
                  )}
                </Field>
              </FormItem>
            )
          }
          return <div />
        }}
      </Field>

      {/* 中间变量 - 始终显示 */}
      <FormItem name={'中间变量'} vertical>
        <Field<Record<string, IFlowValue | undefined> | undefined> name="inputs.loopParam.intermediateVar">
          {({ field }) => (
            <PrivateScopeProvider>
              <InputsValues
                value={field.value}
                onChange={value => field.onChange(value)}
                onValidateKey={(key, itemId, allItems) => {
                  if (key === 'index') {
                    return '不允许使用 "index" 作为变量名（保留字）'
                  }
                  const isDuplicate = allItems.some(item => item.id !== itemId && item.key === key)
                  if (isDuplicate && key) {
                    return `变量名 "${key}" 已存在`
                  }
                  return undefined
                }}
              />
            </PrivateScopeProvider>
          )}
        </Field>
      </FormItem>

      <Field<Record<string, IFlowRefValue | undefined> | undefined> name={`outputs.properties`}>
        {({ field, fieldState }) => (
          <Field<Record<string, IFlowValue | undefined> | undefined> name={`inputs.loopParam.loopArray`}>
            {({ field: arrayField }) => {
              const loopArrayKeys = Object.keys(arrayField.value || {}).filter(key => key && key.trim() !== '')
              const skipKeys = ['index', ...loopArrayKeys]

              return (
                <FormItem name="循环输出" vertical>
                  <BatchOutputs
                    style={{ width: '100%' }}
                    value={field.value}
                    onChange={val => field.onChange(val)}
                    hasError={Object.keys(fieldState?.errors || {}).length > 0}
                    skipKeys={skipKeys}
                  />
                  <Feedback errors={fieldState?.errors} />
                </FormItem>
              )
            }}
          </Field>
        )}
      </Field>
    </>
  )

  const loopSummary = (
    <Field<LoopType> name={`inputs.loopParam.type`}>
      {({ field }) => {
        const loopType = field.value || LoopType.NUM_LOOP

        if (loopType === LoopType.NUM_LOOP) {
          return <></>
        } else if (loopType === LoopType.ARRAY_LOOP) {
          return (
            <Field<Record<string, IFlowValue | undefined> | undefined> name={`inputs.loopParam.loopArray`}>
              {({ field: arrayField }) => (
                <FormDisplay label="输入" content={<DisplayInputsValues value={arrayField.value} node={node} includePrivateScope={true} />} />
              )}
            </Field>
          )
        } else {
          return <></>
        }
      }}
    </Field>
  )

  const intermediateVarDisplay = (
    <Field<Record<string, IFlowValue | undefined> | undefined> name="inputs.loopParam.intermediateVar">
      {({ field }) => <FormDisplay label="中间变量" content={<DisplayInputsValues value={field.value} node={node} includePrivateScope={true} />} />}
    </Field>
  )

  const outputVarDisplay = (
    <Field<Record<string, IFlowRefValue | undefined> | undefined> name={`outputs.properties`}>
      {() => <FormDisplay label="循环输出" content={<DisplayOutputs displayFromScope />} />}
    </Field>
  )

  if (isSidebar) {
    return (
      <>
        <FormHeader />
        <FormContent>{loopSettings}</FormContent>
      </>
    )
  }

  return (
    <>
      <FormHeader />
      <FormContent>
        {loopSummary}
        {intermediateVarDisplay}
        {outputVarDisplay}
        <SubCanvasRender offsetY={-formHeight} />
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta = {
  render: LoopFormRender,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  effect: {
    'inputs.loopParam': provideLoopEffect,
  },
  plugins: [createBatchOutputsFormPlugin({ outputKey: 'outputs.properties' })],
} as FormMeta<LoopNodeJSON>
