import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ActionSlotTargetProps {
  name: string
  className?: string
  style?: React.CSSProperties
}

// 放置在标题栏等位置的插槽目标容器
export const ActionSlotTarget: React.FC<ActionSlotTargetProps> = ({ name, className, style }) => {
  return <div data-slot={name} className={className} style={style} />
}

export interface ActionSlotMountProps {
  name: string
  children: React.ReactNode
}

// 在任意子组件中，把内容挂载到指定插槽目标
export const ActionSlotMount: React.FC<ActionSlotMountProps> = ({ name, children }) => {
  const [container, setContainer] = useState<Element | null>(null)

  useEffect(() => {
    const el = document.querySelector(`[data-slot="${name}"]`)
    setContainer(el)
  }, [name])

  if (!container) return null
  return createPortal(children, container)
}