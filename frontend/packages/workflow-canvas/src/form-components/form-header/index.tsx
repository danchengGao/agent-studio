/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 * FormHeader component successfully added and working
 */

import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { usePanelManager } from '@flowgram.ai/panel-manager-plugin'
import { useClientContext, CommandService } from '@flowgram.ai/free-layout-editor'
import { Button } from '@douyinfe/semi-ui'
import { X, ChevronDown, ChevronLeft } from 'lucide-react'

import { TestDebugButton } from '../../components/testrun/testdebug/testdebug-button'
import { toggleLoopExpanded } from '../../utils'
import { FlowCommandId } from '../../shortcuts'
import { useIsSidebar, useNodeRenderContext } from '../../hooks'
import { WorkflowNodeType } from '../../nodes/constants'
import { getIcon } from './utils'
import { TitleInput } from './title-input'
import { nodeFormPanelFactory } from '../../components/sidebar'
import { NodeMenu } from '../../components/node-menu'
import { Header, Operators } from './styles'

export function FormHeader(props: { titleEditable?: boolean; menuVisible?: boolean } = {}) {
  const { titleEditable = true, menuVisible = true } = props
  const { node, expanded, toggleExpand } = useNodeRenderContext()
  const [titleEdit, updateTitleEdit] = useState<boolean>(false)
  const ctx = useClientContext()
  const panelManager = usePanelManager()
  const isSidebar = useIsSidebar()

  // 从URL参数获取工作空间ID和workflowId，与Tools组件保持一致
  const { id: workflowId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const spaceId = searchParams.get('spaceId') || ''

  // 检查节点是否启用单组件调试（从节点meta配置中获取）
  const singleComponentDebug = node.getNodeMeta().singleComponentDebug || false

  const handleClose = () => {
    panelManager.close(nodeFormPanelFactory.key)
  }

  const handleExpand = (e: React.MouseEvent) => {
    toggleExpand()
    e.stopPropagation() // Disable clicking prevents the sidebar from opening
  }

  const handleDelete = () => {
    ctx.get<CommandService>(CommandService).executeCommand(FlowCommandId.DELETE, [node])
  }

  useEffect(() => {
    // 折叠 loop 子节点
    if (node.flowNodeType === WorkflowNodeType.Loop) {
      toggleLoopExpanded(node, expanded)
    }
  }, [expanded])

  return (
    <Header>
      {getIcon(node)}
      <TitleInput updateTitleEdit={updateTitleEdit} titleEdit={titleEdit} editable={titleEditable} />
      {node.renderData.expandable && !isSidebar && (
        <Button type="primary" icon={expanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} />} size="small" theme="borderless" onClick={handleExpand} />
      )}

      {singleComponentDebug && <TestDebugButton node={node} workflowId={workflowId} spaceId={spaceId} />}

      {menuVisible && (
        <Operators>
          <NodeMenu node={node} deleteNode={handleDelete} updateTitleEdit={updateTitleEdit} titleEditable={titleEditable} />
        </Operators>
      )}

      {isSidebar && <Button type="primary" icon={<X />} size="small" theme="borderless" onClick={handleClose} />}
    </Header>
  )
}
