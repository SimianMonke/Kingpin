import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// =============================================================================
// BUTTON COMPONENT
// Neo-Brutalist design with chip shadow and chamfered corners
// =============================================================================

const buttonVariants = cva(
  // Base styles: Neo-Brutalist foundation
  [
    "inline-flex items-center justify-center gap-2",
    "font-display uppercase tracking-widest",
    "border-2 transition-all duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]",
    "disabled:pointer-events-none disabled:opacity-50",
    // Chip shadow effect
    "shadow-[4px_4px_0_#000] translate-x-0 translate-y-0",
    "active:shadow-none active:translate-x-1 active:translate-y-1",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-primary)]",
          "hover:bg-[var(--color-primary)] hover:text-[var(--color-void)]",
        ],
        secondary: [
          "bg-[var(--color-surface)] border-[var(--color-secondary)] text-[var(--color-secondary)]",
          "hover:bg-[var(--color-secondary)] hover:text-[var(--color-void)]",
        ],
        destructive: [
          "bg-[var(--color-surface)] border-[var(--color-destructive)] text-[var(--color-destructive)]",
          "hover:bg-[var(--color-destructive)] hover:text-[var(--color-void)]",
        ],
        success: [
          "bg-[var(--color-surface)] border-[var(--color-success)] text-[var(--color-success)]",
          "hover:bg-[var(--color-success)] hover:text-[var(--color-void)]",
        ],
        warning: [
          "bg-[var(--color-surface)] border-[var(--color-warning)] text-[var(--color-warning)]",
          "hover:bg-[var(--color-warning)] hover:text-[var(--color-void)]",
        ],
        ghost: [
          "border-transparent shadow-none",
          "text-[var(--color-foreground)]",
          "hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]",
          "active:shadow-none active:translate-x-0 active:translate-y-0",
        ],
        link: [
          "border-transparent shadow-none underline-offset-4",
          "text-[var(--color-primary)]",
          "hover:underline",
          "active:shadow-none active:translate-x-0 active:translate-y-0",
        ],
        outline: [
          "bg-transparent border-[var(--color-primary)]/50 text-[var(--color-primary)]",
          "hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]",
        ],
      },
      size: {
        default: "h-12 px-6 text-sm",
        sm: "h-10 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        xl: "h-16 px-10 text-lg",
        icon: "h-12 w-12 p-0",
        "icon-sm": "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
