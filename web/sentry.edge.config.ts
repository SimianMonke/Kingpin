import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Environment tagging
  environment: process.env.NODE_ENV,

  // Kingpin-specific tags
  initialScope: {
    tags: {
      app: 'kingpin-web',
      runtime: 'edge',
    },
  },
})
