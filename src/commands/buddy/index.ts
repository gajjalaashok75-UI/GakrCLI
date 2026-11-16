import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Hatch, pet, and manage your GakrCLI companion',
  immediate: true,
  argumentHint: '[status|off|on|mute|unmute|pet|dance|set <form>|name <name>|help]',
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
