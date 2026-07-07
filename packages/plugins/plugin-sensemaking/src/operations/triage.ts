//
// Copyright 2026 DXOS.org
//

import { type Database, Obj, Relation } from '@dxos/echo';

import { Capture, ConnectedTo, DerivedFrom, Result } from '../types';

/**
 * Create a triage {@link Result.Result} from a {@link Capture.Capture} and a {@link DerivedFrom.DerivedFrom}
 * traceability relation linking the new Result back to the Capture it was derived from. Synchronous:
 * `db.add` persists eagerly and returns the live object.
 */
export const createResult = (
  db: Database.Database,
  capture: Capture.Capture,
  kind: Result.Kind,
  body: string,
): { result: Result.Result; relation: DerivedFrom.DerivedFrom } => {
  const result = db.add(Result.make({ kind, body }));
  const relation = db.add(DerivedFrom.make({ [Relation.Source]: result, [Relation.Target]: capture }));
  return { result, relation };
};

/**
 * Create a {@link ConnectedTo.ConnectedTo} relation from a {@link Capture.Capture} to an arbitrary target
 * object (the thing the capture belongs with). Synchronous.
 */
export const connect = (
  db: Database.Database,
  capture: Capture.Capture,
  target: Obj.Unknown,
): { relation: ConnectedTo.ConnectedTo } => {
  const relation = db.add(ConnectedTo.make({ [Relation.Source]: capture, [Relation.Target]: target }));
  return { relation };
};
