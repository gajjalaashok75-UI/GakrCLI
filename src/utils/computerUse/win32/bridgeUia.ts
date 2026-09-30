/**
 * Adapter between the bridge.py UIA walk and the in-process AccessibilityNode
 * shape used by the executor (findNodeInSnapshot, formatForModel, click_element,
 * type_into_element). Bridge.py is the single source of truth for UIA on
 * Windows; the G-UIA-2 fields (TextPattern text/selection, SelectionPattern
 * selected) are preserved on the `value` field so the model can read document
 * state from a screenshot's accessibility text without an extra round trip.
 */

export interface AccessibilityNode {
  role: string
  name: string
  automationId: string
  bounds: { x: number; y: number; w: number; h: number }
  enabled: boolean
  value?: string
  children?: AccessibilityNode[]
}

/** Shape returned by bridge.py accessibility_snapshot / get_current_state. */
export interface BridgeUiaNode {
  role: string
  name: string
  id: string
  x: number
  y: number
  w: number
  h: number
  on: boolean
  v?: string
  text?: string
  selText?: string
  selected?: string[]
  c?: BridgeUiaNode[]
}

function nodeValue(raw: BridgeUiaNode): string | undefined {
  const parts: string[] = []
  if (raw.v) parts.push(raw.v)
  if (raw.text) parts.push(`text="${raw.text}"`)
  if (raw.selText) parts.push(`selection="${raw.selText}"`)
  if (raw.selected && raw.selected.length) parts.push(`selected=${raw.selected.join('|')}`)
  return parts.length ? parts.join(' ') : undefined
}

export function bridgeToAccessibilityNodes(raw: BridgeUiaNode[]): AccessibilityNode[] {
  return raw.map(n => ({
    role: n.role || '',
    name: n.name || '',
    automationId: n.id || '',
    bounds: { x: n.x || 0, y: n.y || 0, w: n.w || 0, h: n.h || 0 },
    enabled: n.on !== false,
    value: nodeValue(n),
    children: n.c?.length ? bridgeToAccessibilityNodes(n.c) : undefined,
  }))
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export function formatForModel(nodes: AccessibilityNode[], indent = 0): string {
  const lines: string[] = []
  const pad = '  '.repeat(indent)
  for (const node of nodes) {
    let line = `${pad}[${node.role}]`
    if (node.name) line += ` "${truncate(node.name, 40)}"`
    line += ` (${node.bounds.x},${node.bounds.y} ${node.bounds.w}x${node.bounds.h})`
    if (!node.enabled) line += ' DISABLED'
    if (node.value) line += ` value="${truncate(node.value, 80)}"`
    if (node.automationId) line += ` id=${node.automationId}`
    lines.push(line)
    if (node.children) lines.push(formatForModel(node.children, indent + 1))
  }
  return lines.join('\n')
}
