import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay for debugging user issues
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Environment tagging
  environment: process.env.NODE_ENV,

  // Filter out non-critical errors
  beforeSend(event, hint) {
    // Ignore network errors that are expected
    const error = hint.originalException as Error | undefined
    if (error?.message?.includes('Failed to fetch')) {
      return null
    }
    return event
  },

  // Kingpin-specific tags
  initialScope: {
    tags: {
      app: 'kingpin-web',
    },
  },
})
