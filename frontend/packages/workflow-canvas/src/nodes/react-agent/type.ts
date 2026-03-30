/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { JsonSchema } from '../../types'

export interface SkillItem {
  id: string
  plugin_id?: string  // For plugins: the actual plugin ID
  version?: string    // Version for both plugins and workflows
  name: string
  type: 'plugin' | 'workflow'
}

export type FormData = {
  title: string
  max_iterations: number
  inputs: {
    inputParameters: JsonSchema
    llmParam: JsonSchema
    skillsParam: {
      plugins: SkillItem[]
      workflows: SkillItem[]
    }
  }
  outputs: JsonSchema
}
