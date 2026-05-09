//
// Copyright 2025 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, Obj, Ref, Type } from '@dxos/echo';
import { LabelAnnotation } from '@dxos/echo/internal';

import * as Block from './Block';

// Navigator-openable container for a tree of Blocks. Holds a reference to
// the root Block; the tree is rendered in the BlockArticle surface.

export const BlockOutline = Schema.Struct({
  name: Schema.optional(Schema.String.annotations({ title: 'Name' })),
  root: Ref.Ref(Block.Block),
}).pipe(
  Type.object({
    typename: 'org.dxos.type.block-outline',
    version: '0.1.0',
  }),
  LabelAnnotation.set(['name']),
  Annotation.IconAnnotation.set({
    icon: 'ph--list-bullets--regular',
    hue: 'indigo',
  }),
);

export interface BlockOutline extends Schema.Schema.Type<typeof BlockOutline> {}

// Creates an empty root Block first, then a BlockOutline pointing at it.
export const make = ({ name }: { name?: string } = {}): BlockOutline =>
  Obj.make(BlockOutline, {
    name,
    root: Ref.make(Block.make()),
  });
