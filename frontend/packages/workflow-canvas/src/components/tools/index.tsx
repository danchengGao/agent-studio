/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react'

import { useRefresh } from '@flowgram.ai/free-layout-core'
import { useClientContext } from '@flowgram.ai/free-layout-editor'
import { Tooltip, IconButton, Divider } from '@douyinfe/semi-ui'
import { Undo2, Redo2 } from 'lucide-react'

import { TestRunButton } from '../testrun/testrun-button'
import { DebugButton } from '../debug'
import { AddNode } from '../add-node'
import { ZoomSelect } from './zoom-select'
import { MinimapSwitch } from './minimap-switch'
import { Minimap } from './minimap'
import { Comment } from './comment'
import { AutoLayout } from './auto-layout'
import { Interactive } from './interactive'
import { ToolContainer, ToolSection } from './styles'
import { useTranslation } from '../../i18n'

interface ToolsProps {
  workflowId?: string
  spaceId?: string
}

export function Tools({ workflowId, spaceId }: ToolsProps) {
  const { history, playground } = useClientContext()
  const { t } = useTranslation()
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [minimapVisible, setMinimapVisible] = useState(false)

  useEffect(() => {
    const disposable = history.undoRedoService.onChange(() => {
      setCanUndo(history.canUndo())
      setCanRedo(history.canRedo())
    })
    return () => disposable.dispose()
  }, [history])

  const refresh = useRefresh()

  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(() => refresh())
    return () => disposable.dispose()
  }, [playground])

  return (
    <>
      <ToolContainer className="tools">
        <ToolSection>
          <AutoLayout />
          <ZoomSelect />
          <Interactive />
          <MinimapSwitch minimapVisible={minimapVisible} setMinimapVisible={setMinimapVisible} />
          <Comment />

          <Tooltip content={t('workflowCanvas.tools.undo')}>
            <IconButton type="tertiary" theme="borderless" icon={<Undo2 size={16} />} disabled={!canUndo} onClick={() => history.undo()} />
          </Tooltip>
          <Tooltip content={t('workflowCanvas.tools.redo')}>
            <IconButton type="tertiary" theme="borderless" icon={<Redo2 size={16} />} disabled={!canRedo} onClick={() => history.redo()} />
          </Tooltip>

          <Divider layout="vertical" style={{ height: '16px' }} margin={3} />
          <AddNode />
          <Divider layout="vertical" style={{ height: '16px' }} margin={3} />
          <TestRunButton workflowId={workflowId} spaceId={spaceId} />
          <Divider layout="vertical" style={{ height: '16px' }} margin={3} />
          <DebugButton workflowId={workflowId} spaceId={spaceId} />
        </ToolSection>
      </ToolContainer>
      {/* 独立的小地图容器，固定在右下角 */}
      <Minimap visible={minimapVisible} />
    </>
  )
}
