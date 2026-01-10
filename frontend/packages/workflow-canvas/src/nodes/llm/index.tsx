/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { customNanoid } from '../../utils/nanoid-custom'

import { WorkflowNodeType } from '../constants'
import { FlowNodeRegistry } from '../../typings'
import { Sparkles } from 'lucide-react'
import { formMeta } from './form-meta'
import { t } from '../../i18n'
import { OutputFormat } from './type'

export const LLMNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.LLM,
  info: {
    icon: <Sparkles size={16} className="text-purple-600" />,
    description: t('workflowCanvas.nodes.llm.description'),
  },
  meta: {
    size: {
      width: 400, // Increased from 360 to accommodate wider labels
      height: 390,
    },
    singleComponentDebug: true,
  },
  formMeta,
  onAdd: (context?) => {
    // 生成新的节点ID
    const nodeId = `llm_${customNanoid(5)}`;

    let maxLLMNumber = 0;

    try {
      // 尝试从context中获取当前画布的schema数据
      if (context?.document?.toJSON) {
        const canvasData = context.document.toJSON();
        console.log('Canvas data:', canvasData);

        // 递归查找所有LLM节点（包括嵌套在循环等组件中的）
        const findLLMNodes = (nodes: any[]): any[] => {
          const llmNodes: any[] = [];

          const checkNode = (node: any) => {
            // 检查当前节点是否是LLM节点
            if (node.type === WorkflowNodeType.LLM ||
                node.type === 'llm' ||
                node.data?.type === WorkflowNodeType.LLM) {
              llmNodes.push(node);
            }

            // 递归查找子节点
            if (node.children && Array.isArray(node.children)) {
              node.children.forEach(checkNode);
            }

            // 特殊处理循环节点的子节点
            if (node.type === WorkflowNodeType.Loop ||
                node.type === 'loop' ||
                node.flowNodeType === WorkflowNodeType.Loop) {
              console.log('Found Loop node:', node.id, node.data);

              // 检查blocks属性
              if (node.blocks && Array.isArray(node.blocks)) {
                console.log(`Loop ${node.id} has ${node.blocks.length} blocks`);
                node.blocks.forEach(checkNode);
              }

              // 检查其他可能的子节点存储方式
              if (node.data) {
                console.log('Loop node data keys:', Object.keys(node.data));
                if (node.data.loopBody) {
                  checkNode(node.data.loopBody);
                }
                if (node.data.subNodes && Array.isArray(node.data.subNodes)) {
                  node.data.subNodes.forEach(checkNode);
                }
                if (node.data.children && Array.isArray(node.data.children)) {
                  node.data.children.forEach(checkNode);
                }
              }
            }
          };

          nodes.forEach(checkNode);
          return llmNodes;
        };

        // 从nodes数组中查找LLM节点（包括嵌套的）
        let llmNodes: any[] = [];
        if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
          llmNodes = findLLMNodes(canvasData.nodes);
        }

        console.log('Found LLM nodes (including nested):', llmNodes.length);

        // 收集所有已使用的序号
        const usedNumbers = new Set<number>();

        // 从每个LLM节点的title中提取序号
        llmNodes.forEach(node => {
          const title = node.data?.title || node.title || '';
          console.log(`Node ${node.id} title: "${title}"`);
          // Match title ending with number (works for both "大模型1" and "LLM 1")
          const match = title.match(/(\d+)$/);
          if (match) {
            const number = parseInt(match[1], 10);
            usedNumbers.add(number);
            console.log(`Extracted number: ${number}`);
          }
        });

        // 找出最小的未使用序号
        let nextNumber = 1;
        while (usedNumbers.has(nextNumber)) {
          nextNumber++;
        }

        console.log(`Used numbers: [${Array.from(usedNumbers).sort((a,b)=>a-b).join(', ')}], next available: ${nextNumber}`);

        // 直接使用找到的最小可用序号
        maxLLMNumber = nextNumber;
      }
    } catch (error) {
      console.error('Error getting existing LLM nodes:', error);
    }

    // 如果没有找到任何节点，默认从1开始
    if (maxLLMNumber === 0) {
      maxLLMNumber = 1;
    }

    const title = `${t('workflowCanvas.nodes.llm.titlePrefix')}${maxLLMNumber}`;

    console.log(`Creating LLM node: ${title}`);

    return {
      id: nodeId,
      type: WorkflowNodeType.LLM,
      data: {
        title: title,
        output_format: OutputFormat.TEXT,
        inputs: {
          llmParam: {
            systemPrompt: {
              type: 'template',
              content: '',
            },
            prompt: {
              type: 'template',
              content: '{{input}}',
            },
          },
          inputParameters: {
            input: {
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
            output: {
              type: 'string',
              extra: {
                index: 1,
              },
            },
          },
          required: ['output'],
        },
      },
    }
  },
}
