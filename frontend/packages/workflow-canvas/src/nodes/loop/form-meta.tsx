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
  IFlowValue,
  IFlowConstantRefValue,
  DisplayOutputs,
  InputsValues,
  InjectDynamicValueInput,
  DisplayInputsValues,
  IFlowRefValue,
} from '../../form-materials'
import { useTranslation } from '../../i18n'
import { provideLoopEffect, exportIntermediateVarsEffect } from './effects'

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
  const { t } = useTranslation()
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
          return t('workflowCanvas.loop.indexReserved')
        }
        const isDuplicate = allItems.some(item => item.id !== itemId && item.key === key)
        if (isDuplicate && key) {
          return t('workflowCanvas.loop.variableExists', { key })
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
  const { t } = useTranslation()
  const isSidebar = useIsSidebar()
  const { node } = useNodeRenderContext()
  const formHeight = 110

  const loopSettings = (
    <>
      <FormItem name={t('workflowCanvas.loop.loopType')} vertical>
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
                { label: t('workflowCanvas.loop.specifyCount'), value: LoopType.NUM_LOOP },
                { label: t('workflowCanvas.loop.arrayLoop'), value: LoopType.ARRAY_LOOP },
              ]}
            />
          )}
        </Field>
      </FormItem>

      <Field<LoopType> name={`inputs.loopParam.type`}>
        {({ field }) => {
          if (field.value === LoopType.NUM_LOOP) {
            return (
              <FormItem name={t('workflowCanvas.loop.loopCount')} vertical>
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
              <FormItem name={t('workflowCanvas.loop.loopArray')} vertical>
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

      <FormItem name={t('workflowCanvas.loop.intermediateVar')} vertical>
        <Field<Record<string, IFlowValue | undefined> | undefined> name="inputs.loopParam.intermediateVar">
          {({ field }) => (
            <PrivateScopeProvider>
              <InputsValues
                value={field.value}
                onChange={value => field.onChange(value)}
                onValidateKey={(key, itemId, allItems) => {
                  if (key === 'index') {
                    return t('workflowCanvas.loop.indexReserved')
                  }
                  const isDuplicate = allItems.some(item => item.id !== itemId && item.key === key)
                  if (isDuplicate && key) {
                    return t('workflowCanvas.loop.variableExists', { key })
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
                <FormItem name={t('workflowCanvas.loop.loopOutput')} vertical>
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
                <FormDisplay
                  label={t('workflowCanvas.loop.input')}
                  content={<DisplayInputsValues value={arrayField.value} node={node} includePrivateScope={true} />}
                />
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
      {({ field }) => (
        <FormDisplay
          label={t('workflowCanvas.loop.intermediateVar')}
          content={<DisplayInputsValues value={field.value} node={node} includePrivateScope={true} />}
        />
      )}
    </Field>
  )

  const outputVarDisplay = (
    <Field<Record<string, IFlowRefValue | undefined> | undefined> name={`outputs.properties`}>
      {() => <FormDisplay label={t('workflowCanvas.loop.loopOutput')} content={<DisplayOutputs displayFromScope />} />}
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
    'inputs.loopParam': [...provideLoopEffect, ...exportIntermediateVarsEffect],
  },
  plugins: [],
} as FormMeta<LoopNodeJSON>
