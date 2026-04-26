import { c as _c } from "react-compiler-runtime"
import React from 'react'
import type { DeepImmutable } from 'src/types/utils.js'
import { useElapsedTime } from '../../hooks/useElapsedTime.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'
import { Box, Text, useTheme } from '../../ink.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import { Dialog } from '../design-system/Dialog.js'
import { Byline } from '../design-system/Byline.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'
import type { MonitorMcpTaskState } from '../../tasks/MonitorMcpTask/MonitorMcpTask.js'

type Props = {
  task: DeepImmutable<MonitorMcpTaskState>
  onKill?: () => void
  onBack: () => void
}

export function MonitorMcpDetailDialog(t0) {
  const $ = _c(20)
  const { task, onKill, onBack } = t0
  const [theme] = useTheme()
  const elapsedTime = useElapsedTime(task.startTime || Date.now(), task.status === 'running', 1000, 0)

  let t1
  if ($[0] !== onBack) {
    t1 = { back: onBack }
    $[0] = onBack
    $[1] = t1
  } else {
    t1 = $[1]
  }

  let t2
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = { context: 'Monitor MCP Task' }
    $[2] = t2
  } else {
    t2 = $[2]
  }
  useKeybindings(t1, t2)

  let T0, T1, t3, t4
  if (
    $[3] !== elapsedTime ||
    $[4] !== onBack ||
    $[5] !== onKill ||
    $[6] !== task.status ||
    $[7] !== task.id ||
    $[8] !== theme
  ) {
    T0 = Box
    t3 = { flexDirection: 'column', gap: 1 }
    T1 = Text
    t4 = { color: theme.text }

    $[3] = elapsedTime
    $[4] = onBack
    $[5] = onKill
    $[6] = task.status
    $[7] = task.id
    $[8] = theme
    $[9] = T0
    $[10] = t3
    $[11] = T1
    $[12] = t4
  } else {
    T0 = $[9]
    t3 = $[10]
    T1 = $[11]
    t4 = $[12]
  }

  return (
    <T0 {...t3}>
      <Dialog
        title="Monitor MCP Task"
        onClose={onBack}
        footer={
          <>
            <KeyboardShortcutHint keys={['back']} />
            {onKill && task.status === 'running' && (
              <>
                {' '}
                <KeyboardShortcutHint keys={['x']} />
              </>
            )}
          </>
        }
      >
        <T1 {...t4}>
          Task ID: {task.id}
        </T1>
        <T1 {...t4}>
          Status: {task.status}
        </T1>
        <T1 {...t4}>
          Elapsed: {elapsedTime}
        </T1>
      </Dialog>
    </T0>
  )
}
