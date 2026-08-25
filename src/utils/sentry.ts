/**
 * Sentry integration module
 *
 * Initializes Sentry SDK when SENTRY_DSN environment variable is set.
 * When DSN is not configured, all exports are no-ops.
 */

import * as Sentry from '@sentry/node'
import { logForDebugging } from './debug.js'
import { TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS as TelemetrySafeError } from './errors.js'
import { isTelemetryDisabled } from './privacyLevel.js'

declare const BUILD_ENV: string | undefined

let initialized = false

/**
 * Initialize Sentry SDK. Safe to call multiple times — subsequent calls are no-ops.
 * Only activates when SENTRY_DSN environment variable is set.
 */
export function initSentry(): void {
  if (initialized) {
    return
  }

  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    logForDebugging('[sentry] SENTRY_DSN not set, skipping initialization')
    return
  }

  Sentry.init({
    dsn,
    release: typeof MACRO !== 'undefined' ? MACRO.VERSION : undefined,
    environment:
      typeof BUILD_ENV !== 'undefined'
        ? (BUILD_ENV as string)
        : process.env.NODE_ENV || 'development',

    // Limit breadcrumbs and attachments to control payload size
    maxBreadcrumbs: 20,

    // Sample rate for error events (1.0 = capture all)
    sampleRate: 1.0,

    // Filter sensitive information before sending
    beforeSend(event) {
      // Strip auth headers from request data
      const request = event.request
      if (request?.headers) {
        const sensitiveHeaders = [
          'authorization',
          'x-api-key',
          'cookie',
          'set-cookie',
        ]
        for (const key of Object.keys(request.headers)) {
          if (sensitiveHeaders.includes(key.toLowerCase())) {
            delete request.headers[key]
          }
        }
      }

      return event
    },

    // Ignore specific error patterns
    ignoreErrors: [
      // Network errors from unreachable hosts — not actionable
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      // User-initiated aborts
      'AbortError',
      'The user aborted a request',
      // Interactive cancellation signals
      'CancelError',
    ],

    beforeSendTransaction(_event) {
      // Don't send performance transactions for now — errors only
      return null
    },
  })

  initialized = true
  logForDebugging('[sentry] Initialized successfully')
}

/**
 * Capture an exception and send it to Sentry.
 * No-op if Sentry has not been initialized.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized) {
    return
  }

  try {
    Sentry.withScope(scope => {
      if (context) {
        scope.setExtras(context)
      }
      Sentry.captureException(error)
    })
  } catch {
    // Sentry itself failed — don't let it crash the app
  }
}

/**
 * Set a tag on the current scope for grouping/filtering in Sentry.
 * No-op if Sentry has not been initialized.
 */
export function setTag(key: string, value: string): void {
  if (!initialized) {
    return
  }

  try {
    Sentry.setTag(key, value)
  } catch {
    // Ignore
  }
}

/**
 * Set user context in Sentry for error attribution.
 * No-op if Sentry has not been initialized.
 */
export function setUser(user: {
  id?: string
  email?: string
  username?: string
}): void {
  if (!initialized) {
    return
  }

  try {
    Sentry.setUser(user)
  } catch {
    // Ignore
  }
}

/**
 * Flush pending Sentry events and close the client.
 * Call during graceful shutdown to ensure events are sent.
 */
export async function closeSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) {
    return
  }

  try {
    await Sentry.close(timeoutMs)
    logForDebugging('[sentry] Closed successfully')
  } catch {
    // Ignore — we're shutting down anyway
  }
}

/**
 * Check if Sentry is initialized. Useful for conditional UI rendering.
 */
export function isSentryInitialized(): boolean {
  return initialized
}

// ─── Env-driven, opt-in error reporting ─────────────────────────────────────
//
// A second, deliberately minimal surface used by the crash handlers in
// gracefulShutdown. Disabled by default: enabled only when SENTRY_DSN is set
// AND telemetry is not disabled via DISABLE_TELEMETRY /
// GAKRCLI_DISABLE_NONESSENTIAL_TRAFFIC.
//
// Only TelemetrySafeError.telemetryMessage (never a raw error.message) is
// sent, so file paths and other PII cannot leak into Sentry. This is why it
// does not reuse captureException() above — that path forwards raw errors.

let sentryReportingInitialized = false
let sentryModule: typeof import('@sentry/node') | null = null

export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN) && !isTelemetryDisabled()
}

/**
 * Lazily initializes Sentry for opt-in error reporting. No-op if SENTRY_DSN is
 * unset or telemetry is disabled. Safe to call multiple times; only initializes
 * once. Async because @sentry/node is loaded via dynamic import — this bundle
 * is ESM and does not define require().
 */
export async function initializeSentry(): Promise<void> {
  if (sentryReportingInitialized || !isSentryEnabled()) {
    return
  }
  sentryReportingInitialized = true

  try {
    // Dynamic import so the module resolution (and any test-time mock) is
    // honored, and so it works under ESM where require() is not defined.
    sentryModule = await import('@sentry/node')
    sentryModule.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: 0,
      // Disable Sentry's automatic uncaughtException/unhandledRejection
      // integrations. Those hooks report raw error content, bypassing the
      // TelemetrySafeError sanitization in reportErrorToSentry(). Only
      // explicit reportErrorToSentry() calls should ever send data.
      defaultIntegrations: false,
    })
  } catch {
    // Never let Sentry setup crash the CLI.
    sentryModule = null
  }
}

/**
 * Reports an error to Sentry if enabled. Only sends the sanitized
 * telemetryMessage for TelemetrySafeError instances. Errors that are not
 * TelemetrySafeError are NOT reported, since their raw message may contain
 * file paths or other PII — never send an implicit raw error message.
 */
export function reportErrorToSentry(error: unknown): void {
  if (!sentryModule || !isSentryEnabled()) {
    return
  }

  try {
    if (error instanceof TelemetrySafeError) {
      sentryModule.captureMessage(error.telemetryMessage, 'error')
    }
    // Non-TelemetrySafeError errors are intentionally not reported — their
    // message has not been vetted as safe to send.
  } catch {
    // Reporting must never throw.
  }
}
