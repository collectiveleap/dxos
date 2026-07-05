//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Ref, Type } from '@dxos/echo';
import { FormInputAnnotation, LabelAnnotation } from '@dxos/echo/Annotation';
import { Bookmark } from '@dxos/plugin-bookmarks';

import * as Readwise from './Readwise';

/**
 * One highlighted passage synced from Readwise. `source` is the document it was highlighted in (a
 * reused `Bookmark`); `container` is the `Readwise` account it belongs to (so browse is per-account).
 * `processingState` is RESERVED (Inc 2 drives the card's left-rail dot from it) and inert in Inc 1.
 * There is no forward-ref field: the Inc-2 `result -> highlight` relation is reverse-queried from the
 * highlight, so the card's "-> where it's processed" affordance needs no field here.
 */
export class Highlight extends Type.makeObject<Highlight>(DXN.make('org.dxos.type.highlight', '0.1.0'))(
  Schema.Struct({
    text: Schema.String.pipe(Schema.annotations({ title: 'Passage' })),
    note: Schema.optional(Schema.String.pipe(Schema.annotations({ title: 'Note' }))),
    tags: Schema.Array(Schema.String),
    readwiseId: Schema.String.pipe(FormInputAnnotation.set(false)),
    // ISO 8601 timestamp of the highlight's last update in Readwise (dates are stored as ISO strings).
    updated: Schema.String.pipe(FormInputAnnotation.set(false)),
    source: Ref.Ref(Bookmark.Bookmark).pipe(FormInputAnnotation.set(false)),
    container: Ref.Ref(Readwise.Readwise).pipe(FormInputAnnotation.set(false)),
    processingState: Schema.Literal('none', 'partial', 'complete').pipe(FormInputAnnotation.set(false), Schema.optional),
  }).pipe(
    LabelAnnotation.set(['text']),
    Annotation.IconAnnotation.set({ icon: 'ph--quotes--regular', hue: 'amber' }),
  ),
) {}

/** Creates a Highlight object. */
export const make = (props: Obj.MakeProps<typeof Highlight>): Highlight => Obj.make(Highlight, props);

/** Checks if a value is a Highlight object. */
export const instanceOf = (value: unknown): value is Highlight => Obj.instanceOf(Highlight, value);
