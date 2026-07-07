//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Type } from '@dxos/echo';
import { LabelAnnotation } from '@dxos/echo/Annotation';

/** A triage outcome. `to-do` and `question` are actions (they flow to the Pipeline in a later rung). */
export const Kind = Schema.Literal('todo', 'question');
export type Kind = Schema.Schema.Type<typeof Kind>;

export class Result extends Type.makeObject<Result>(DXN.make('org.dxos.type.result', '0.1.0'))(
  Schema.Struct({
    kind: Kind,
    body: Schema.String,
  }).pipe(
    LabelAnnotation.set(['body']),
    Annotation.IconAnnotation.set({ icon: 'ph--check-square--regular', hue: 'indigo' }),
  ),
) {}

export const make = (props: Obj.MakeProps<typeof Result>): Result => Obj.make(Result, props);
export const instanceOf = (value: unknown): value is Result => Obj.instanceOf(Result, value);
