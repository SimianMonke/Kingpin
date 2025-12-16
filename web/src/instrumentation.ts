export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = async (
  err: Error,
  request: { path: string; method: string; headers: { [key: string]: string } },
  context: { routerKind: string; routePath: string; routeType: string; revalidateReason?: string }
) => {
  const Sentry = await import('@sentry/nextjs')

  Sentry.captureException(err, {
    tags: {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    },
    extra: {
      path: request.path,
      method: request.method,
    },
  })
}
