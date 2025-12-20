/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { ASTFactory, EffectOptions, FlowNodeRegistry, DataEvent, Effect, EffectFuncProps } from '@flowgram.ai/editor'
import { JsonSchemaUtils } from '@flowgram.ai/json-schema'
import { IFlowValue, FlowValueUtils } from '../../form-materials'

const parseLoopEffect = (value: any, ctx: EffectFuncProps['context']) => {
  console.log('provideLoopEffect', value)
  const loopParam = value || {}
  const loopType = loopParam.type || 'numLoop'
  const loopArray: Record<string, IFlowValue> = loopType === 'arrayLoop' ? loopParam.loopArray || {} : {}
  const intermediateVar: Record<string, IFlowValue> = loopParam.intermediateVar || {}

  const scope = ctx.node.scope
  const privateScope = ctx.node.privateScope

  const resolveFlowValueType = (flowVal: IFlowValue) => {
    if (!flowVal) {
      return ASTFactory.createString()
    }

    if (flowVal.type === 'constant' && flowVal.schema) {
      try {
        return JsonSchemaUtils.schemaToAST(flowVal.schema)
      } catch (error) {
        console.warn('Failed to convert constant schema to AST:', error)
      }
    }

    if (flowVal.type === 'ref') {
      try {
        let schema = undefined
        if (privateScope) {
          schema = FlowValueUtils.inferJsonSchema(flowVal, privateScope)
        }

        if (!schema && scope) {
          schema = FlowValueUtils.inferJsonSchema(flowVal, scope)
        }

        if (schema) {
          return JsonSchemaUtils.schemaToAST(schema)
        }
      } catch (error) {
        console.warn('Failed to infer type from ref variable:', error)
      }
    }

    if (flowVal.type === 'expression') {
      try {
        let schema = undefined
        if (privateScope) {
          schema = FlowValueUtils.inferJsonSchema(flowVal, privateScope)
        }

        if (!schema && scope) {
          schema = FlowValueUtils.inferJsonSchema(flowVal, scope)
        }

        if (schema) {
          return JsonSchemaUtils.schemaToAST(schema)
        }
      } catch (error) {
        console.warn('Failed to infer type from expression:', error)
      }
    }

    return ASTFactory.createString()
  }

  const arrayProperties =
    loopType === 'arrayLoop'
      ? Object.entries(loopArray).map(([key, flowValue]) => {
          return ASTFactory.createProperty({
            key,
            type: resolveFlowValueType(flowValue as IFlowValue),
          })
        })
      : []

  const intermediateProperties = Object.entries(intermediateVar).map(([key, flowValue]) => {
    return ASTFactory.createProperty({
      key,
      type: resolveFlowValueType(flowValue as IFlowValue),
    })
  })

  const properties = [
    ASTFactory.createProperty({
      key: 'index',
      type: ASTFactory.createInteger(),
    }),
    ...intermediateProperties,
  ]

  if (loopType === 'arrayLoop') {
    properties.unshift(
      ASTFactory.createProperty({
        key: 'item',
        initializer: ASTFactory.createEnumerateExpression({
          enumerateFor: ASTFactory.createKeyPathExpression({
            keyPath: [],
          }),
        }),
      }),
      ...arrayProperties,
    )
  }

  return [
    ASTFactory.createVariableDeclaration({
      key: `${ctx.node.id}_locals`,
      meta: {
        title: ctx.node.form?.getValueIn('title'),
        icon: ctx.node.getNodeRegistry<FlowNodeRegistry>().info?.icon,
      },
      type: ASTFactory.createObject({
        properties,
      }),
    }),
  ]
}

export const provideLoopEffect: EffectOptions[] = [
  // ʹ�� onValueInitOrChange ȷ����ʼ���ͱ�����ᴥ��
  {
    event: DataEvent.onValueInitOrChange,
    effect: params => {
      const { value, context } = params

      // �ӳ�ִ����ȷ��ǰ��ڵ�� effects �Ѿ����
      setTimeout(() => {
        const variables = parseLoopEffect(value, context)

        // �ֶ����õ� private scope
        variables.forEach(variable => {
          context.node.privateScope?.setVar(variable)
        })
      }, 0) // ʹ�� setTimeout 0 �������¼�����ĩβִ��
    },
  },
]
