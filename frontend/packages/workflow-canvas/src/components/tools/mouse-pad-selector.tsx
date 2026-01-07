/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { type CSSProperties, useState } from 'react'

import { Popover, Typography } from '@douyinfe/semi-ui'

import './mouse-pad-selector.less'
import { Mouse, Touchpad } from 'lucide-react'
import { useTranslation } from '../../i18n'

const { Title, Paragraph } = Typography

export enum InteractiveType {
  Mouse = 'MOUSE',
  Pad = 'PAD',
}

export interface MousePadSelectorProps {
  value: InteractiveType
  onChange: (value: InteractiveType) => void
  onPopupVisibleChange?: (visible: boolean) => void
  containerStyle?: CSSProperties
  iconStyle?: CSSProperties
  arrowStyle?: CSSProperties
}

const InteractiveItem: React.FC<{
  title: string
  subTitle: string
  icon: React.ReactNode
  value: InteractiveType
  selected: boolean
  onChange: (value: InteractiveType) => void
}> = ({ title, subTitle, icon, onChange, value, selected }) => (
  <div className={`mouse-pad-option ${selected ? 'mouse-pad-option-selected' : ''}`} onClick={() => onChange(value)}>
    <div className={`mouse-pad-option-icon ${selected ? 'mouse-pad-option-icon-selected' : ''}`}>{icon}</div>
    <Title heading={6} className={`mouse-pad-option-title ${selected ? 'mouse-pad-option-title-selected' : ''}`}>
      {title}
    </Title>
    <Paragraph type="tertiary" className={`mouse-pad-option-subTitle ${selected ? 'mouse-pad-option-subTitle-selected' : ''}`}>
      {subTitle}
    </Paragraph>
  </div>
)

export const MousePadSelector: React.FC<MousePadSelectorProps & React.RefAttributes<HTMLDivElement>> = ({
  value,
  onChange,
  onPopupVisibleChange,
  containerStyle,
  iconStyle,
  arrowStyle,
}) => {
  const { t } = useTranslation()
  const isMouse = value === InteractiveType.Mouse
  const [visible, setVisible] = useState(false)

  return (
    <Popover
      trigger="custom"
      position="topLeft"
      closeOnEsc
      visible={visible}
      onVisibleChange={v => {
        onPopupVisibleChange?.(v)
      }}
      onClickOutSide={() => {
        setVisible(false)
      }}
      spacing={20}
      content={
        <div className={'ui-mouse-pad-selector-popover'}>
          <Typography.Title heading={4}>{t('workflowCanvas.tools.interactiveMode')}</Typography.Title>
          <div className={'ui-mouse-pad-selector-popover-options'}>
            <InteractiveItem
              title={t('workflowCanvas.tools.mouseMode')}
              subTitle={t('workflowCanvas.tools.mouseModeDescription')}
              value={InteractiveType.Mouse}
              selected={value === InteractiveType.Mouse}
              icon={<Mouse />}
              onChange={onChange}
            />

            <InteractiveItem
              title={t('workflowCanvas.tools.touchpadMode')}
              subTitle={t('workflowCanvas.tools.touchpadModeDescription')}
              value={InteractiveType.Pad}
              selected={value === InteractiveType.Pad}
              icon={<Touchpad />}
              onChange={onChange}
            />
          </div>
        </div>
      }
    >
      <div
        className={`ui-mouse-pad-selector ${visible ? 'ui-mouse-pad-selector-active' : ''}`}
        onClick={() => {
          setVisible(!visible)
        }}
        style={containerStyle}
      >
        <div className={'ui-mouse-pad-selector-icon'} style={iconStyle}>
          {isMouse ? <Mouse size={16} /> : <Touchpad size={16} />}
        </div>
      </div>
    </Popover>
  )
}
