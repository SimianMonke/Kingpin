'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Bell,
} from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export type AlertType = 'success' | 'error' | 'warning' | 'info'

export interface Alert {
  id: string
  type: AlertType
  title: string
  message?: string
  duration?: number // ms, 0 = persistent
  action?: {
    label: string
    onClick: () => void
  }
  createdAt: number
}

interface AlertContextValue {
  alerts: Alert[]
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => string
  removeAlert: (id: string) => void
  clearAlerts: () => void
}

// =============================================================================
// Context
// =============================================================================

const AlertContext = React.createContext<AlertContextValue | null>(null)

export function useAdminAlerts() {
  const context = React.useContext(AlertContext)
  if (!context) {
    throw new Error('useAdminAlerts must be used within AdminAlertProvider')
  }
  return context
}

// =============================================================================
// Provider
// =============================================================================

interface AdminAlertProviderProps {
  children: React.ReactNode
  maxAlerts?: number
}

export function AdminAlertProvider({
  children,
  maxAlerts = 5,
}: AdminAlertProviderProps) {
  const [alerts, setAlerts] = React.useState<Alert[]>([])

  const addAlert = React.useCallback(
    (alert: Omit<Alert, 'id' | 'createdAt'>): string => {
      const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const newAlert: Alert = {
        ...alert,
        id,
        createdAt: Date.now(),
        duration: alert.duration ?? 5000, // Default 5 seconds
      }

      setAlerts((prev) => {
        const updated = [newAlert, ...prev]
        // Keep only max alerts
        return updated.slice(0, maxAlerts)
      })

      return id
    },
    [maxAlerts]
  )

  const removeAlert = React.useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const clearAlerts = React.useCallback(() => {
    setAlerts([])
  }, [])

  return (
    <AlertContext.Provider value={{ alerts, addAlert, removeAlert, clearAlerts }}>
      {children}
    </AlertContext.Provider>
  )
}

// =============================================================================
// Alert Container (renders alerts)
// =============================================================================

interface AdminAlertContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export function AdminAlertContainer({
  position = 'top-right',
}: AdminAlertContainerProps) {
  const { alerts, removeAlert } = useAdminAlerts()

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  }

  return (
    <div
      className={cn(
        'fixed z-[100] flex flex-col gap-2 w-full max-w-sm',
        positionClasses[position]
      )}
    >
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onDismiss={removeAlert} />
      ))}
    </div>
  )
}

// =============================================================================
// Individual Alert Item
// =============================================================================

interface AlertItemProps {
  alert: Alert
  onDismiss: (id: string) => void
}

function AlertItem({ alert, onDismiss }: AlertItemProps) {
  const [isExiting, setIsExiting] = React.useState(false)

  // Auto-dismiss after duration
  React.useEffect(() => {
    if (alert.duration && alert.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(() => onDismiss(alert.id), 200) // Wait for exit animation
      }, alert.duration)

      return () => clearTimeout(timer)
    }
  }, [alert.id, alert.duration, onDismiss])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(alert.id), 200)
  }

  const typeStyles = {
    success: {
      icon: CheckCircle2,
      bg: 'bg-green-500/10',
      border: 'border-green-500',
      iconColor: 'text-green-500',
      titleColor: 'text-green-400',
    },
    error: {
      icon: AlertCircle,
      bg: 'bg-red-500/10',
      border: 'border-red-500',
      iconColor: 'text-red-500',
      titleColor: 'text-red-400',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-500/10',
      border: 'border-amber-500',
      iconColor: 'text-amber-500',
      titleColor: 'text-amber-400',
    },
    info: {
      icon: Info,
      bg: 'bg-blue-500/10',
      border: 'border-blue-500',
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-400',
    },
  }

  const styles = typeStyles[alert.type]
  const Icon = styles.icon

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        'p-4 rounded-lg',
        'border-2',
        styles.bg,
        styles.border,
        'backdrop-blur-lg',
        'shadow-lg',
        // Animation
        isExiting ? 'animate-out fade-out-0 slide-out-to-right' : 'animate-in fade-in-0 slide-in-from-right',
        'duration-200'
      )}
    >
      {/* Progress bar for timed alerts */}
      {alert.duration && alert.duration > 0 && (
        <div
          className={cn(
            'absolute bottom-0 left-0 h-1',
            styles.iconColor.replace('text-', 'bg-')
          )}
          style={{
            animation: `shrink ${alert.duration}ms linear forwards`,
          }}
        />
      )}

      <div className="flex gap-3">
        <div className={cn('flex-shrink-0', styles.iconColor)}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn('font-display text-sm uppercase tracking-wider', styles.titleColor)}>
            {alert.title}
          </p>
          {alert.message && (
            <p className="mt-1 text-sm text-[var(--color-muted)] font-mono">
              {alert.message}
            </p>
          )}
          {alert.action && (
            <button
              onClick={alert.action.onClick}
              className={cn(
                'mt-2 text-sm font-display uppercase tracking-wider',
                'underline underline-offset-2',
                styles.iconColor,
                'hover:opacity-80'
              )}
            >
              {alert.action.label}
            </button>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className={cn(
            'flex-shrink-0 p-1 rounded',
            'text-[var(--color-muted)] hover:text-[var(--color-foreground)]',
            'transition-colors'
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Simplified hook for common alert operations
 */
export function useAlert() {
  const { addAlert, removeAlert, clearAlerts } = useAdminAlerts()

  return {
    success: (title: string, message?: string, options?: Partial<Alert>) =>
      addAlert({ type: 'success', title, message, ...options }),

    error: (title: string, message?: string, options?: Partial<Alert>) =>
      addAlert({ type: 'error', title, message, duration: 0, ...options }), // Errors persist

    warning: (title: string, message?: string, options?: Partial<Alert>) =>
      addAlert({ type: 'warning', title, message, ...options }),

    info: (title: string, message?: string, options?: Partial<Alert>) =>
      addAlert({ type: 'info', title, message, ...options }),

    dismiss: removeAlert,
    clear: clearAlerts,
  }
}

// =============================================================================
// Bell Icon with Badge (for header)
// =============================================================================

interface AlertBellProps {
  onClick?: () => void
}

export function AlertBell({ onClick }: AlertBellProps) {
  const { alerts } = useAdminAlerts()
  const errorCount = alerts.filter((a) => a.type === 'error').length

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-2 rounded-lg',
        'text-[var(--color-muted)] hover:text-[var(--color-foreground)]',
        'hover:bg-white/5',
        'transition-colors'
      )}
    >
      <Bell className="w-5 h-5" />
      {errorCount > 0 && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5',
            'w-4 h-4 rounded-full',
            'bg-red-500 text-white',
            'text-[10px] font-bold',
            'flex items-center justify-center',
            'animate-pulse'
          )}
        >
          {errorCount > 9 ? '9+' : errorCount}
        </span>
      )}
    </button>
  )
}

// =============================================================================
// CSS for progress bar animation (add to globals.css)
// =============================================================================

// Add this to your globals.css:
// @keyframes shrink {
//   from { width: 100%; }
//   to { width: 0%; }
// }
