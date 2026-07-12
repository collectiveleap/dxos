//
// Copyright 2026 DXOS.org
//

import { Relation } from '@dxos/echo';

import { type Edge, type Node } from '../types';

export type OutlineRow = { node: Node; depth: number; edge: Edge; hasChildren: boolean };

/**
 * Pure view-model: given all Bramble structural edges and a view root, produce the
 * ordered, depth-annotated row list for the root's structural-successor subtree.
 * The root itself is excluded (it renders as the outline header).
 */
export const outlineRows = (edges: Edge[], root: Node): OutlineRow[] => {
  const bySource = new Map<string, Edge[]>();
  for (const edge of edges) {
    const sourceId = Relation.getSource(edge).id;
    const list = bySource.get(sourceId) ?? (bySource.set(sourceId, []), bySource.get(sourceId)!);
    list.push(edge);
  }
  for (const list of bySource.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  const rows: OutlineRow[] = [];
  const walk = (parentId: string, depth: number) => {
    for (const edge of bySource.get(parentId) ?? []) {
      const node = Relation.getTarget(edge) as Node;
      rows.push({ node, depth, edge, hasChildren: (bySource.get(node.id) ?? []).length > 0 });
      walk(node.id, depth + 1);
    }
  };
  walk(root.id, 0);
  return rows;
};
