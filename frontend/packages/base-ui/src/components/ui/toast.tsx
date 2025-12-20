/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '../../lib/utils'

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-sm transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        destructive: 'destructive border-destructive bg-destructive text-destructive-foreground',
        success: 'border-green-500 bg-green-50 text-green-800',
        warning: 'border-yellow-500 bg-yellow-50 text-yellow-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const toastActionVariants = cva(
  'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive',
)

const toastCloseVariants = cva(
  'absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-destructive-foreground group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive group-[.destructive]:focus:ring-offset-destructive',
)

const ToastProvider = ToastPrimitive.Provider

const ToastViewport = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Viewport>, React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
        className,
      )}
      {...props}
    />
  ),
)
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const ToastRoot = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
})
ToastRoot.displayName = ToastPrimitive.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action> & React.ComponentProps<'button'>
>(({ className, ...props }, ref) => <ToastPrimitive.Action ref={ref} className={cn(toastActionVariants(), className)} {...props} />)
ToastAction.displayName = ToastPrimitive.Action.displayName

const ToastClose = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Close>, React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Close ref={ref} className={cn(toastCloseVariants(), className)} toast-close="" {...props}>
      <X className="h-4 w-4" />
    </ToastPrimitive.Close>
  ),
)
ToastClose.displayName = ToastPrimitive.Close.displayName

const ToastTitle = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Title>, React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>>(
  ({ className, ...props }, ref) => <ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />,
)
ToastTitle.displayName = ToastPrimitive.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => <ToastPrimitive.Description ref={ref} className={cn('text-sm opacity-90', className)} {...props} />)
ToastDescription.displayName = ToastPrimitive.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof ToastRoot> & {
  title?: string
  description?: string
  action?: React.ReactNode
  duration?: number
  onOpenChange?: (open: boolean) => void
}

type ToastActionElement = React.ReactElement<typeof ToastAction>

// Toast context for managing toasts
const ToastContext = React.createContext<{
  toasts: ToastProps[]
  addToast: (toast: ToastProps) => void
  removeToast: (id: string) => void
}>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

const ToastProviderWithState: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])
  const toastIdRef = React.useRef(0)

  const addToast = React.useCallback((newToast: ToastProps) => {
    const id = `toast-${toastIdRef.current++}`
    const toast = {
      ...newToast,
      id,
      onOpenChange: (open: boolean) => {
        if (!open) {
          removeToast(id)
        }
        newToast.onOpenChange?.(open)
      },
    }

    setToasts(prev => [...prev, toast])

    // Auto remove after duration
    if (newToast.duration !== Infinity) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration || 5000)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  // Register global context on mount
  React.useEffect(() => {
    registerToastContext({ addToast })
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastProvider>
        <ToastViewport />
        {toasts.map(toast => (
          <ToastRoot key={toast.id} {...toast}>
            <div className="grid gap-1">
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
            </div>
            {toast.action}
            <ToastClose />
          </ToastRoot>
        ))}
      </ToastProvider>
    </ToastContext.Provider>
  )
}

// Global toast state management
let globalToastContext: ToastContextType | null = null

type ToastContextType = {
  addToast: (toast: ToastProps) => void
}

export const registerToastContext = (context: ToastContextType) => {
  globalToastContext = context
}

// Static methods for different toast types
const Toast: {
  success: (message: string, options?: Partial<ToastProps>) => void
  error: (message: string, options?: Partial<ToastProps>) => void
  warning: (message: string, options?: Partial<ToastProps>) => void
  info: (message: string, options?: Partial<ToastProps>) => void
} = {
  success: (message: string, options?: Partial<ToastProps>) => {
    if (globalToastContext) {
      globalToastContext.addToast({
        title: '成功',
        description: message,
        variant: 'success',
        duration: 3000,
        ...options,
      })
    }
  },
  error: (message: string, options?: Partial<ToastProps>) => {
    if (globalToastContext) {
      globalToastContext.addToast({
        title: '错误',
        description: message,
        variant: 'destructive',
        duration: 5000,
        ...options,
      })
    }
  },
  warning: (message: string, options?: Partial<ToastProps>) => {
    if (globalToastContext) {
      globalToastContext.addToast({
        title: '警告',
        description: message,
        variant: 'warning',
        duration: 4000,
        ...options,
      })
    }
  },
  info: (message: string, options?: Partial<ToastProps>) => {
    if (globalToastContext) {
      globalToastContext.addToast({
        title: '信息',
        description: message,
        variant: 'default',
        duration: 3000,
        ...options,
      })
    }
  },
}

export {
  type ToastProps,
  type ToastActionElement,
  ToastRoot,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastProviderWithState,
  Toast,
}
