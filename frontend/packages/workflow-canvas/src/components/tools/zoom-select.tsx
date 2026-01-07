/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState } from 'react'

import { usePlayground, usePlaygroundTools } from '@flowgram.ai/free-layout-editor'
import { Divider, Dropdown } from '@douyinfe/semi-ui'

import { SelectZoom } from './styles'
import { useTranslation } from '../../i18n'

export const ZoomSelect = () => {
  const tools = usePlaygroundTools({ maxZoom: 2, minZoom: 0.25 })
  const { t } = useTranslation()
  const playground = usePlayground()
  const [dropDownVisible, openDropDown] = useState(false)
  return (
    <Dropdown
      position="top"
      trigger="custom"
      visible={dropDownVisible}
      onClickOutSide={() => openDropDown(false)}
      render={
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => tools.zoomout()}>{t('workflowCanvas.tools.zoomOut')}</Dropdown.Item>
          <Dropdown.Item onClick={() => tools.zoomin()}>{t('workflowCanvas.tools.zoomIn')}</Dropdown.Item>
          <Divider layout="horizontal" />
          <Dropdown.Item onClick={() => playground.config.updateZoom(0.5)}>{t('workflowCanvas.tools.zoomTo', { percent: '50%' })}</Dropdown.Item>
          <Dropdown.Item onClick={() => playground.config.updateZoom(1)}>{t('workflowCanvas.tools.zoomTo', { percent: '100%' })}</Dropdown.Item>
          <Dropdown.Item onClick={() => playground.config.updateZoom(1.5)}>{t('workflowCanvas.tools.zoomTo', { percent: '150%' })}</Dropdown.Item>
          <Dropdown.Item onClick={() => playground.config.updateZoom(2.0)}>{t('workflowCanvas.tools.zoomTo', { percent: '200%' })}</Dropdown.Item>
        </Dropdown.Menu>
      }
    >
      <SelectZoom onClick={() => openDropDown(true)}>{Math.floor(tools.zoom * 100)}%</SelectZoom>
    </Dropdown>
  )
}
