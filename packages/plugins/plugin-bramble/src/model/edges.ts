//
// Copyright 2026 DXOS.org
//

import { Filter, Query, Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';

import { Edge, type Node, makeEdge, makeLinkedEdge } from '../types';

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
  return [...edges].filter((e) => e.kind === 'structural').sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
};

/** Structural parent edges of a Node (targetOf) — its predecessors; multi-predecessor. */
export const parentEdges = async (db: EchoDatabase, node: Node): Promise<Edge[]> => {
  const edges = await db.query(Query.select(Filter.id(node.id)).targetOf(Edge)).run();
  return [...edges].filter((e) => e.kind === 'structural');
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
      const source = tryGetSource(e);
      if (source) {
        stack.push(source); // skip a dangling parent edge rather than throwing during the cycle walk
      }
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

/** Add a linked edge (mention / cross-reference) source→target. Unlike structural edges,
 *  linked edges may cycle (IP-3.may-cycle) and carry no order — so there is no cycle check. */
export const createLinkedEdge = (db: EchoDatabase, source: Node, target: Node): Edge => {
  const edge = makeLinkedEdge({ source, target });
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
  // Cycle-check BEFORE mutating, so a rejected reparent leaves the graph unchanged.
  // (The old edge is inbound to `child`, so its presence does not affect this check.)
  if (await wouldCreateCycle(db, newParent, child)) {
    throw new Error('Bramble: structural edge would create a cycle');
  }
  const finalOrder = order ?? (await nextOrder(db, newParent));
  // NOTE: this is a known source of a transient React duplicate-key warning. A relation's
  // endpoints (Relation.Source / Relation.Target) are read-only after creation — ECHO throws
  // an invariant violation if `Relation.update` tries to reassign them — so an in-place
  // reparent is not available; remove-then-add is the only option. Despite both calls
  // happening in the same synchronous tick, ECHO does NOT guarantee they land in a single
  // reactive update: `useQuery` can observe the new edge before the old edge's removal has
  // settled, giving `child` two structural parents for one render. `outlineRows` does not
  // de-dup a multi-predecessor node, so it briefly emits two rows sharing `node.id`, which
  // React reports as "Encountered two children with the same key". Fixing this properly
  // requires either a de-dup pass in `outlineRows` or a real batched-transaction primitive
  // in ECHO for relation reparenting — tracked as follow-up, not fixed by this function.
  removeEdge(db, edge);
  const newEdge = makeEdge({ source: newParent, target: child, order: finalOrder });
  db.add(newEdge);
  return newEdge;
};

/** A Node's backlinks: its incoming edges by reverse traversal, grouped by kind —
 *  structural predecessors ("appears under") and linked referrers ("mentioned in").
 *  Realizes UP-2.backlinks-view's grouped union over the one kind-typed Edge. */
export const backlinks = async (db: EchoDatabase, node: Node): Promise<{ structural: Node[]; linked: Node[] }> => {
  const inbound = await db.query(Query.select(Filter.id(node.id)).targetOf(Edge)).run();
  const structural: Node[] = [];
  const linked: Node[] = [];
  for (const e of inbound) {
    const source = tryGetSource(e);
    if (source) {
      (e.kind === 'linked' ? linked : structural).push(source);
    }
  }
  return { structural, linked };
};

// `Relation.getTarget`/`getSource` THROW (not return undefined) when an endpoint can't be resolved —
// e.g. a linked edge survives after its target/source Node was deleted. Render paths that must tolerate
// such a dangling edge use these to skip it instead of crashing.
export const tryGetTarget = (edge: Edge): Node | undefined => {
  try {
    return Relation.getTarget(edge) as Node;
  } catch {
    return undefined;
  }
};

export const tryGetSource = (edge: Edge): Node | undefined => {
  try {
    return Relation.getSource(edge) as Node;
  } catch {
    return undefined;
  }
};
