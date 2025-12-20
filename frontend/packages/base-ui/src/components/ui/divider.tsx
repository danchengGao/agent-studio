import * as React from 'react'
import { cn } from '../../lib/utils'

function Divider({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('shrink-0 bg-border h-[1px] w-full', className)} {...props} />
}

export { Divider }
