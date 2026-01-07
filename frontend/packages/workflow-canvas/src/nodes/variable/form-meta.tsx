/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FieldArray, FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'
import { I18n } from '@flowgram.ai/editor'

import { AssignRows, createInferAssignPlugin, type AssignValueType } from '../../form-materials'
import { FormHeader, FormContent, FormDisplay, FormItem } from '../../form-components'
import { defaultFormMeta } from '../default-form-meta'
import { useIsSidebar } from '../../hooks'

export const FormRender = (): JSX.Element => {
  const isSidebar = useIsSidebar()

  return (
    <>
      <FormHeader />
      <FormContent>
        {isSidebar ? (
          <FormItem name={I18n.t('Settings')}>
            <AssignRows name="assign" enableDeclaration={false} />
          </FormItem>
        ) : (
          <>
            <FieldArray name="assign">
              {({ field }) => {
                // Extract all variable names from assign array
                const getVariableNames = () => {
                  const assignData = field.value as AssignValueType[]
                  if (Array.isArray(assignData) && assignData.length > 0) {
                    const variableNames: string[] = []

                    assignData.forEach(assignItem => {
                      if (
                        assignItem &&
                        assignItem.operator === 'assign' &&
                        assignItem.left &&
                        assignItem.left.type === 'ref' &&
                        Array.isArray(assignItem.left.content) &&
                        assignItem.left.content.length > 1
                      ) {
                        variableNames.push(assignItem.left.content[1])
                      }
                    })

                    return variableNames.length > 0 ? variableNames.join(', ') : I18n.t('Not configured')
                  }

                  return I18n.t('Not configured')
                }

                return <FormDisplay label={I18n.t('Settings')} content={getVariableNames()} />
              }}
            </FieldArray>
          </>
        )}
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta = {
  render: () => <FormRender />,
  effect: defaultFormMeta.effect,
  plugins: [
    createInferAssignPlugin({
      assignKey: 'assign',
      outputKey: 'outputs',
    }),
  ],
  validateTrigger: ValidateTrigger.onChange,
  validate: {
    assign: ({ value }) => {
      if (!value || !Array.isArray(value)) {
        return I18n.t('Assignment config cannot be empty')
      }
      if (value.length === 0) {
        return I18n.t('At least one assignment operation is required')
      }
      return undefined
    },
    'assign.*.operator': ({ value }) => {
      if (!value) {
        return I18n.t('Operator cannot be empty')
      }
      if (value !== 'assign') {
        return I18n.t('Only assignment operation is supported')
      }
      return undefined
    },
    'assign.*.left': ({ value }) => {
      if (!value) {
        return I18n.t('Left variable cannot be empty')
      }
      return undefined
    },
    'assign.*.left.type': ({ value }) => {
      if (!value) {
        return I18n.t('Left variable type cannot be empty')
      }
      if (value !== 'ref') {
        return I18n.t('Left variable must be a reference type')
      }
      return undefined
    },
    'assign.*.left.content': ({ value }) => {
      if (!value || !Array.isArray(value)) {
        return I18n.t('Left variable reference path cannot be empty')
      }
      if (value.length < 2) {
        return I18n.t('Left variable reference path must contain node and variable name')
      }
      if (value.some(item => !item || typeof item !== 'string')) {
        return I18n.t('Left variable reference path cannot contain empty values')
      }
      return undefined
    },
    'assign.*.right': ({ value }) => {
      if (!value) {
        return I18n.t('Right value cannot be empty')
      }
      return undefined
    },
    'assign.*.right.type': ({ value }) => {
      if (!value) {
        return I18n.t('Right value type cannot be empty')
      }
      const validTypes = ['constant', 'ref', 'expression', 'template']
      if (!validTypes.includes(value)) {
        return I18n.t('Right value type is invalid')
      }
      return undefined
    },
  },
}
