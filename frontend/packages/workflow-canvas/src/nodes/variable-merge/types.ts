/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IFlowValue } from '../form-materials'
import { FlowNodeJSON } from '@flowgram.ai/free-layout-editor'

// 聚合策略枚举
export enum MergeStrategy {
  FIRST_NON_NULL = 'firstNonNull',
}

// 变量分组接口
export interface VariableGroup {
  name: string
  type?: string
  items: string[]
}

// 节点数据接口
export interface VariableMergeNodeJSON extends FlowNodeJSON {
  data: {
    title?: string
    inputs?: {
      inputParameters?: Record<string, IFlowValue>
      variableMerge?: VariableGroup[]
      mergeStrategy?: MergeStrategy
    }
    outputs?: {
      type: 'object'
      properties?: Record<string, any>
    }
  }
}

// 组件Props接口
export interface VariableGroupManagerProps {
  groups: VariableGroup[]
  onGroupsChange: (groups: VariableGroup[]) => void
  onNodeStructureChange?: (inputParameters: Record<string, any>, outputs: Record<string, any>, transformedGroups?: VariableGroup[]) => void
}

export interface GroupCardProps {
  group: VariableGroup
  groupIndex: number
  groupsLength: number
  onUpdate: (index: number, updatedGroup: VariableGroup) => void
  onDelete: (index: number) => void
  availableVariables: any[]
  isTypeValid: (group: VariableGroup, variableName: string) => boolean
  getInvalidVariables: (group: VariableGroup) => string[]
  inferVariableType: (variableName: string, availableVariables: any[]) => string
  getGroupType: (group: VariableGroup) => string
}

export interface VariableSelectorProps {
  value: string[]
  onChange: (val: string[]) => void
  availableVariables: any[]
}
