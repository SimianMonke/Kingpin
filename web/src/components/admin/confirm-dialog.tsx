'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, AlertCircle, Trash2 } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  /**
   * If set, user must type this exact string to enable confirm button
   */
  typeToConfirm?: string
  /**
   * Hint shown below input for what to type
   */
  typeToConfirmHint?: string
  variant?: 'warning' | 'danger' | 'destructive'
  isLoading?: boolean
}

// =============================================================================
// Component
// =============================================================================

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  typeToConfirm,
  typeToConfirmHint,
  variant = 'warning',
  isLoading = false,
}: ConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = React.useState('')
  const [isConfirming, setIsConfirming] = React.useState(false)

  // Reset input when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setConfirmInput('')
    }
  }, [open])

  const isConfirmEnabled = typeToConfirm
    ? confirmInput === typeToConfirm
    : true

  const handleConfirm = async () => {
    if (!isConfirmEnabled || isConfirming) return

    setIsConfirming(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      console.error('Confirm action failed:', error)
    } finally {
      setIsConfirming(false)
    }
  }

  const variantStyles = {
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      borderColor: 'border-amber-500',
      buttonVariant: 'warning' as const,
      glowColor: 'shadow-[0_0_30px_rgba(245,158,11,0.2)]',
    },
    danger: {
      icon: AlertCircle,
      iconColor: 'text-red-500',
      borderColor: 'border-red-500',
      buttonVariant: 'destructive' as const,
      glowColor: 'shadow-[0_0_30px_rgba(239,68,68,0.2)]',
    },
    destructive: {
      icon: Trash2,
      iconColor: 'text-red-500',
      borderColor: 'border-red-500',
      buttonVariant: 'destructive' as const,
      glowColor: 'shadow-[0_0_30px_rgba(239,68,68,0.2)]',
    },
  }

  const styles = variantStyles[variant]
  const Icon = styles.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          styles.borderColor,
          styles.glowColor,
          'max-w-md'
        )}
      >
        <DialogClose />
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-black/50', styles.iconColor)}>
              <Icon className="w-6 h-6" />
            </div>
            <DialogTitle className={styles.iconColor}>{title}</DialogTitle>
          </div>
          <DialogDescription className="mt-2">{description}</DialogDescription>
        </DialogHeader>

        {typeToConfirm && (
          <DialogBody className="pt-0">
            <div className="space-y-2">
              <label className="block text-sm font-mono text-[var(--color-muted)]">
                {typeToConfirmHint || `Type "${typeToConfirm}" to confirm:`}
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={typeToConfirm}
                autoComplete="off"
                autoFocus
                className={cn(
                  'w-full px-3 py-2 rounded',
                  'bg-black/50 border-2',
                  'font-mono text-sm',
                  'placeholder:text-[var(--color-muted)]/50',
                  'focus:outline-none focus:ring-2 focus:ring-offset-0',
                  isConfirmEnabled
                    ? 'border-green-500 focus:ring-green-500/50 text-green-400'
                    : 'border-[var(--color-muted)]/30 focus:ring-[var(--color-primary)]/50'
                )}
              />
              {typeToConfirm && confirmInput && !isConfirmEnabled && (
                <p className="text-xs text-red-400 font-mono">
                  Input does not match. Type exactly: {typeToConfirm}
                </p>
              )}
            </div>
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming || isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={styles.buttonVariant}
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isConfirming || isLoading}
            className={cn(
              !isConfirmEnabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isConfirming || isLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Helper: useConfirmDialog hook for easier usage
// =============================================================================

interface UseConfirmDialogOptions {
  title: string
  description: string
  confirmText?: string
  typeToConfirm?: string
  typeToConfirmHint?: string
  variant?: 'warning' | 'danger' | 'destructive'
  onConfirm: () => void | Promise<void>
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = React.useState<{
    open: boolean
    options: UseConfirmDialogOptions | null
  }>({
    open: false,
    options: null,
  })

  const confirm = React.useCallback((options: UseConfirmDialogOptions) => {
    setDialogState({ open: true, options })
  }, [])

  const close = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }))
  }, [])

  const ConfirmDialogComponent = React.useMemo(() => {
    if (!dialogState.options) return null

    return (
      <ConfirmDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={dialogState.options.title}
        description={dialogState.options.description}
        confirmText={dialogState.options.confirmText}
        typeToConfirm={dialogState.options.typeToConfirm}
        typeToConfirmHint={dialogState.options.typeToConfirmHint}
        variant={dialogState.options.variant}
        onConfirm={dialogState.options.onConfirm}
      />
    )
  }, [dialogState, close])

  return {
    confirm,
    close,
    ConfirmDialog: ConfirmDialogComponent,
  }
}

// =============================================================================
// Loading Spinner
// =============================================================================

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
