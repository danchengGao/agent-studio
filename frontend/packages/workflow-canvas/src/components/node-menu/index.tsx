/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC, useCallback, useState, type MouseEvent } from 'react'

import {
  delay,
  useClientContext,
  usePlaygroundTools,
  useService,
  WorkflowDragService,
  WorkflowNodeEntity,
  WorkflowSelectService,
} from '@flowgram.ai/free-layout-editor'
import { NodeIntoContainerService } from '@flowgram.ai/free-container-plugin'
import { IconButton, Dropdown } from '@douyinfe/semi-ui'
import { MoreHorizontal } from 'lucide-react'
import { WorkflowNodeType } from '../../nodes/constants'
import { getDefaultSpaceId } from '@/utils/spaceUtils'

import { FlowNodeRegistry } from '../../typings'
import { PasteShortcut } from '../../shortcuts/paste'
import { CopyShortcut } from '../../shortcuts/copy'

interface NodeMenuProps {
  node: WorkflowNodeEntity
  updateTitleEdit?: (setEditing: boolean) => void
  deleteNode: () => void
  titleEditable?: boolean
}

export const NodeMenu: FC<NodeMenuProps> = ({ node, deleteNode, updateTitleEdit, titleEditable }) => {
  const [visible, setVisible] = useState(true)
  const clientContext = useClientContext()
  const registry = node.getNodeRegistry<FlowNodeRegistry>()
  const nodeIntoContainerService = useService(NodeIntoContainerService)
  const selectService = useService(WorkflowSelectService)
  const dragService = useService(WorkflowDragService)
  const canMoveOut = nodeIntoContainerService.canMoveOutContainer(node)
  const canDelete = !(registry.canDelete?.(clientContext, node) || registry.meta?.deleteDisable)
  const canCopy = !(registry.meta?.copyDisable === true)
  const tools = usePlaygroundTools()

  const rerenderMenu = useCallback(() => {
    // force destroy component - 强制销毁组件触发重新渲染
    setVisible(false)
    requestAnimationFrame(() => {
      setVisible(true)
    })
  }, [])

  const handleMoveOut = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation()
      const sourceParent = node.parent
      // move out of container - 移出容器
      nodeIntoContainerService.moveOutContainer({ node })
      await delay(16)
      // clear invalid lines - 清除非法线条
      await nodeIntoContainerService.clearInvalidLines({
        dragNode: node,
        sourceParent,
      })
      rerenderMenu()
      // select node - 选中节点
      selectService.selectNode(node)
      // start drag node - 开始拖拽
      dragService.startDragSelectedNodes(e)
    },
    [nodeIntoContainerService, node, rerenderMenu],
  )

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      const copyShortcut = new CopyShortcut(clientContext)
      const pasteShortcut = new PasteShortcut(clientContext)
      const data = copyShortcut.toClipboardData([node])
      pasteShortcut.apply(data)
      e.stopPropagation() // Disable clicking prevents the sidebar from opening
    },
    [clientContext, node],
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      deleteNode()
      e.stopPropagation() // Disable clicking prevents the sidebar from opening
    },
    [clientContext, node],
  )
  const handleEditTitle = useCallback(
    (e: React.MouseEvent) => {
      const canEdit = titleEditable !== false
      if (!canEdit) return
      updateTitleEdit?.(true)
      e.stopPropagation() // Disable clicking prevents the sidebar from opening
    },
    [updateTitleEdit, titleEditable],
  )

  const handleAutoLayout = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation() // Disable clicking prevents the sidebar from opening
      tools.autoLayout({
        containerNode: node,
        enableAnimation: true,
        animationDuration: 1000,
        disableFitView: true,
      })
    },
    [tools],
  )

  const handleOpenSubWorkflow = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const workflowId =
          (node as any).form?.getValueIn?.('configs.subWorkflow.workflowId') || (node as any).form?.initialValues?.data?.configs?.subWorkflow?.workflowId
        const spaceId = getDefaultSpaceId() || ''
        if (workflowId) {
          const url = `/dashboard/workflows/editor/${workflowId}?spaceId=${spaceId}`
          window.open(url, '_blank')
        }
      } catch {}
    },
    [node],
  )

  if (!visible) {
    return <></>
  }

  return (
    // FIXME: 下拉框显示的位置有问题
    <Dropdown
      trigger="hover"
      position="bottomRight"
      render={
        <Dropdown.Menu>
          {titleEditable !== false && <Dropdown.Item onClick={handleEditTitle}>编辑标题</Dropdown.Item>}
          {registry.type === WorkflowNodeType.Workflow && <Dropdown.Item onClick={handleOpenSubWorkflow}>跳转详情</Dropdown.Item>}
          {canMoveOut && <Dropdown.Item onClick={handleMoveOut}>移出容器</Dropdown.Item>}
          {canCopy && (
            <Dropdown.Item onClick={handleCopy} disabled={registry.meta!.copyDisable === true}>
              创建副本
            </Dropdown.Item>
          )}
          {registry.meta.isContainer && <Dropdown.Item onClick={handleAutoLayout}>自动布局</Dropdown.Item>}
          {canDelete && (
            <Dropdown.Item onClick={handleDelete} disabled={!!(registry.canDelete?.(clientContext, node) || registry.meta!.deleteDisable)}>
              删除节点
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      }
    >
      <IconButton color="secondary" size="small" theme="borderless" icon={<MoreHorizontal className="w-3 h-3" />} onClick={e => e.stopPropagation()} />
    </Dropdown>
  )
}
