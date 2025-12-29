/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field, FieldRenderProps } from '@flowgram.ai/free-layout-editor'
import { Typography, Spin, Tag, Switch } from '@douyinfe/semi-ui'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

import { useIsSidebar } from '../../hooks'
import { FormItem, FormDisplay, FormSelect } from '../../form-components'
import { useModels, type FrontendModelConfig } from '@test-agentstudio/api-client'
import { useTranslation } from '../../i18n'

const { Text } = Typography

interface Model {
  id: string
  name: string
  type: string
}

export interface FormModelProps {
  name?: string
  fieldPrefix?: string
  required?: boolean
}

export function FormModel({ name, fieldPrefix = 'inputs', required = true }: FormModelProps) {
  const { t } = useTranslation()
  const displayName = name || t('workflowCanvas.formModel.model')
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
        <FormItem name={displayName} required={required} vertical>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spin size="small" />
            <Text>{t('workflowCanvas.formModel.loadingModels')}</Text>
          </div>
        </FormItem>
      </>
    )
  }

  if (isSidebar && error) {
    return (
      <>
        <FormItem name={displayName} required={required} vertical>
          <div style={{ display: 'flex', gap: 8 }}>
            <Text>{t('workflowCanvas.formModel.loadFailed')}</Text>
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
      <Field<{ id: string; name: string; type: string }> name={`${fieldPrefix}.llmParam.model`} defaultValue={defaultModel}>
        {({ field }: FieldRenderProps<{ id: string; name: string; type: string }>) => {
          const modelName = field.value?.name || t('workflowCanvas.formModel.notSelected')
          const isUnselected = !field.value?.id || field.value?.id === ''
          const modelId = field.value?.id || ''
          const isModelMissing = modelId && !availableModelIds.has(modelId) && modelsData // 模型列表已加载但模型不在可用列表中（可能已被禁用）

          return (
            <FormDisplay
              label={displayName}
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
                      {t('workflowCanvas.formModel.modelDisabled')}
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
    <Field<{ id: string; name: string; type: string }>
      name={`${fieldPrefix}.llmParam.model`}
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
        const modelId = field.value?.id || ''
        const isModelMissing = modelId && !availableModelIds.has(modelId) && modelsData
        const currentValue = modelId && availableModelIds.has(modelId) ? modelId : ''

        return (
          <FormItem
            name={displayName}
            required={required}
            vertical
            customComponent={
              <Field<boolean> name={`${fieldPrefix}.historyEnable`} defaultValue={false}>
                {({ field }) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>{t('workflowCanvas.formModel.enableHistory')}</span>
                    <Switch
                      checked={field.value ?? false}
                      onChange={field.onChange}
                      size="small"
                      style={
                        {
                          '--semi-color-success': '#1890ff',
                          '--semi-color-success-hover': '#40a9ff',
                          '--semi-color-success-active': '#096dd9',
                        } as React.CSSProperties
                      }
                    />
                  </div>
                )}
              </Field>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <FormSelect
                value={currentValue}
                onChange={(value: string | string[]) => {
                  const newModelId = Array.isArray(value) ? value[0] || '' : value
                  const selectedModel = models.find(m => m.id === newModelId)
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
              {isModelMissing && (
                <span className="inline-flex items-center text-xs text-amber-600 leading-[18px]">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {t('workflowCanvas.formModel.modelNotExists')}
                </span>
              )}
            </div>
          </FormItem>
        )
      }}
    </Field>
  )
}
