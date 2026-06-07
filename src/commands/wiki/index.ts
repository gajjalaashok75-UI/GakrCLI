import type { Command } from '../../commands.js'

const wiki = {
  type: 'local-jsx',
  name: 'wiki',
  description: 'Initialize and inspect the GakrCLI project wiki',
  argumentHint: '[init|status|ingest <path>]',
  immediate: true,
  load: () => import('./wiki.js'),
} satisfies Command

export default wiki
