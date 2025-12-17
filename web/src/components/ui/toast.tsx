"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// =============================================================================
// TOAST COMPONENT
// Terminal-styled notifications with glitch effects on error
// =============================================================================

const toastVariants = cva(
  [
    // Base styles
    "relative flex items-start gap-3",
    "w-full max-w-md p-4",
    "font-mono text-sm",
    // Glass panel
    "bg-[rgba(18,18,18,0.95)] backdrop-blur-lg backdrop-saturate-[180%]",
    "border-2",
    // Shadow
    "shadow-lg",
    // Animation
    "animate-in slide-in-from-right-full",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-[var(--color-primary)]",
          "text-[var(--color-foreground)]",
        ],
        success: [
          "border-[var(--color-success)]",
          "text-[var(--color-success)]",
          "shadow-[0_0_20px_rgba(0,255,159,0.2)]",
        ],
        error: [
          "border-[var(--color-destructive)]",
          "text-[var(--color-destructive)]",
          "shadow-[0_0_20px_rgba(255,42,109,0.3)]",
          "animate-screen-shake",
        ],
        warning: [
          "border-[var(--color-warning)]",
          "text-[var(--color-warning)]",
          "shadow-[0_0_20px_rgba(255,176,0,0.2)]",
        ],
        info: [
          "border-[var(--color-primary)]",
          "text-[var(--color-primary)]",
          "shadow-[0_0_20px_rgba(0,255,241,0.2)]",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title?: string
  description?: string
  action?: React.ReactNode
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, action, onClose, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant, className }))}
        role="alert"
        {...props}
      >
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          <ToastIcon variant={variant} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <div className={cn(
              "font-display text-xs uppercase tracking-widest mb-1",
              variant === "error" && "animate-chromatic-glitch"
            )}>
              {title}
            </div>
          )}
          {description && (
            <div className="text-[var(--color-foreground)]/80 text-xs">
              {description}
            </div>
          )}
          {children}
        </div>

        {/* Action */}
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "flex-shrink-0 ml-2",
              "text-current opacity-50 hover:opacity-100",
              "transition-opacity duration-100"
            )}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

// =============================================================================
// TOAST ICON
// =============================================================================

interface ToastIconProps {
  variant?: ToastProps["variant"]
}

const ToastIcon: React.FC<ToastIconProps> = ({ variant }) => {
  const iconClass = "w-5 h-5"

  switch (variant) {
    case "success":
      return <CheckIcon className={iconClass} />
    case "error":
      return <ErrorIcon className={cn(iconClass, "animate-pulse")} />
    case "warning":
      return <WarningIcon className={iconClass} />
    case "info":
      return <InfoIcon className={iconClass} />
    default:
      return <TerminalIcon className={iconClass} />
  }
}

// =============================================================================
// TOAST CONTAINER
// Position toasts in top-right corner
// =============================================================================

interface ToastContainerProps {
  children: React.ReactNode
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center"
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  children,
  position = "top-right",
}) => {
  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  }

  return (
    <div
      className={cn(
        "fixed z-[100]",
        "flex flex-col gap-2",
        positionClasses[position]
      )}
    >
      {children}
    </div>
  )
}
ToastContainer.displayName = "ToastContainer"

// =============================================================================
// SIMPLE TOAST HOOK
// Basic state management for toasts
// =============================================================================

type ToastType = ToastProps["variant"]

interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: ToastType
  duration?: number
}

function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const toast = React.useCallback((options: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastItem = { id, ...options }

    setToasts((prev) => [...prev, newToast])

    // Auto dismiss
    const duration = options.duration ?? (options.variant === "error" ? 6000 : 4000)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)

    return id
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = React.useCallback(() => {
    setToasts([])
  }, [])

  return {
    toasts,
    toast,
    dismiss,
    dismissAll,
    // Convenience methods
    success: (title: string, description?: string) =>
      toast({ title, description, variant: "success" }),
    error: (title: string, description?: string) =>
      toast({ title, description, variant: "error" }),
    warning: (title: string, description?: string) =>
      toast({ title, description, variant: "warning" }),
    info: (title: string, description?: string) =>
      toast({ title, description, variant: "info" }),
  }
}

// =============================================================================
// ICONS
// =============================================================================

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

export { Toast, ToastContainer, useToast, toastVariants }
export type { ToastItem, ToastType }
