/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { NodePanelResult, WorkflowNodePanelService } from '@flowgram.ai/free-node-panel-plugin'
import {
  Layer,
  FreeLayoutPluginContext,
  WorkflowHoverService,
  WorkflowNodeEntity,
  WorkflowNodeJSON,
  WorkflowSelectService,
  WorkflowDocument,
  PositionSchema,
  WorkflowDragService,
} from '@flowgram.ai/free-layout-editor'
import { ContainerUtils } from '@flowgram.ai/free-container-plugin'

export class ContextMenuLayer extends Layer {
  ctx!: FreeLayoutPluginContext
  nodePanelService!: WorkflowNodePanelService
  hoverService!: WorkflowHoverService
  selectService!: WorkflowSelectService
  document!: WorkflowDocument
  dragService!: WorkflowDragService

  onReady() {
    this.listenPlaygroundEvent('contextmenu', e => {
            this.openNodePanel(e)
      e.preventDefault()
      e.stopPropagation()
    })
  }

  openNodePanel(e: MouseEvent) {
    const mousePos = this.getPosFromMouseEvent(e)
    const containerNode = this.getContainerNode(mousePos)
    this.nodePanelService.callNodePanel({
      position: mousePos,
      containerNode,
      panelProps: {},
      // handle node selection from panel - 处理从面板中选择节点
      onSelect: async (panelParams?: NodePanelResult) => {
        if (!panelParams) {
          return
        }
        const { nodeType, nodeJSON } = panelParams
        const position = this.dragService.adjustSubNodePosition(nodeType, containerNode, mousePos)
        // create new workflow node based on selected type - 根据选择的类型创建新的工作流节点
        const node: WorkflowNodeEntity = this.ctx.document.createWorkflowNodeByType(nodeType, position, nodeJSON ?? ({} as WorkflowNodeJSON), containerNode?.id)
        // select the newly created node - 选择新创建的节点
        this.selectService.select(node)
      },
      // handle panel close - 处理面板关闭
      onClose: () => {},
    })
  }

  private getContainerNode(mousePos: PositionSchema): WorkflowNodeEntity | undefined {
    const allNodes = this.document.getAllNodes()
    const containerTransforms = ContainerUtils.getContainerTransforms(allNodes)
    const collisionTransform = ContainerUtils.getCollisionTransform({
      targetPoint: mousePos,
      transforms: containerTransforms,
      document: this.document,
    })
    return collisionTransform?.entity
  }
}
