/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useMemo } from 'react'

import { JsonSchemaTypeManager, JsonSchemaUtils } from '@flowgram.ai/json-schema'
import { useScopeAvailable, getNodePrivateScope, FlowNode } from '@flowgram.ai/editor'

import { IFlowValue } from '../../'
import { FlowValueUtils } from '../../'
import { DisplaySchemaTag } from '../../'

interface PropsType {
  value?: IFlowValue
  title?: JSX.Element | string
  showIconInTree?: boolean
  typeManager?: JsonSchemaTypeManager
  node?: FlowNode
  includePrivateScope?: boolean
}

export function DisplayFlowValue({ value, title, showIconInTree, node, includePrivateScope = false }: PropsType) {
  const available = useScopeAvailable()

  const variable = useMemo(() => {
    if (value?.type !== 'ref') {
      return undefined
    }

    let found = available.getByKeyPath(value?.content)

    if (!found && includePrivateScope && node) {
      const privateScope = getNodePrivateScope(node)
      found = privateScope?.available?.getByKeyPath(value?.content)
    }

    return found
  }, [value?.content, available.version, includePrivateScope, node])

  const schema = useMemo(() => {
    if (value?.type === 'ref') {
      if (variable) {
        return JsonSchemaUtils.astToSchema(variable?.type)
      }
      if (value.schema) {
        return value.schema
      }
      return { type: 'string' }
    }
    if (value?.type === 'template') {
      return { type: 'string' }
    }
    if (value?.type === 'constant') {
      return FlowValueUtils.inferConstantJsonSchema(value)
    }

    return { type: 'unknown' }
  }, [value, variable?.hash])

  const shouldShowWarning = useMemo(() => {
    if (value?.type === 'ref' && !variable) {
      return true
    }

    if (value?.type === 'constant' && (value?.content === undefined || value?.content === null || value?.content === '')) {
      return true
    }

    return false
  }, [value, variable])

  return <DisplaySchemaTag title={title} value={schema} showIconInTree={showIconInTree} warning={shouldShowWarning} />
}
