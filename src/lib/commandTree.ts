import type { CommandNode } from '../types'

/** A node with no children is a promptable leaf (a target you can dispatch at). */
export function isLeaf(node: CommandNode): boolean {
  return !node.children || node.children.length === 0
}

/** Depth-first list of every leaf target in the tree. Pure. */
export function flattenLeaves(nodes: CommandNode[]): CommandNode[] {
  const out: CommandNode[] = []
  for (const n of nodes) {
    if (isLeaf(n)) out.push(n)
    else out.push(...flattenLeaves(n.children!))
  }
  return out
}

/** Find a node by id anywhere in the tree (branch or leaf). Pure. */
export function findNode(nodes: CommandNode[], id: string): CommandNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findNode(n.children, id)
      if (found) return found
    }
  }
  return undefined
}
