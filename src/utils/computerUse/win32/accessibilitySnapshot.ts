/**
 * Element-targeted lookup over the AccessibilityNode tree produced by
 * bridgeUia.ts. The UIA walk itself is performed by bridge.py
 * (accessibility_snapshot); this file only contains the model-facing node
 * search used by click_element / type_into_element / interact_element.
 */

import type { AccessibilityNode } from './bridgeUia.js'

export type { AccessibilityNode }

export interface NodeQuery {
  name?: string
  role?: string
  automationId?: string
  /** Per-snapshot node id (`n=` in the model-facing tree). Most precise. */
  nodeId?: number
}

/**
 * Find an element in the accessibility tree by nodeId, name, role, or
 * automationId. Returns the first match.
 */
export function findNodeInSnapshot(
  nodes: AccessibilityNode[],
  query: NodeQuery,
): AccessibilityNode | null {
  for (const node of nodes) {
    let match = true
    if (
      query.name &&
      !node.name.toLowerCase().includes(query.name.toLowerCase())
    )
      match = false
    if (query.role && node.role.toLowerCase() !== query.role.toLowerCase())
      match = false
    if (query.automationId && node.automationId !== query.automationId)
      match = false
    if (query.nodeId !== undefined && node.nodeId !== query.nodeId)
      match = false
    if (
      match &&
      (query.name || query.role || query.automationId || query.nodeId !== undefined)
    )
      return node

    if (node.children) {
      const found = findNodeInSnapshot(node.children, query)
      if (found) return found
    }
  }
  return null
}

/**
 * Find a node by its per-snapshot id, returning the node (which carries the
 * RuntimeId consumed by the bridge's *_id action methods).
 */
export function findNodeById(
  nodes: AccessibilityNode[],
  nodeId: number,
): AccessibilityNode | null {
  return findNodeInSnapshot(nodes, { nodeId })
}
