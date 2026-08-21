import { feature } from 'bun:bundle'
import { z } from 'zod/v4'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { buildTool } from 'src/Tool.js'
import { lazySchema } from 'src/utils/lazySchema.js'
import { notifyAutomationStateChanged } from 'src/utils/sessionState.js'
import { SLEEP_TOOL_NAME, DESCRIPTION, SLEEP_TOOL_PROMPT } from './prompt.js'
import type { CanUseToolFn } from 'src/hooks/useCanUseTool.js'
import type { AssistantMessage } from 'src/types/message.js'
import type { ToolCallProgress, ToolUseContext } from 'src/Tool.js'

const SLEEP_WAKE_CHECK_INTERVAL_MS = 500
const SLEEP_PROGRESS_INTERVAL_MS = 1000

const inputSchema = lazySchema(() =>
  z.strictObject({
    duration_seconds: z
      .number()
      .describe(
        'How long to sleep in seconds. Can be interrupted by the user at any time.',
      ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>
type SleepInput = z.infer<InputSchema>

type SleepOutput = { slept_seconds: number; interrupted: boolean }

type SleepProgressData = {
  type: 'sleep_progress'
  elapsed_seconds: number
  total_seconds: number
  remaining_seconds: number
  interrupted: boolean
}

function isProactiveAutomationEnabled(): boolean {
  if (!(feature('PROACTIVE') || feature('KAIROS'))) {
    return false
  }

  const mod =
    require('src/proactive/index.js') as typeof import('src/proactive/index.js')
  return mod.isProactiveActive()
}

function isProactiveSleepAllowed(): boolean {
  // SleepTool should always be allowed - it works in both proactive and normal REPL mode
  // The proactive mode check is only for auto-sleep between ticks, not manual Sleep tool calls
  return true
}

function hasQueuedWakeSignal(): boolean {
  const queue =
    require('src/utils/messageQueueManager.js') as typeof import('src/utils/messageQueueManager.js')
  return queue.hasCommandsInQueue()
}

function shouldInterruptSleep(): boolean {
  // Only interrupt if there's queued work (for proactive mode auto-wake)
  // In normal mode, hasQueuedWakeSignal() will be false, so sleep won't be interrupted
  return hasQueuedWakeSignal()
}

export const SleepTool = buildTool({
  name: SLEEP_TOOL_NAME,
  searchHint: 'wait pause sleep rest idle duration timer',
  maxResultSizeChars: 1_000,
  strict: true,

  get inputSchema(): InputSchema {
    return inputSchema()
  },

  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return SLEEP_TOOL_PROMPT
  },

  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  interruptBehavior() {
    return 'cancel'
  },

  userFacingName() {
    return SLEEP_TOOL_NAME
  },

  renderToolUseMessage(input: Partial<SleepInput>) {
    const secs = input.duration_seconds ?? '?'
    return `Sleep: ${secs}s`
  },

  renderToolUseProgressMessage(
    progressMessages: ProgressMessage<SleepProgressData>[],
    _options: { tools: Tools; verbose: boolean; terminalSize?: { columns: number; rows: number }; inProgressToolCallCount?: number; isTranscriptMode?: boolean },
  ): React.ReactNode {
    const lastProgress = progressMessages.at(-1)?.data
    if (!lastProgress || lastProgress.type !== 'sleep_progress') {
      return <Text dimColor>Sleeping…</Text>
    }
    const { elapsed_seconds, total_seconds, remaining_seconds, interrupted } = lastProgress
    if (interrupted) {
      return <Text warnColor>Sleep interrupted after {elapsed_seconds}s</Text>
    }
    return <Text dimColor>Sleeping… {elapsed_seconds}s / {total_seconds}s (remaining: {remaining_seconds}s)</Text>
  },

  mapToolResultToToolResultBlockParam(
    content: SleepOutput,
    toolUseID: string,
  ): ToolResultBlockParam {
    const msg = content.interrupted
      ? `Sleep interrupted after ${content.slept_seconds}s`
      : `Slept for ${content.slept_seconds}s`
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: msg,
    }
  },

  async call(
    input: SleepInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
    onProgress?: ToolCallProgress<SleepProgressData>,
  ): Promise<ToolResult<SleepOutput>> {
    // Don't enter sleep if proactive was disabled or new work arrived while
    // the model was deciding to wait.
    if (shouldInterruptSleep()) {
      return {
        data: {
          slept_seconds: 0,
          interrupted: true,
        },
      }
    }

    const { duration_seconds } = input
    const startTime = Date.now()
    const sleepUntil = startTime + duration_seconds * 1000

    if (isProactiveAutomationEnabled()) {
      notifyAutomationStateChanged({
        enabled: true,
        phase: 'sleeping',
        next_tick_at: null,
        sleep_until: sleepUntil,
      })
    }

    try {
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | null = null
        let wakeCheck: ReturnType<typeof setInterval> | null = null
        let progressTimer: ReturnType<typeof setInterval> | null = null
        let settled = false
        let lastProgressSeconds = 0

        const cleanup = () => {
          if (timer !== null) {
            clearTimeout(timer)
            timer = null
          }
          if (wakeCheck !== null) {
            clearInterval(wakeCheck)
            wakeCheck = null
          }
          if (progressTimer !== null) {
            clearInterval(progressTimer)
            progressTimer = null
          }
          context.abortController.signal.removeEventListener('abort', onAbort)
        }

        const finish = () => {
          if (settled) return
          settled = true
          cleanup()
          resolve()
        }

        const interrupt = () => {
          if (settled) return
          settled = true
          cleanup()
          reject(new Error('interrupted'))
        }

        const onAbort = () => {
          interrupt()
        }

        timer = setTimeout(finish, duration_seconds * 1000)

        // Abort via user interrupt
        if (context.abortController.signal.aborted) {
          interrupt()
          return
        }
        context.abortController.signal.addEventListener('abort', onAbort, {
          once: true,
        })

        // Poll proactive state and the shared command queue so new work can
        // wake Sleep without waiting for the full duration.
        wakeCheck = setInterval(() => {
          if (shouldInterruptSleep()) {
            interrupt()
          }
        }, SLEEP_WAKE_CHECK_INTERVAL_MS)

        // Send progress updates with countdown
        if (onProgress && duration_seconds > 0) {
          // Send initial progress (0s elapsed, full remaining)
          onProgress({
            toolUseID: context.toolUseID,
            data: {
              type: 'sleep_progress',
              elapsed_seconds: 0,
              total_seconds: duration_seconds,
              remaining_seconds: duration_seconds,
              interrupted: false,
            },
          })

          if (duration_seconds > 1) {
            progressTimer = setInterval(() => {
              const elapsed = Math.floor((Date.now() - startTime) / 1000)
              if (elapsed !== lastProgressSeconds && elapsed < duration_seconds) {
                lastProgressSeconds = elapsed
                const remaining = Math.max(0, duration_seconds - elapsed)
                onProgress({
                  toolUseID: context.toolUseID,
                  data: {
                    type: 'sleep_progress',
                    elapsed_seconds: elapsed,
                    total_seconds: duration_seconds,
                    remaining_seconds: remaining,
                    interrupted: false,
                  },
                })
              }
            }, SLEEP_PROGRESS_INTERVAL_MS)
          }
        }
      })
      return {
        data: {
          slept_seconds: duration_seconds,
          interrupted: false,
        },
      }
    } catch {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      return {
        data: {
          slept_seconds: elapsed,
          interrupted: true,
        },
      }
    } finally {
      notifyAutomationStateChanged(
        isProactiveAutomationEnabled()
          ? {
              enabled: true,
              phase: null,
              next_tick_at: null,
              sleep_until: null,
            }
          : null,
      )
    }
  },
})
