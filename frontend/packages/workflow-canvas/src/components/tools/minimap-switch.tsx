/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Tooltip, IconButton } from '@douyinfe/semi-ui'
import { UIIconMinimap } from './styles'

export const MinimapSwitch = (props: { minimapVisible: boolean; setMinimapVisible: (visible: boolean) => void }) => {
  const { minimapVisible, setMinimapVisible } = props

  return (
    <Tooltip content="小地图">
      <IconButton
        type="tertiary"
        theme="borderless"
        icon={<UIIconMinimap height={18} width={18} style={{ opacity: minimapVisible ? 1 : 0.7 }} color={minimapVisible ? undefined : '#060709cc'} />}
        onClick={() => setMinimapVisible(!minimapVisible)}
      />
    </Tooltip>
  )
}
