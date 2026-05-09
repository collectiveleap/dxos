//
// Copyright 2025 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, Obj, Type } from '@dxos/echo';
import { LabelAnnotation } from '@dxos/echo/internal';

// Stub supertag definition. Expanded in a later increment to include extends,
// field templates, and view defaults.

export const TagDef = Schema.Struct({
  name: Schema.optional(Schema.String.annotations({ title: 'Name' })),
}).pipe(
  Type.object({
    typename: 'org.dxos.type.tag-def',
    version: '0.1.0',
  }),
  LabelAnnotation.set(['name']),
  Annotation.IconAnnotation.set({
    icon: 'ph--tag--regular',
    hue: 'pink',
  }),
);

export interface TagDef extends Schema.Schema.Type<typeof TagDef> {}

export const make = (props: Partial<Obj.MakeProps<typeof TagDef>> = {}): TagDef =>
  Obj.make(TagDef, props);
