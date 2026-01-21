/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useMemo } from 'react'

import { FlowNodeFormData, FormModelV2, useService, WorkflowDocument } from '@flowgram.ai/free-layout-editor'

import { IJsonSchema, JsonSchemaBasicType } from '../../../form-materials'
import { TestRunFormMetaItem } from '../testrun-form/type'
import { WorkflowNodeType } from '../../../nodes'

const getWorkflowInputsDeclare = (document: WorkflowDocument): IJsonSchema => {
  const defaultDeclare = {
    type: 'object',
    properties: {},
  }

  const startNode = document.root.blocks.find(node => node.flowNodeType === WorkflowNodeType.Start)
  if (!startNode) {
    return defaultDeclare
  }

  try {
    const flowNodeFormData = startNode.getData(FlowNodeFormData)
    if (!flowNodeFormData) {
      return defaultDeclare
    }

    const startFormModel = flowNodeFormData.getFormModel<FormModelV2>()
    if (!startFormModel) {
      return defaultDeclare
    }

    const declare = startFormModel.getValueIn<IJsonSchema>('outputs')
    if (!declare) {
      return defaultDeclare
    }

    return declare
  } catch (error) {
    console.warn('[use-form-meta] getWorkflowInputsDeclare failed:', error instanceof Error ? error.message : String(error))
    return defaultDeclare
  }
}

export const useFormMeta = (): TestRunFormMetaItem[] => {
  const document = useService(WorkflowDocument)

  // Add state for form values
  const formMeta = useMemo(() => {
    const formFields: TestRunFormMetaItem[] = []
    const workflowInputs = getWorkflowInputsDeclare(document)
    if (workflowInputs.properties) {
      Object.entries(workflowInputs.properties).forEach(([name, property]) => {
        formFields.push({
          type: property.type as JsonSchemaBasicType,
          name,
          defaultValue: property.default,
          required: workflowInputs.required?.includes(name) ?? false,
          itemsType: property.items?.type as JsonSchemaBasicType,
          fileType: property.fileType as string,
        })
      })
    }
    return formFields
  }, [document.root.blocks, document.root.version])

  return formMeta
}
