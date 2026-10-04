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
  /** Element reports IsOffscreen but is kept (marked, not filtered). */
  offscreen?: boolean
  /** UIA keyboard focus is on this element (true focus, not a heuristic). */
  focused?: boolean
  /** ExpandCollapsePattern state: true = expanded, false = collapsed. */
  expanded?: boolean
  /** Per-snapshot node id (bridge `k`). Unique within ONE snapshot only. */
  nodeId?: number
  /** UIA RuntimeId — consumed by the *_id bridge action methods. */
  runtimeId?: number[]
  value?: string
  children?: AccessibilityNode[]
}

/** Shape returned by bridge.py accessibility_snapshot / get_current_state. */
export interface BridgeUiaNode {
  /** Per-snapshot node id (-1 on the truncation note = not an element). */
  k?: number
  role: string
  name: string
  id: string
  x: number
  y: number
  w: number
  h: number
  on: boolean
  /** IsOffscreen=true, emitted only outside the Edit/Document carve-out. */
  off?: boolean
  /** Keyboard focus is on this element (interactive roles only). */
  focus?: boolean
  /** ExpandCollapsePattern state: 0 = collapsed, 1 = expanded. */
  exp?: number
  /** UIA RuntimeId (list of ints) — element identity for *_id actions. */
  rid?: number[]
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
    offscreen: n.off === true || undefined,
    focused: n.focus === true || undefined,
    expanded: typeof n.exp === 'number' ? n.exp === 1 : undefined,
    nodeId: typeof n.k === 'number' && n.k > 0 ? n.k : undefined,
    runtimeId: Array.isArray(n.rid) && n.rid.length ? n.rid : undefined,
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
    if (node.focused) line += ' FOCUSED'
    if (node.expanded === true) line += ' EXPANDED'
    else if (node.expanded === false) line += ' COLLAPSED'
    if (node.offscreen) line += ' OFFSCREEN'
    if (node.value) line += ` value="${truncate(node.value, 80)}"`
    if (node.automationId) line += ` id=${node.automationId}`
    // Per-snapshot node id — the most precise selector for click_element /
    // type_into_element / interact_element (an old bridge without ids just
    // omits it and callers fall back to name/automationId).
    if (node.nodeId !== undefined) line += ` n=${node.nodeId}`
    lines.push(line)
    if (node.children) lines.push(formatForModel(node.children, indent + 1))
  }
  return lines.join('\n')
}
