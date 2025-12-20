import React, { useState, useEffect, useRef } from 'react'
import { Tooltip } from '@mui/material'

interface ConditionalTooltipProps {
  title: string
  children: React.ReactElement
  arrow?: boolean
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * 条件性Tooltip组件 - 只在文本被截断时显示
 * 通过检测元素的scrollWidth和clientWidth来判断是否溢出
 */
const ConditionalTooltip: React.FC<ConditionalTooltipProps> = ({ title, children, arrow = true, placement = 'top' }) => {
  const [isOverflowing, setIsOverflowing] = useState(false)
  const textRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        const element = textRef.current
        setIsOverflowing(element.scrollWidth > element.clientWidth)
      }
    }

    checkOverflow()
    // 监听窗口大小变化
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [title])

  if (isOverflowing && title) {
    return (
      <Tooltip title={title} arrow={arrow} placement={placement}>
        {React.cloneElement(children, { ref: textRef })}
      </Tooltip>
    )
  }

  return React.cloneElement(children, { ref: textRef })
}

export default ConditionalTooltip
