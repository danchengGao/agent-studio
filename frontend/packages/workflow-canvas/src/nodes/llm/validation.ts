/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators } from '../../utils/validation'

export const validation = {
  'inputs.inputParameters.*': commonValidators.optionalInputParameters,
  'inputs.llmParam.model': commonValidators.model,
}
