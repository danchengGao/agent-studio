/**
 * Copyright (c) Huawei Technologies Co., Ltd. 2025. All rights reserved.
 *
 * Knowledge Retrieval workflow node registry.
 */

import { customNanoid } from '../../utils/nanoid-custom'
import { WorkflowNodeType } from '../constants'
import { FlowNodeRegistry } from '../../typings'
import { BookOpen } from 'lucide-react'
import { formMeta } from './form-meta'
import { t } from '../../i18n'
import { generateNodeTitle } from '../../utils/workflow-node-utils'

export const KnowledgeRetrievalNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.KnowledgeRetrieval,
  info: () => ({
    icon: <BookOpen size={16} className="text-orange-600" />,
    description: t('workflowCanvas.nodes.knowledgeRetrieval.description'),
  }),
  meta: {
    size: {
      width: 360,
      height: 260,
    },
    singleComponentDebug: true,
    nodePanelVisible: true,
  },
  formMeta,
  onAdd: (context?) => {
    const nodeId = `kr_${customNanoid(5)}`
    const titlePrefix = t('workflowCanvas.nodes.knowledgeRetrieval.titlePrefix')
    const title = generateNodeTitle(WorkflowNodeType.KnowledgeRetrieval, context, titlePrefix)

    return {
      id: nodeId,
      type: WorkflowNodeType.KnowledgeRetrieval,
      data: {
        title: title,
        inputs: {
          knowledgeRetrievalParam: {
            kbIds: [],
            kbInfo: [],
            searchStrategy: 'vector',
            maxRecallCount: 5,
            minMatchScore: 0.5,
            useGraph: false,
            agentic: false,
          },
          llmParam: {
            model: { id: '', name: '', type: '' },
            systemPrompt: {
              type: 'template',
              content: '',
            },
            prompt: {
              type: 'template',
              content: '',
            },
          },
          inputParameters: {
            query: {
              type: 'constant',
              content: '',
              schema: {
                type: 'string',
              },
              extra: {
                index: 0,
              },
            },
          },
        },
        outputs: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: { type: 'string' },
              extra: {
                index: 1,
              },
            },
            context: {
              type: 'string',
              extra: {
                index: 2,
              },
            },
            results_with_metadata: {
              type: 'array',
              items: { type: 'object' },
              extra: {
                index: 3,
              },
            },
          },
          required: ['results', 'context'],
        },
      },
    }
  },
}
