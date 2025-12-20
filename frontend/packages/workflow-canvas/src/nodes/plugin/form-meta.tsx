/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useLayoutEffect } from 'react'
import { FormMeta, ValidateTrigger, FlowNodeJSON, FormRenderProps, WorkflowNodePortsData } from '@flowgram.ai/free-layout-editor'

import { provideJsonSchemaOutputs, syncVariableTitle, autoRenameRefEffect, validateWhenVariableSync, listenRefSchemaChange } from '../../form-materials'
import { validation } from './validation'
import { useNodeRenderContext } from '../../hooks'
import { FormHeader, FormContent } from '../../form-components'
import { FormInput, FormOutput } from '../../form-components'
import { Typography } from '@douyinfe/semi-ui'
import { PluginApiInfo } from '../../../../api-client/src/types'

const { Text } = Typography

// Plugin Inputs Component using FormInput with schema
function PluginInputs({ selectedTool }: { selectedTool?: PluginApiInfo }) {
  return <FormInput name="输入" showAddButton={false} deleteable={false} nameEditable={false} useFieldSchema={true} />
}

// Plugin Outputs Component using FormOutput with dynamic port update
function PluginOutputs({ selectedTool }: { selectedTool?: PluginApiInfo }) {
  const { node } = useNodeRenderContext()

  useLayoutEffect(() => {
    window.requestAnimationFrame(() => {
      const portsData = node.getData<WorkflowNodePortsData>(WorkflowNodePortsData)
      if (portsData) {
        portsData.updateDynamicPorts()
      }
    })
  }, [node, selectedTool])

  return <FormOutput name="输出" outputName="outputs" showAddButton={false} readonly={true} />
}

const renderForm = (props: FormRenderProps<FlowNodeJSON>) => {
  const nodeData = props.form?.initialValues?.data
  const plugin = nodeData?.plugin
  const selectedTool = plugin?.selectedTool || plugin?.api_info?.[0]

  return (
    <>
      <FormHeader />
      <FormContent>
        {selectedTool && (
          <div style={{ marginBottom: 16 }}>
            <Text heading={6} style={{ marginBottom: 8 }}>
              {selectedTool.name || '未命名工具'}
            </Text>
            <div
              style={{
                fontSize: '12px',
                color: '#86909C',
                lineHeight: '1.4',
                maxHeight: '2.8em',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedTool.desc || '暂无描述'}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <PluginInputs />
          <PluginOutputs />
        </div>
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
    inputsValues: [...autoRenameRefEffect, ...validateWhenVariableSync({ scope: 'public' })],
    'inputsValues.*': listenRefSchemaChange(() => {
      // Schema reference updated
    }),
  },
}
