//
// Copyright 2025 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Type } from '@dxos/echo';

import * as Block from './Block';

// F-DAG: first-class edge entity for structural parent/child links
// between Blocks. Replaces the implicit `Block.children: Ref<Block>[]`
// model with explicit edge objects so a Block can have multiple
// parents and so each edge can carry its own per-occurrence data
// (`order`, `expanded`, …).
//
// Migration policy: writers convert call-sites incrementally
// (Library first; see PLUGIN.mdl `feat F-DAG`). During the
// transition `Block.children` remains a supported readable field —
// any consumer that wants the structural children of a Block must
// merge `Block.children` with the ChildEdges whose source is that
// Block (see `useStructuralChildren` in `child-edges.ts`).
//
// Uses ECHO's native `Relation` API directly — properties beyond
// source/target/order live on the relation as plain schema fields.
// Wrapping with a plugin-internal Object type isn't necessary unless
// we eventually need behaviour ECHO Relations don't expose.
export const ChildEdge = Schema.Struct({
  // Position among this parent's children. Sortable; lower = earlier.
  // Newly-added edges get a value greater than any existing edge
  // under the same parent (see `nextOrderFor` in child-edges.ts).
  order: Schema.Number,

  // Reserved for the per-occurrence collapse state once we move
  // `Block.state.expanded` off the Block. Not consumed yet.
  expanded: Schema.optional(Schema.Boolean),

  // Edge kind. Default is 'structural' (the parent/child relationship
  // an outline reader walks). Reserved for future kinds like
  // 'embed' / 'linked' / 'mirror'.
  kind: Schema.optional(Schema.String),
}).pipe(
  Type.relation({
    typename: 'org.dxos.plugin.blocks.type.child-edge',
    version: '0.1.0',
    source: Block.Block,
    target: Block.Block,
  }),
);

export interface ChildEdge extends Schema.Schema.Type<typeof ChildEdge> {}
