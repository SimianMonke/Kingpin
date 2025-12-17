import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// =============================================================================
// INPUT COMPONENT
// Terminal-styled with sharp edges and cyan focus ring
// =============================================================================

const inputVariants = cva(
  [
    // Base styles
    "flex w-full",
    "font-mono text-sm",
    "bg-[var(--color-surface)]",
    "border-2 border-[rgba(0,255,241,0.2)]",
    "text-[var(--color-foreground)]",
    "placeholder:text-[var(--color-muted-foreground)]",
    // Focus states
    "focus-visible:outline-none",
    "focus-visible:border-[var(--color-primary)]",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20",
    // Disabled state
    "disabled:cursor-not-allowed disabled:opacity-50",
    // Transition
    "transition-colors duration-100",
  ],
  {
    variants: {
      size: {
        default: "h-12 px-4 py-2",
        sm: "h-10 px-3 py-1 text-xs",
        lg: "h-14 px-5 py-3",
      },
      variant: {
        default: "",
        ghost: [
          "bg-transparent border-transparent",
          "hover:border-[rgba(0,255,241,0.2)]",
        ],
        terminal: [
          "bg-[var(--color-void)]",
          "border-[var(--color-success)]/30",
          "text-[var(--color-success)]",
          "placeholder:text-[var(--color-success)]/50",
          "focus-visible:border-[var(--color-success)]",
          "focus-visible:ring-[var(--color-success)]/20",
        ],
      },
      error: {
        true: [
          "border-[var(--color-destructive)]",
          "focus-visible:border-[var(--color-destructive)]",
          "focus-visible:ring-[var(--color-destructive)]/20",
        ],
        false: "",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
      error: false,
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, variant, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ size, variant, error, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

// =============================================================================
// TEXTAREA COMPONENT
// =============================================================================

const textareaVariants = cva(
  [
    "flex min-h-[120px] w-full",
    "font-mono text-sm",
    "bg-[var(--color-surface)]",
    "border-2 border-[rgba(0,255,241,0.2)]",
    "text-[var(--color-foreground)]",
    "placeholder:text-[var(--color-muted-foreground)]",
    "focus-visible:outline-none",
    "focus-visible:border-[var(--color-primary)]",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "transition-colors duration-100",
    "resize-none",
  ],
  {
    variants: {
      size: {
        default: "px-4 py-3",
        sm: "px-3 py-2 text-xs",
        lg: "px-5 py-4",
      },
      error: {
        true: [
          "border-[var(--color-destructive)]",
          "focus-visible:border-[var(--color-destructive)]",
          "focus-visible:ring-[var(--color-destructive)]/20",
        ],
        false: "",
      },
    },
    defaultVariants: {
      size: "default",
      error: false,
    },
  }
)

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ size, error, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

// =============================================================================
// LABEL COMPONENT
// =============================================================================

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "font-display text-xs uppercase tracking-widest",
      "text-[var(--color-muted)]",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      error && "text-[var(--color-destructive)]",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

export { Input, Textarea, Label, inputVariants, textareaVariants }
