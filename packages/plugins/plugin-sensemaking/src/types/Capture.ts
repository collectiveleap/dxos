//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Ref, Type } from '@dxos/echo';

/**
 * A flagged unit of sensemaking — a copy-on-write envelope over a source object. Its existence is
 * the flag. `source` is the wrapped object; `referent` is the deduped thing the capture is about
 * (denormalized by the feeder so the Inbox clusters without knowing the source type).
 */
export class Capture extends Type.makeObject<Capture>(DXN.make('org.dxos.type.capture', '0.1.0'))(
  Schema.Struct({
    source: Ref.Ref(Obj.Unknown),
    referent: Schema.optional(Ref.Ref(Obj.Unknown)),
    flaggedAt: Schema.String,
    note: Schema.optional(Schema.String),
    tags: Schema.optional(Schema.Array(Schema.String)),
  }).pipe(Annotation.IconAnnotation.set({ icon: 'ph--flag--regular', hue: 'amber' })),
) {}

export const make = (props: Obj.MakeProps<typeof Capture>): Capture => Obj.make(Capture, props);
export const instanceOf = (value: unknown): value is Capture => Obj.instanceOf(Capture, value);
