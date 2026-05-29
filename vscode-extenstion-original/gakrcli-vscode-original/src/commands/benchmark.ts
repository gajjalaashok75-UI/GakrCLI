import type { Command, LocalCommandCall } from '../types/command.js'
import {
  benchmarkMultipleModels,
  formatBenchmarkResults,
  isBenchmarkSupported,
} from '../utils/model/benchmark.js'
import { getCachedOllamaModelOptions } from '../utils/model/ollamaModels.js'

async function runBenchmark(model?: string): Promise<string> {
  if (!isBenchmarkSupported()) {
    return (
      'Benchmark not supported for this provider.\n' +
      'Supported: OpenAI-compatible endpoints (Ollama, NVIDIA NIM, MiniMax)'
    )
  }

  const modelsToBenchmark = model
    ? [model]
    : getCachedOllamaModelOptions()
        .slice(0, 3)
        .map(m => m.value)

  const lines = [`Benchmarking ${modelsToBenchmark.length} model(s)...`]

  const results = await benchmarkMultipleModels(
    modelsToBenchmark,
    (completed, total, result) => {
      lines.push(
        `[${completed}/${total}] ${result.model}: ${
          result.success ? `${result.tokensPerSecond.toFixed(1)} tps` : 'FAILED'
        }`,
      )
    },
  )

  lines.push('', formatBenchmarkResults(results))
  return lines.join('\n')
}

export const call: LocalCommandCall = async args => {
  const model = args.trim() || undefined
  return {
    type: 'text',
    value: await runBenchmark(model),
  }
}

const benchmark = {
  type: 'local',
  name: 'benchmark',
  description: 'Benchmark OpenAI-compatible model throughput',
  argumentHint: '[model]',
  supportsNonInteractive: false,
  load: () => import('./benchmark.js'),
} satisfies Command

export default benchmark
