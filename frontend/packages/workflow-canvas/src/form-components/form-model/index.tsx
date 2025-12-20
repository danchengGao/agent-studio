/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field, FieldRenderProps } from '@flowgram.ai/free-layout-editor'
import { Typography, Spin, Tag } from '@douyinfe/semi-ui'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

import { useIsSidebar } from '../../hooks'
import { FormItem, ValueDisplay, FormDisplay, FormSelect } from '../../form-components'
import { useModels, type FrontendModelConfig } from '@test-agentstudio/api-client'

const { Text } = Typography

interface Model {
  id: string
  name: string
  type: string
}

export interface FormModelProps {
  name?: string
  modelName?: string
  required?: boolean
}

export function FormModel({ name = '模型', modelName = 'inputs.llmParam.model', required = true }: FormModelProps) {
  const isSidebar = useIsSidebar()
  const [searchParams] = useSearchParams()
  const spaceId = searchParams.get('spaceId')

  // 获取模型列表（只获取激活状态的模型）
  const {
    data: modelsData,
    isLoading,
    error,
  } = useModels({
    spaceId: spaceId || '0',
    is_active: true, // 只获取激活状态的模型
    size: 100, // 获取更多模型
    sort_by: 'update_time',
    sort_order: 'desc',
  })

  const models =
    modelsData?.items?.map((model: FrontendModelConfig) => ({
      id: model.id,
      name: model.name,
      type: model.modelId,
    })) || []

  // 创建可用模型ID集合，用于快速检查
  const availableModelIds = new Set(models.map(m => m.id))

  if (isSidebar && isLoading) {
    return (
      <>
        <FormItem name={name} required={required} vertical>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spin size="small" />
            <Text>加载模型中...</Text>
          </div>
        </FormItem>
      </>
    )
  }

  if (isSidebar && error) {
    return (
      <>
        <FormItem name={name} required={required} vertical>
          <div style={{ display: 'flex', gap: 8 }}>
            <Text>加载模型失败，请重试</Text>
          </div>
        </FormItem>
      </>
    )
  }

  if (!isSidebar) {
    const defaultModel =
      models.length > 0
        ? {
            id: models[0]?.id || '',
            name: models[0]?.name || '',
            type: models[0]?.type || '',
          }
        : { id: '', name: '', type: '' }

    return (
      <Field<{ id: string; name: string; type: string }> name={modelName} defaultValue={defaultModel}>
        {({ field }: FieldRenderProps<{ id: string; name: string; type: string }>) => {
          const modelName = field.value?.name || '未选择'
          const isUnselected = !field.value?.id || field.value?.id === ''
          const modelId = field.value?.id || ''
          const isModelMissing = modelId && !availableModelIds.has(modelId) && modelsData // 模型列表已加载但模型不在可用列表中（可能已被禁用）

          return (
            <FormDisplay
              label={name}
              content={
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isUnselected ? (
                      <Tag
                        color="amber"
                        size="small"
                        style={{
                          fontSize: '10px',
                          lineHeight: '14px',
                          padding: '1px 6px',
                          margin: 0,
                          borderRadius: '4px',
                        }}
                      >
                        {modelName}
                      </Tag>
                    ) : (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelName}</span>
                    )}
                  </div>
                  {/* 模型已禁用提醒 */}
                  {isModelMissing && (
                    <span className="inline-flex items-center text-xs text-amber-600 leading-[18px]" style={{ flexShrink: 0 }}>
                      <AlertCircle className="w-4 h-4 mr-1" />
                      模型已禁用，请重新选择
                    </span>
                  )}
                </div>
              }
            />
          )
        }}
      </Field>
    )
  }

  return (
    <>
      <FormItem name={name} required={required} vertical>
        <div style={{ display: 'flex', gap: 8 }}>
          <Field<{ id: string; name: string; type: string }>
            name={modelName}
            defaultValue={
              models.length > 0
                ? {
                    id: models[0]?.id || '',
                    name: models[0]?.name || '',
                    type: models[0]?.type || '',
                  }
                : { id: '', name: '', type: '' }
            }
          >
            {({ field }: FieldRenderProps<{ id: string; name: string; type: string }>) => {
              const currentValue = field.value?.id || ''
              const modelId = field.value?.id || ''
              const modelName = field.value?.name || ''
              const isModelMissing = modelId && !availableModelIds.has(modelId) && modelsData // 模型列表已加载但模型不在可用列表中（可能已被禁用）

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <FormSelect
                    value={currentValue}
                    onChange={(value: string | string[]) => {
                      const modelId = Array.isArray(value) ? value[0] || '' : value
                      const selectedModel = models.find(m => m.id === modelId)
                      field.onChange({
                        id: selectedModel?.id || '',
                        name: selectedModel?.name || '',
                        type: selectedModel?.type || '',
                      })
                    }}
                    options={models.map((model: Model) => ({
                      label: `${model.name}`,
                      value: model.id,
                    }))}
                  />
                  {/* 模型不存在提醒 */}
                  {isModelMissing && (
                    <span className="inline-flex items-center text-xs text-amber-600 leading-[18px]">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      模型不存在，请重新选择
                    </span>
                  )}
                </div>
              )
            }}
          </Field>
        </div>
      </FormItem>
    </>
  )
}
