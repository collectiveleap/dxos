//
// Copyright 2026 DXOS.org
//

import * as Schema from 'effect/Schema';

import { DXN, Obj, Relation, Type } from '@dxos/echo';

/** The two current edge kinds of the open edge family (see design.md §1). */
export const EdgeKind = Schema.Literal('structural', 'linked');
export type EdgeKind = Schema.Schema.Type<typeof EdgeKind>;

export class Edge extends Type.makeRelation<Edge>(DXN.make('org.dxos.type.bramble.edge', '0.2.0'))({
  source: Obj.Unknown,
  target: Obj.Unknown,
})(
  Schema.Struct({
    kind: EdgeKind,
    // Structural-only: sibling order (fractional). Linked edges are unordered.
    order: Schema.optional(Schema.Number),
  }),
) {}

/** A structural edge (containment, ordered, acyclic — enforced by the model ops). */
export const makeEdge = ({ source, target, order }: { source: Obj.Any; target: Obj.Any; order: number }): Edge =>
  Relation.make(Edge, { [Relation.Source]: source, [Relation.Target]: target, kind: 'structural', order });

/** A linked edge (cross-reference / mention — may-cycle, unordered). */
export const makeLinkedEdge = ({ source, target }: { source: Obj.Any; target: Obj.Any }): Edge =>
  Relation.make(Edge, { [Relation.Source]: source, [Relation.Target]: target, kind: 'linked' });
