//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { DXN, Relation, Type } from '@dxos/echo';

import * as Capture from './Capture';
import * as Result from './Result';

/** Traceability relation. Source = the triage Result; target = the Capture it was derived from. */
export class DerivedFrom extends Type.makeRelation<DerivedFrom>(DXN.make('org.dxos.relation.derivedFrom', '0.1.0'))({
  source: Result.Result,
  target: Capture.Capture,
})(Schema.Struct({})) {}

export const make = (props: Relation.MakeProps<typeof DerivedFrom>) => Relation.make(DerivedFrom, props);
