import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// =============================================================================
// CARD COMPONENT
// Liquid Glass effect with Neo-Brutalist borders and scanlines
// =============================================================================

const cardVariants = cva(
  [
    // Liquid Glass base
    "backdrop-blur-lg backdrop-saturate-[180%]",
    // Neo-Brutalist borders
    "border-2",
    // Scanlines overlay via position relative
    "relative",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-[rgba(18,18,18,0.65)]",
          "border-[rgba(0,255,241,0.2)]",
        ],
        solid: [
          "bg-[var(--color-surface)]",
          "border-[rgba(0,255,241,0.2)]",
          "backdrop-blur-none",
        ],
        bright: [
          "bg-[rgba(18,18,18,0.45)]",
          "backdrop-saturate-200",
          "border-[rgba(0,255,241,0.3)]",
        ],
        outlined: [
          "bg-transparent",
          "border-[var(--color-primary)]",
          "backdrop-blur-none",
        ],
        ghost: [
          "bg-transparent",
          "border-transparent",
          "backdrop-blur-none",
        ],
      },
      glow: {
        none: "",
        primary: "shadow-[0_0_20px_rgba(0,255,241,0.3)]",
        secondary: "shadow-[0_0_20px_rgba(255,0,141,0.3)]",
        success: "shadow-[0_0_20px_rgba(0,255,159,0.3)]",
        destructive: "shadow-[0_0_20px_rgba(255,42,109,0.3)]",
      },
      scanlines: {
        true: "scanlines",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      glow: "none",
      scanlines: false,
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, glow, scanlines, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, glow, scanlines, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 p-6",
      "border-b border-[rgba(0,255,241,0.1)]",
      className
    )}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-display text-lg uppercase tracking-widest",
      "text-[var(--color-primary)]",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm text-[var(--color-muted)]",
      "font-mono",
      className
    )}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 pt-0", className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-6 pt-0",
      "border-t border-[rgba(0,255,241,0.1)]",
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }
