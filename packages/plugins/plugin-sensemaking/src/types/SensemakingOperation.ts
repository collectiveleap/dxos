//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Operation } from '@dxos/compute';
import { DXN, Obj, Ref } from '@dxos/echo';

import { meta } from '#meta';

import * as Capture from './Capture';
import * as Result from './Result';

const makeKey = (name: string) => DXN.make(`${meta.profile.key}.operation.${name}`);

/**
 * Triage a {@link Capture.Capture} into a {@link Result.Result}: creates the Result and a
 * `DerivedFrom` traceability relation linking it back to the capture.
 */
export const CreateResult = Operation.make({
  meta: {
    key: makeKey('createResult'),
    name: 'Create Result',
    description: 'Create a triage result from a flagged capture and trace it back to the capture.',
    icon: 'ph--check-square--regular',
  },
  input: Schema.Struct({
    capture: Ref.Ref(Capture.Capture),
    kind: Result.Kind,
    body: Schema.String,
  }),
  output: Schema.Struct({
    result: Ref.Ref(Result.Result),
  }),
}).pipe(Operation.visible);

/**
 * Connect a {@link Capture.Capture} to an arbitrary target object via a `ConnectedTo` relation
 * (the thing the capture belongs with).
 */
export const Connect = Operation.make({
  meta: {
    key: makeKey('connect'),
    name: 'Connect',
    description: 'Connect a flagged capture to a target object.',
    icon: 'ph--link--regular',
  },
  input: Schema.Struct({
    capture: Ref.Ref(Capture.Capture),
    target: Ref.Ref(Obj.Unknown),
  }),
  output: Schema.Struct({}),
}).pipe(Operation.visible);
