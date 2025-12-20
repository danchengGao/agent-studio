/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useMemo } from 'react'

import { FlowNodeFormData, FormModelV2, WorkflowDocument } from '@flowgram.ai/free-layout-editor'
import { useService } from '@flowgram.ai/free-layout-core'

import { IJsonSchema, JsonSchemaBasicType } from '../../../form-materials'
import { TestRunFormMetaItem } from '../testrun-form/type'
import { findNodeRecursively } from '../../../utils'

const getInputNodeOutputsDeclare = (document: WorkflowDocument, nodeId: string): IJsonSchema => {
  const defaultDeclare = {
    type: 'object',
    properties: {},
  }

  // 如果nodeId为空，直接返回默认声明
  if (!nodeId || nodeId.trim() === '') {
    return defaultDeclare
  }

  // 使用递归查找函数查找节点（支持嵌套节点）
  const inputNode = findNodeRecursively(document.root.blocks, nodeId)

  if (!inputNode) {
    return defaultDeclare
  }

  // 尝试从 FormModel 获取
  try {
    const flowNodeFormData = inputNode.getData(FlowNodeFormData)
    if (!flowNodeFormData) {
      return defaultDeclare
    }

    const inputFormModel = flowNodeFormData.getFormModel<FormModelV2>()
    if (!inputFormModel) {
      return defaultDeclare
    }

    const declare = inputFormModel.getValueIn<IJsonSchema>('outputs')
    if (!declare) {
      return defaultDeclare
    }

    return declare
  } catch (error) {
    console.warn('[use-input-form-meta] getInputNodeOutputsDeclare failed:', error instanceof Error ? error.message : String(error))
    return defaultDeclare
  }
}

export const useInputFormMeta = (nodeId: string): TestRunFormMetaItem[] => {
  const document = useService(WorkflowDocument)

  const formMeta = useMemo(() => {
    const formFields: TestRunFormMetaItem[] = []

    // 如果nodeId为空，直接返回空数组
    if (!nodeId || nodeId.trim() === '') {
      return formFields
    }

    const inputNodeOutputs = getInputNodeOutputsDeclare(document, nodeId)

    if (inputNodeOutputs.properties) {
      Object.entries(inputNodeOutputs.properties).forEach(([name, property]) => {
        formFields.push({
          type: property.type as JsonSchemaBasicType,
          name,
          defaultValue: property.default,
          required: inputNodeOutputs.required?.includes(name) ?? false,
          itemsType: property.items?.type as JsonSchemaBasicType,
        })
      })
    }

    return formFields
  }, [document.root.blocks, document.root.version, nodeId])

  return formMeta
}
