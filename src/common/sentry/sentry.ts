import * as Sentry from '@sentry/node';

/**
 * Error tracking is opt-in: without SENTRY_DSN set, `init` is skipped and
 * every `Sentry.captureException` call elsewhere becomes a safe no-op, so the
 * app behaves identically whether or not Sentry is configured.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
