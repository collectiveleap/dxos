//
// Copyright 2026 DXOS.org
//

import * as Schema from 'effect/Schema';

import { DXN, Relation, Type } from '@dxos/echo';

import { Node } from './Node';

export class Edge extends Type.makeRelation<Edge>(DXN.make('org.dxos.type.bramble.edge', '0.1.0'))({
  source: Node,
  target: Node,
})(
  Schema.Struct({
    order: Schema.Number,
  }),
) {}

export const makeEdge = ({ source, target, order }: { source: Node; target: Node; order: number }): Edge =>
  Relation.make(Edge, { [Relation.Source]: source, [Relation.Target]: target, order });
