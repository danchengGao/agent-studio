/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FieldArray, FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'

import { AssignRows, createInferAssignPlugin, type AssignValueType } from '../../form-materials'
import { FormHeader, FormContent, FormDisplay, FormItem } from '../../form-components'
import { defaultFormMeta } from '../default-form-meta'
import { useIsSidebar } from '../../hooks'
import { t, useTranslation } from '../../i18n'

export const FormRender = (): JSX.Element => {
  const { t } = useTranslation()
  const isSidebar = useIsSidebar()

  return (
    <>
      <FormHeader />
      <FormContent>
        {isSidebar ? (
          <FormItem name={t('workflowCanvas.nodes.variable.settings')}>
            <AssignRows name="assign" enableDeclaration={false} />
          </FormItem>
        ) : (
          <>
            <FieldArray name="assign">
              {({ field }) => {
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

                    return variableNames.length > 0 ? variableNames.join(', ') : t('workflowCanvas.nodes.variable.notConfigured')
                  }

                  return t('workflowCanvas.nodes.variable.notConfigured')
                }

                return <FormDisplay label={t('workflowCanvas.nodes.variable.settings')} content={getVariableNames()} />
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
        return t('workflowCanvas.nodes.variable.assignmentConfigEmpty')
      }
      if (value.length === 0) {
        return t('workflowCanvas.nodes.variable.atLeastOneAssignment')
      }
      return undefined
    },
    'assign.*.operator': ({ value }) => {
      if (!value) {
        return t('workflowCanvas.nodes.variable.operatorEmpty')
      }
      if (value !== 'assign') {
        return t('workflowCanvas.nodes.variable.onlyAssignSupported')
      }
      return undefined
    },
    'assign.*.left': ({ value }) => {
      if (!value) {
        return t('workflowCanvas.nodes.variable.leftVariableEmpty')
      }
      return undefined
    },
    'assign.*.left.type': ({ value }) => {
      if (!value) {
        return t('workflowCanvas.nodes.variable.leftVariableTypeEmpty')
      }
      if (value !== 'ref') {
        return t('workflowCanvas.nodes.variable.leftVariableMustBeRef')
      }
      return undefined
    },
    'assign.*.left.content': ({ value }) => {
      if (!value || !Array.isArray(value)) {
        return t('workflowCanvas.nodes.variable.leftRefPathEmpty')
      }
      if (value.length < 2) {
        return t('workflowCanvas.nodes.variable.leftRefPathMustContain')
      }
      if (value.some(item => !item || typeof item !== 'string')) {
        return t('workflowCanvas.nodes.variable.leftRefPathNoEmpty')
      }
      return undefined
    },
    'assign.*.right': ({ value }) => {
      if (!value) {
        return t('workflowCanvas.nodes.variable.rightValueEmpty')
      }
      return undefined
    },
    'assign.*.right.type': ({ value }) => {
      if (!value) {
        return t('workflowCanvas.nodes.variable.rightValueTypeEmpty')
      }
      const validTypes = ['constant', 'ref', 'expression', 'template']
      if (!validTypes.includes(value)) {
        return t('workflowCanvas.nodes.variable.rightValueTypeInvalid')
      }
      return undefined
    },
  },
}
