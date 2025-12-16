import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Sentry integration is configured via withSentryConfig below
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,

  // Organization and project for Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map uploads
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only in production
  disableServerWebpackPlugin: process.env.NODE_ENV !== "production",
  disableClientWebpackPlugin: process.env.NODE_ENV !== "production",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
