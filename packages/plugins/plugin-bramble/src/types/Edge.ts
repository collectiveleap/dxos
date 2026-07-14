//
// Copyright 2026 DXOS.org
//

import * as Schema from 'effect/Schema';

import { DXN, Relation, Type } from '@dxos/echo';

import { Node } from './Node';

/** The two current edge kinds of the open edge family (see design.md §1). */
export const EdgeKind = Schema.Literal('structural', 'linked');
export type EdgeKind = Schema.Schema.Type<typeof EdgeKind>;

export class Edge extends Type.makeRelation<Edge>(DXN.make('org.dxos.type.bramble.edge', '0.2.0'))({
  source: Node,
  target: Node,
})(
  Schema.Struct({
    kind: EdgeKind,
    // Structural-only: sibling order (fractional). Linked edges are unordered.
    order: Schema.optional(Schema.Number),
  }),
) {}

/** A structural edge (containment, ordered, acyclic — enforced by the model ops). */
export const makeEdge = ({ source, target, order }: { source: Node; target: Node; order: number }): Edge =>
  Relation.make(Edge, { [Relation.Source]: source, [Relation.Target]: target, kind: 'structural', order });

/** A linked edge (cross-reference / mention — may-cycle, unordered). */
export const makeLinkedEdge = ({ source, target }: { source: Node; target: Node }): Edge =>
  Relation.make(Edge, { [Relation.Source]: source, [Relation.Target]: target, kind: 'linked' });
