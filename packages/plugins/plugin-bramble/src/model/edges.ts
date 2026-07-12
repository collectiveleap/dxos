//
// Copyright 2026 DXOS.org
//

import { Filter, Query } from '@dxos/echo';
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

/** Order for appending a new child after all existing siblings. */
export const nextOrder = async (db: EchoDatabase, parent: Node): Promise<number> => {
  const edges = await childEdges(db, parent);
  return edges.length ? (edges[edges.length - 1].order ?? 0) + 1 : 0;
};

export { makeEdge };
