"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

// =============================================================================
// DIALOG COMPONENT
// Glass panel modal with chromatic aberration on open
// =============================================================================

interface DialogContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialog() {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog")
  }
  return context
}

// =============================================================================
// ROOT
// =============================================================================

interface DialogProps {
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const Dialog: React.FC<DialogProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(value)
      }
      onOpenChange?.(value)
    },
    [isControlled, onOpenChange]
  )

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}
Dialog.displayName = "Dialog"

// =============================================================================
// TRIGGER
// =============================================================================

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ children, asChild, onClick, ...props }, ref) => {
    const { setOpen } = useDialog()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      setOpen(true)
    }

    if (asChild && React.isValidElement(children)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return React.cloneElement(children as any, {
        onClick: () => setOpen(true),
      })
    }

    return (
      <button ref={ref} onClick={handleClick} {...props}>
        {children}
      </button>
    )
  }
)
DialogTrigger.displayName = "DialogTrigger"

// =============================================================================
// PORTAL & OVERLAY
// =============================================================================

interface DialogPortalProps {
  children: React.ReactNode
}

const DialogPortal: React.FC<DialogPortalProps> = ({ children }) => {
  const { open } = useDialog()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !open) return null

  return <>{children}</>
}

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { setOpen } = useDialog()

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50",
        "bg-black/80 backdrop-blur-sm",
        "animate-in fade-in-0",
        className
      )}
      onClick={() => setOpen(false)}
      {...props}
    />
  )
})
DialogOverlay.displayName = "DialogOverlay"

// =============================================================================
// CONTENT
// =============================================================================

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, onClose, ...props }, ref) => {
    const { open, setOpen } = useDialog()

    // Handle escape key
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false)
          onClose?.()
        }
      }

      if (open) {
        document.addEventListener("keydown", handleEscape)
        document.body.style.overflow = "hidden"
      }

      return () => {
        document.removeEventListener("keydown", handleEscape)
        document.body.style.overflow = ""
      }
    }, [open, setOpen, onClose])

    return (
      <DialogPortal>
        <DialogOverlay />
        <div
          ref={ref}
          className={cn(
            // Position
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            // Sizing
            "w-full max-w-lg max-h-[90vh]",
            // Glass panel styling
            "bg-[rgba(18,18,18,0.95)] backdrop-blur-lg backdrop-saturate-[180%]",
            "border-2 border-[var(--color-primary)]",
            // Scanlines
            "scanlines",
            // Animation
            "animate-in fade-in-0 zoom-in-95",
            // Glow
            "shadow-[0_0_30px_rgba(0,255,241,0.2)]",
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
        </div>
      </DialogPortal>
    )
  }
)
DialogContent.displayName = "DialogContent"

// =============================================================================
// HEADER
// =============================================================================

const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 p-6",
      "border-b-2 border-[rgba(0,255,241,0.2)]",
      className
    )}
    {...props}
  />
))
DialogHeader.displayName = "DialogHeader"

// =============================================================================
// TITLE
// =============================================================================

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "font-display text-xl uppercase tracking-widest",
      "text-[var(--color-primary)]",
      "chromatic-hover",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

// =============================================================================
// DESCRIPTION
// =============================================================================

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm font-mono",
      "text-[var(--color-muted)]",
      className
    )}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

// =============================================================================
// BODY
// =============================================================================

const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 overflow-y-auto", className)}
    {...props}
  />
))
DialogBody.displayName = "DialogBody"

// =============================================================================
// FOOTER
// =============================================================================

const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end gap-3",
      "p-6 border-t-2 border-[rgba(0,255,241,0.2)]",
      className
    )}
    {...props}
  />
))
DialogFooter.displayName = "DialogFooter"

// =============================================================================
// CLOSE
// =============================================================================

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ children, asChild, onClick, className, ...props }, ref) => {
    const { setOpen } = useDialog()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      setOpen(false)
    }

    if (asChild && React.isValidElement(children)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return React.cloneElement(children as any, {
        onClick: () => setOpen(false),
      })
    }

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        className={cn(
          "absolute right-4 top-4",
          "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
          className
        )}
        {...props}
      >
        {children || <CloseIcon className="w-4 h-4" />}
      </Button>
    )
  }
)
DialogClose.displayName = "DialogClose"

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

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogOverlay,
  DialogPortal,
}
