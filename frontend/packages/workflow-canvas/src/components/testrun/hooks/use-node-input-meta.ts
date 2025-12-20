/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useMemo } from 'react'

import { FlowNodeFormData, FormModelV2, WorkflowDocument } from '@flowgram.ai/free-layout-editor'
import { useService } from '@flowgram.ai/free-layout-core'

import { JsonSchemaBasicType } from '../../../form-materials'
import { TestRunFormMetaItem } from '../testrun-form/type'
import { findNodeRecursively } from '../../../utils'
import { WorkflowNodeType } from '../../../nodes/constants'

// 解析引用路径获取真实类型
const resolveReferenceType = (document: WorkflowDocument, referencePath: any): { type: JsonSchemaBasicType; itemsType?: JsonSchemaBasicType } => {
  const defaultType = { type: 'string' as JsonSchemaBasicType, itemsType: undefined as JsonSchemaBasicType | undefined }

  // 如果 referencePath 不是数组，返回默认类型
  if (!Array.isArray(referencePath) || referencePath.length === 0) {
    return defaultType
  }

  const [sourceNodeId, ...outputPath] = referencePath

  // 使用递归查找函数查找节点（支持嵌套节点）
  const sourceNode = findNodeRecursively(document.root.blocks, sourceNodeId)
  if (!sourceNode) {
    return defaultType
  }

  // 从源节点的 FormModel 获取 outputs 类型信息
  try {
    const flowNodeFormData = sourceNode.getData(FlowNodeFormData)
    if (!flowNodeFormData) return defaultType

    const formModel = flowNodeFormData.getFormModel<FormModelV2>()
    if (!formModel) return defaultType

    const outputs = formModel.getValueIn<any>('outputs')
    if (outputs?.properties) {
      // 如果有具体的输出字段路径
      if (outputPath.length > 0) {
        const outputFieldName = outputPath[0]
        const outputField = outputs.properties[outputFieldName]
        if (outputField) {
          return {
            type: outputField.type as JsonSchemaBasicType,
            itemsType: outputField.items?.type as JsonSchemaBasicType,
          }
        }
      }

      // 如果没有具体路径，取第一个输出字段
      const firstOutputField = Object.values(outputs.properties)[0] as any
      if (firstOutputField) {
        return {
          type: firstOutputField.type as JsonSchemaBasicType,
          itemsType: firstOutputField.items?.type as JsonSchemaBasicType,
        }
      }
    }
  } catch (error) {
    console.warn('[use-node-input-meta] resolveReferenceType failed:', error instanceof Error ? error.message : String(error))
  }

  return defaultType
}

const getNodeInputsDeclare = (document: WorkflowDocument, nodeId: string): any => {
  const defaultDeclare = {
    type: 'object',
    properties: {},
  }

  if (!nodeId || nodeId.trim() === '') {
    return defaultDeclare
  }

  // 使用递归查找函数查找节点（支持嵌套节点）
  const targetNode = findNodeRecursively(document.root.blocks, nodeId)
  if (!targetNode) {
    return defaultDeclare
  }

  // 使用 FormModel 获取输入声明（和其他 Hook 保持一致的方式）
  try {
    const flowNodeFormData = targetNode.getData(FlowNodeFormData)
    if (!flowNodeFormData) {
      return defaultDeclare
    }

    const formModel = flowNodeFormData.getFormModel<FormModelV2>()
    if (!formModel) {
      return defaultDeclare
    }

    const declare = formModel.getValueIn<any>('inputs')
    if (!declare) {
      return defaultDeclare
    }

    // 特殊处理循环节点
    const nodeType = targetNode.getNodeRegistry()?.type
    if (nodeType === WorkflowNodeType.Loop) {
      const loopParam = formModel.getValueIn<any>('inputs.loopParam')
      if (loopParam) {
        if (loopParam.type === 'arrayLoop' && loopParam.loopArray) {
          const inputParameters: Record<string, any> = {}

          Object.entries(loopParam.loopArray).forEach(([key, value]) => {
            if (key && key.trim() !== '') {
              inputParameters[key] = value
            }
          })

          return {
            type: 'object',
            inputParameters,
          }
        } else {
          return {
            type: 'object',
            inputParameters: {},
          }
        }
      }
    }

    return declare
  } catch (error) {
    console.error('[use-node-input-meta] getNodeInputsDeclare failed:', error instanceof Error ? error.message : String(error), { nodeId })
    return defaultDeclare
  }
}

