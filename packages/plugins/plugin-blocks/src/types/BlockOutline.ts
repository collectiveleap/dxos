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

// Creates an outline with an invisible root Block. The root starts
// CHILDLESS — the first visible bullet is seeded on mount by
// `BlockTree`'s auto-seed effect, which (per F-DAG Phase 3a) creates
// the seed Block and attaches it via a `ChildEdge` rather than by
// pushing onto `root.children`. Keeps outline creation aligned with
// the rule R-Edges-First-Class: all new structural parent/child
// links go through edges.
export const make = ({ name }: { name?: string } = {}): BlockOutline => {
  const root = Block.make();
  return Obj.make(BlockOutline, {
    name,
    root: Ref.make(root),
  });
};
