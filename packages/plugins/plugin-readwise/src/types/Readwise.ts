//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Type } from '@dxos/echo';
import { LabelAnnotation } from '@dxos/echo/Annotation';

/**
 * A connected Readwise account: what a user creates from "+ Add", connects, syncs into, and opens to
 * browse. Per-account (a second instance connects a second account). Minimal — it anchors the
 * connection and holds highlights via `Highlight.container`.
 */
export class Readwise extends Type.makeObject<Readwise>(DXN.make('org.dxos.type.readwise', '0.1.0'))(
  Schema.Struct({
    name: Schema.optional(Schema.String.pipe(Schema.annotations({ title: 'Name' }))),
  }).pipe(
    LabelAnnotation.set(['name']),
    Annotation.IconAnnotation.set({ icon: 'ph--book-open--regular', hue: 'indigo' }),
  ),
) {}

/** Creates a Readwise container object. */
export const make = (props: Obj.MakeProps<typeof Readwise> = {}): Readwise => Obj.make(Readwise, props);

/** Checks if a value is a Readwise container object. */
export const instanceOf = (value: unknown): value is Readwise => Obj.instanceOf(Readwise, value);
