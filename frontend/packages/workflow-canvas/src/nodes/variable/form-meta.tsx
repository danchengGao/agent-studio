/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FieldArray, FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'

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
          <FormItem name="设置">
            <AssignRows name="assign" enableDeclaration={false} />
          </FormItem>
        ) : (
          <>
            <FieldArray name="assign">
              {({ field }) => {
                // 从assign数组中提取所有变量名
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

                    return variableNames.length > 0 ? variableNames.join(', ') : '未配置变量'
                  }

                  return '未配置变量'
                }

                return <FormDisplay label="设置" content={getVariableNames()} />
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
        return '赋值配置不能为空'
      }
      if (value.length === 0) {
        return '至少需要配置一个赋值操作'
      }
      return undefined
    },
    'assign.*.operator': ({ value }) => {
      if (!value) {
        return '操作符不能为空'
      }
      if (value !== 'assign') {
        return '只支持赋值操作'
      }
      return undefined
    },
    'assign.*.left': ({ value }) => {
      if (!value) {
        return '左侧变量不能为空'
      }
      return undefined
    },
    'assign.*.left.type': ({ value }) => {
      if (!value) {
        return '左侧变量类型不能为空'
      }
      if (value !== 'ref') {
        return '左侧变量必须是引用类型'
      }
      return undefined
    },
    'assign.*.left.content': ({ value }) => {
      if (!value || !Array.isArray(value)) {
        return '左侧变量引用路径不能为空'
      }
      if (value.length < 2) {
        return '左侧变量引用路径必须包含节点和变量名'
      }
      if (value.some(item => !item || typeof item !== 'string')) {
        return '左侧变量引用路径不能包含空值'
      }
      return undefined
    },
    'assign.*.right': ({ value }) => {
      if (!value) {
        return '右侧值不能为空'
      }
      return undefined
    },
    'assign.*.right.type': ({ value }) => {
      if (!value) {
        return '右侧值类型不能为空'
      }
      const validTypes = ['constant', 'ref', 'expression', 'template']
      if (!validTypes.includes(value)) {
        return '右侧值类型无效'
      }
      return undefined
    },
  },
}
