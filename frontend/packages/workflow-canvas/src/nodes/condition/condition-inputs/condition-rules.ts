/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IConditionRule, ConditionOpConfigs, ConditionPresetOp } from '../../../form-materials'

// 自定义操作符配置，支持中文标签
export const conditionOps: ConditionOpConfigs = {
  [ConditionPresetOp.EQ]: {
    label: '等于',
    abbreviation: '=',
  },
  [ConditionPresetOp.NEQ]: {
    label: '不等于',
    abbreviation: '≠',
  },
  [ConditionPresetOp.GT]: {
    label: '大于',
    abbreviation: '>',
  },
  [ConditionPresetOp.GTE]: {
    label: '大于等于',
    abbreviation: '>=',
  },
  [ConditionPresetOp.LT]: {
    label: '小于',
    abbreviation: '<',
  },
  [ConditionPresetOp.LTE]: {
    label: '小于等于',
    abbreviation: '<=',
  },
  [ConditionPresetOp.CONTAINS]: {
    label: '包含',
    abbreviation: '⊇',
  },
  [ConditionPresetOp.NOT_CONTAINS]: {
    label: '不包含',
    abbreviation: '⊉',
  },
  [ConditionPresetOp.IS_EMPTY]: {
    label: '为空',
    abbreviation: '=',
    rightDisplay: 'Empty',
  },
  [ConditionPresetOp.IS_NOT_EMPTY]: {
    label: '不为空',
    abbreviation: '≠',
    rightDisplay: 'Empty',
  },
}

// 字符串条件规则
export const stringConditionRules: IConditionRule = {
  [ConditionPresetOp.EQ]: 'string',
  [ConditionPresetOp.NEQ]: 'string',
  [ConditionPresetOp.CONTAINS]: 'string',
  [ConditionPresetOp.NOT_CONTAINS]: 'string',
  [ConditionPresetOp.IS_EMPTY]: null,
  [ConditionPresetOp.IS_NOT_EMPTY]: null,
  [ConditionPresetOp.GT]: 'number', // 长度大于
  [ConditionPresetOp.GTE]: 'number', // 长度大于等于
  [ConditionPresetOp.LT]: 'number', // 长度小于
  [ConditionPresetOp.LTE]: 'number', // 长度小于等于
}

// 整数条件规则
export const integerConditionRules: IConditionRule = {
  [ConditionPresetOp.EQ]: 'number',
  [ConditionPresetOp.NEQ]: 'number',
  [ConditionPresetOp.GT]: 'number',
  [ConditionPresetOp.GTE]: 'number',
  [ConditionPresetOp.LT]: 'number',
  [ConditionPresetOp.LTE]: 'number',
}

// 统一的规则配置，提供给 ConditionProvider
export const conditionRules = {
  string: stringConditionRules,
  integer: integerConditionRules,
}
