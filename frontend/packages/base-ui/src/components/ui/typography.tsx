import * as React from 'react'
import { cn } from '../../lib/utils'

function Text({
  className,
  ellipsis,
  children,
  ...props
}: React.ComponentProps<'span'> & {
  ellipsis?: { showTooltip?: boolean }
}) {
  return (
    <span
      className={cn(ellipsis && 'inline-block overflow-hidden text-ellipsis whitespace-nowrap', className)}
      style={{
        maxWidth: ellipsis ? '100%' : undefined,
      }}
      {...props}
    >
      {children}
    </span>
  )
}

export { Text }
