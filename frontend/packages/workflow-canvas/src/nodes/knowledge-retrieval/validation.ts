/**
 * Copyright (c) Huawei Technologies Co., Ltd. 2025. All rights reserved.
 */

import { commonValidators } from '../../utils/validation/common-validators'
import { t } from '../../i18n'

/**
 * Validates that at least one knowledge base is selected.
 */
const createKBValidator = () => {
  return ({ value }: { value: any }) => {
    const kbIds = value?.kbIds || []
    if (kbIds.length === 0) {
      return t('workflowCanvas.nodes.knowledgeRetrieval.knowledgeCannotBeEmpty')
    }
    return undefined
  }
}

/**
 * Conditionally validates that a model is selected when agentic retrieval is enabled.
 */
const createAgenticModelValidator = () => {
  return ({ value, formValues }: { value: any; formValues: any }) => {
    const agentic = formValues?.inputs?.knowledgeRetrievalParam?.agentic || false
    if (agentic) {
      if (!value || !value.id || value.id === '') {
        return t('workflowCanvas.validation.modelRequired')
      }
    }
    return undefined
  }
}

export const validation = {
  'inputs.inputParameters.*': commonValidators.optionalInputParameters,
  'inputs.knowledgeRetrievalParam': createKBValidator(),
  'inputs.llmParam.model': createAgenticModelValidator(),
}
