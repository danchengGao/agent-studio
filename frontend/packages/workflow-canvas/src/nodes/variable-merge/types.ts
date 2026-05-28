/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IFlowValue } from '../form-materials'
import { FlowNodeJSON } from '@flowgram.ai/free-layout-editor'

// Top-level merge mode (matches n8n)
export enum MergeMode {
  FIRST_NON_NULL = 'firstNonNull',
  APPEND = 'append',
  COMBINE = 'combine',
  CHOOSE_BRANCH = 'chooseBranch',
  SQL_QUERY = 'sqlQuery',
}

// Combine sub-mode (matches n8n Combine > Combine By)
export enum CombineBy {
  MATCHING_FIELDS = 'matchingFields',
  POSITION = 'position',
  ALL_COMBINATIONS = 'allCombinations',
}

// Output type for Combine > Matching Fields (matches n8n Output Type / clash handling)
export enum MergeOutputType {
  KEEP_MATCHES = 'keepMatches',       // inner join
  ENRICH_INPUT1 = 'enrichInput1',     // left join
  KEEP_EVERYTHING = 'keepEverything', // full outer join
}

// Keep MergeStrategy as an alias so old imports don't break
export { MergeMode as MergeStrategy }

// 变量分组接口
export interface VariableGroup {
  name: string
  type?: string
  items: string[]
  mode?: MergeMode
  // Combine sub-options
  combineBy?: CombineBy
  matchField1?: string
  matchField2?: string
  outputType?: MergeOutputType
  keepUnpaired?: boolean
  fuzzyCompare?: boolean
  clashWhenClash?: 'addInputNumber' | 'preferInput1' | 'preferInput2'
  clashMergingNested?: 'deepMerge' | 'shallowMerge'
  clashMinimizeEmptyFields?: boolean
  // Choose Branch
  chooseIndex?: number
  // SQL Query
  sqlQuery?: string
  // Append
  appendInputCount?: number
}

// 节点数据接口
export interface VariableMergeNodeJSON extends FlowNodeJSON {
  data: {
    title?: string
    inputs?: {
      inputParameters?: Record<string, IFlowValue>
      variableMerge?: VariableGroup[]
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
  inferVariableType: (variableName: string, availableVariables: any[]) => string
  getGroupType: (group: VariableGroup) => string
  readOnly?: boolean
}

export interface VariableSelectorProps {
  value: string[]
  onChange: (val: string[]) => void
  availableVariables: any[]
}
