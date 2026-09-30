/**
 * Element-targeted lookup over the AccessibilityNode tree produced by
 * bridgeUia.ts. The UIA walk itself is performed by bridge.py
 * (accessibility_snapshot); this file only contains the model-facing node
 * search used by click_element / type_into_element.
 */

import type { AccessibilityNode } from './bridgeUia.js'

export type { AccessibilityNode }

/**
 * Find an element in the accessibility tree by name, role, or automationId.
 * Returns the first match.
 */
export function findNodeInSnapshot(
  nodes: AccessibilityNode[],
  query: { name?: string; role?: string; automationId?: string },
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
    if (match && (query.name || query.role || query.automationId)) return node

    if (node.children) {
      const found = findNodeInSnapshot(node.children, query)
      if (found) return found
    }
  }
  return null
}
