/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators } from '../../utils/validation'

/**
 * End 节点的完整校验配置
 */
export const validation = {
  'inputs.inputParameters.*': commonValidators.optionalInputParameters,
  'inputs.content': commonValidators.streamingTemplate,
}
