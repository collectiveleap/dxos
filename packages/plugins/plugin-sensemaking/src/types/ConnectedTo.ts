//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { DXN, Obj, Relation, Type } from '@dxos/echo';

import * as Capture from './Capture';

/**
 * Connect relation (replaces "comment"). Source = the Capture; target = what it belongs with
 * (a Collection/project by default; any object in general).
 */
export class ConnectedTo extends Type.makeRelation<ConnectedTo>(DXN.make('org.dxos.relation.connectedTo', '0.1.0'))({
  source: Capture.Capture,
  target: Obj.Unknown,
})(Schema.Struct({})) {}

export const make = (props: Relation.MakeProps<typeof ConnectedTo>) => Relation.make(ConnectedTo, props);
