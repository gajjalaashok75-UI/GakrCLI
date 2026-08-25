import { appendFileSync } from 'node:fs'
import { createRequire, syncBuiltinESMExports } from 'node:module'

const markerPath = process.env.GAKR_TEST_COMPILE_CACHE_MARKER
const behavior = process.env.GAKR_TEST_COMPILE_CACHE_BEHAVIOR
const builtinModule = createRequire(import.meta.url)('node:module')

if (behavior === 'absent') {
  builtinModule.enableCompileCache = undefined
} else if (typeof builtinModule.enableCompileCache === 'function') {
  builtinModule.enableCompileCache = () => {
    if (markerPath) {
      appendFileSync(markerPath, `${JSON.stringify({
        pid: process.pid,
        heapRelaunched: process.env.GAKR_HEAP_RELAUNCHED === '1',
      })}\n`)
    }
    if (behavior === 'throw') throw new Error('injected compile-cache failure')
    if (behavior === 'failed-status') return { status: 0, message: 'injected failure' }
    return { status: 1, directory: '/injected/cache' }
  }
}

syncBuiltinESMExports()