export const useNodeInputMeta = (nodeId: string): TestRunFormMetaItem[] => {
  const document = useService(WorkflowDocument)

  const formMeta = useMemo(() => {
    const formFields: TestRunFormMetaItem[] = []

    if (!nodeId || nodeId.trim() === '') {
      return formFields
    }

    const nodeInputs = getNodeInputsDeclare(document, nodeId)

    // 解析 inputParameters 中的输入字段
    if (nodeInputs.inputParameters) {
      Object.entries(nodeInputs.inputParameters).forEach(([name, inputParam]) => {
        const param = inputParam as any

        let formField: TestRunFormMetaItem | null = null

        if (param.schema) {
          // Handle boolean values explicitly to avoid false || '' becoming empty string
          let defaultValue: any
          const schemaType = param.schema.type as JsonSchemaBasicType
          if (schemaType === 'boolean') {
            defaultValue = param.content !== undefined ? param.content : param.default !== undefined ? param.default : false
          } else {
            defaultValue = param.content || param.default || ''
          }

          formField = {
            type: schemaType,
            name,
            defaultValue,
            required: false,
            itemsType: param.schema.items?.type as JsonSchemaBasicType,
          }
        } else if (param.type === 'ref') {
          const resolvedType = resolveReferenceType(document, param.content)

          formField = {
            type: resolvedType.type,
            name,
            defaultValue: '',
            required: false,
            itemsType: resolvedType.itemsType,
          }
        } else if (param.type === 'constant') {
          let fieldType: JsonSchemaBasicType
          let itemsType: JsonSchemaBasicType | undefined

          if (param.schema?.type) {
            fieldType = param.schema.type as JsonSchemaBasicType
            itemsType = param.schema.items?.type as JsonSchemaBasicType
          } else {
            if (Array.isArray(param.content)) {
              fieldType = 'array'
              itemsType =
                param.content.length > 0
                  ? typeof param.content[0] === 'string'
                    ? 'string'
                    : typeof param.content[0] === 'number'
                      ? 'number'
                      : typeof param.content[0] === 'boolean'
                        ? 'boolean'
                        : 'string'
                  : 'string'
            } else if (typeof param.content === 'string') {
              fieldType = 'string'
            } else if (typeof param.content === 'number') {
              fieldType = 'number'
            } else if (typeof param.content === 'boolean') {
              fieldType = 'boolean'
            } else {
              fieldType = 'string'
            }
          }

          // Handle boolean values explicitly to avoid false || '' becoming empty string
          let defaultValue: any
          if (fieldType === 'boolean') {
            defaultValue = param.content !== undefined ? param.content : false
          } else {
            defaultValue = param.content || ''
          }

          formField = {
            type: fieldType,
            name,
            defaultValue,
            required: false,
            itemsType,
          }
        } else {
          // Handle boolean values explicitly to avoid false || '' becoming empty string
          let defaultValue: any
          if (typeof param.content === 'boolean') {
            defaultValue = param.content
          } else {
            defaultValue = param.content || param.default || ''
          }

          formField = {
            type: 'string' as JsonSchemaBasicType,
            name,
            defaultValue,
            required: false,
            itemsType: undefined,
          }
        }

        if (formField) {
          formFields.push(formField)
        }
      })
    }

    if (nodeInputs.properties) {
      Object.entries(nodeInputs.properties).forEach(([name, property]) => {
        const prop = property as any
        const propType = prop.type as JsonSchemaBasicType

        // Handle boolean values explicitly to avoid false || '' becoming empty string
        let defaultValue: any
        if (propType === 'boolean') {
          defaultValue = prop.default !== undefined ? prop.default : false
        } else {
          defaultValue = prop.default
        }

        const formField = {
          type: propType,
          name,
          defaultValue,
          required: nodeInputs.required?.includes(name) ?? false,
          itemsType: prop.items?.type as JsonSchemaBasicType,
        }
        formFields.push(formField)
      })
    }

    return formFields
  }, [document, nodeId])

  return formMeta
}
