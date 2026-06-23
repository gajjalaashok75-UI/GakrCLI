/**
 * /workflows — manage workflow scripts.
 *
 * Local-jsx panel that displays active and persisted workflow runs.
 */
import type { Command } from '../../commands.js'

const workflows = {
  type: 'local-jsx',
  name: 'workflows',
  description: 'Manage workflow scripts',
  load: () => import('./panelCall.js'),
} satisfies Command

export default workflows
