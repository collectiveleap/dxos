//
// Copyright 2026 DXOS.org
//

import { Obj } from '@dxos/echo';

import { tryGetSource, tryGetTarget } from './edges';
import { type Edge, type Node } from '../types';

// BR-16: a row's object is not necessarily a Bramble `Node`. A structural edge may target any
// object, and that object gets a row rendered by its own type (a `Node` via `RowEditor`, a foreign
// object via its `Section` surface — plan 1.3a). So the row carries `Obj.Unknown`, not `Node`;
// Node-specific consumers narrow with `Obj.instanceOf(Node, …)`.
export type OutlineRow = { node: Obj.Unknown; depth: number; edge: Edge; hasChildren: boolean; collapsed: boolean };

/**
 * Pure view-model: given all Bramble structural edges and a view root, produce the
 * ordered, depth-annotated row list for the root's structural-successor subtree.
 * The root itself is excluded (it renders as the outline header).
 *
 * A node whose id is in `collapsed` still emits its own row (with `collapsed: true`),
 * but its successor subtree is omitted from the result.
 */
export const outlineRows = (edges: Edge[], root: Node, collapsed: ReadonlySet<string> = new Set()): OutlineRow[] => {
  const structural = edges.filter((e) => e.kind === 'structural');
  const bySource = new Map<string, Edge[]>();
  for (const edge of structural) {
    const source = tryGetSource(edge);
    if (!source) {
      continue; // dangling structural edge (source removed) — skip, don't crash the outline
    }
    const list = bySource.get(source.id) ?? (bySource.set(source.id, []), bySource.get(source.id)!);
    list.push(edge);
  }
  for (const list of bySource.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const rows: OutlineRow[] = [];
  // Guard the current ancestor path (not a global visited set): a Node may legitimately
  // appear under several parents (multi-predecessor), so only a back-edge into its own
  // ancestors is a cycle — skip that edge rather than recursing forever. Acyclicity is
  // enforced at write time (createEdge), but the render layer must not trust that invariant
  // for an edge set assembled some other way.
  const walk = (parentId: string, depth: number, ancestors: Set<string>) => {
    for (const edge of bySource.get(parentId) ?? []) {
      const node = tryGetTarget(edge);
      if (!node || ancestors.has(node.id)) {
        continue; // dangling target removed → skip; multi-parent back-edge → skip (ancestor guard)
      }
      const hasChildren = (bySource.get(node.id) ?? []).length > 0;
      const isCollapsed = collapsed.has(node.id);
      rows.push({ node, depth, edge, hasChildren, collapsed: isCollapsed });
      if (!isCollapsed) {
        walk(node.id, depth + 1, new Set(ancestors).add(node.id));
      }
    }
  };
  walk(root.id, 0, new Set([root.id]));
  return rows;
};
