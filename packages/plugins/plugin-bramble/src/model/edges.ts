//
// Copyright 2026 DXOS.org
//

import { Filter, Query, Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';

import { Edge, type Node, makeEdge } from '../types';

/** Numeric midpoint order between two sibling edges. NOTE: repeated inserts at the
 *  same slot can exhaust float precision; a string-rank scheme is a later refinement. */
export const orderBetween = (before?: Edge, after?: Edge): number => {
  const b = before?.order;
  const a = after?.order;
  if (b === undefined && a === undefined) {
    return 0;
  }
  if (b === undefined) {
    return (a as number) - 1;
  }
  if (a === undefined) {
    return b + 1;
  }
  return (b + a) / 2;
};

/** Structural child edges of a Node (sourceOf), ordered by `order`. */
export const childEdges = async (db: EchoDatabase, node: Node): Promise<Edge[]> => {
  const edges = await db.query(Query.select(Filter.id(node.id)).sourceOf(Edge)).run();
  return [...edges].sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
};

/** Structural parent edges of a Node (targetOf) — its predecessors; multi-predecessor. */
export const parentEdges = async (db: EchoDatabase, node: Node): Promise<Edge[]> => {
  const edges = await db.query(Query.select(Filter.id(node.id)).targetOf(Edge)).run();
  return [...edges];
};

/** Order for appending a new child after all existing siblings. */
export const nextOrder = async (db: EchoDatabase, parent: Node): Promise<number> => {
  const edges = await childEdges(db, parent);
  return edges.length ? (edges[edges.length - 1].order ?? 0) + 1 : 0;
};

export { makeEdge };

/** True if adding a structural edge parent→child would create a cycle
 *  (child is parent, or child is already an ancestor of parent). */
export const wouldCreateCycle = async (db: EchoDatabase, parent: Node, child: Node): Promise<boolean> => {
  if (parent.id === child.id) {
    return true;
  }
  const seen = new Set<string>();
  const stack: Node[] = [parent];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n.id === child.id) {
      return true;
    }
    if (seen.has(n.id)) {
      continue;
    }
    seen.add(n.id);
    for (const e of await parentEdges(db, n)) {
      stack.push(Relation.getSource(e));
    }
  }
  return false;
};

/** Add a structural edge parent→child (appended by default), rejecting cycles. */
export const createEdge = async (
  db: EchoDatabase,
  parent: Node,
  child: Node,
  order?: number,
): Promise<Edge> => {
  if (await wouldCreateCycle(db, parent, child)) {
    throw new Error('Bramble: structural edge would create a cycle');
  }
  const edge = makeEdge({ source: parent, target: child, order: order ?? (await nextOrder(db, parent)) });
  db.add(edge);
  return edge;
};

export const removeEdge = (db: EchoDatabase, edge: Edge): void => {
  db.remove(edge);
};

/** Move one occurrence (edge) to a new parent: remove the old edge, create a new one (cycle-checked). */
export const reparentEdge = async (
  db: EchoDatabase,
  edge: Edge,
  newParent: Node,
  order?: number,
): Promise<Edge> => {
  const child = Relation.getTarget(edge);
  // Cycle-check BEFORE removing, so a rejected reparent leaves the graph unchanged.
  // (The old edge is inbound to `child`, so its presence does not affect this check.)
  if (await wouldCreateCycle(db, newParent, child)) {
    throw new Error('Bramble: structural edge would create a cycle');
  }
  removeEdge(db, edge);
  return createEdge(db, newParent, child, order);
};
