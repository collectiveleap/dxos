//
// Copyright 2025 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, Obj, Ref, Type } from '@dxos/echo';

// Inline content segments. The structured content of a Block is an ordered
// sequence of text spans (with optional marks) and ref segments. Ref segments
// render the target object's current label live (Tana-style); rename propagates.

export const TextSpan = Schema.Struct({
  kind: Schema.Literal('text'),
  text: Schema.String,
  marks: Schema.optional(Schema.Array(Schema.Literal('bold', 'italic', 'highlight', 'code'))),
});

export const RefSpan = Schema.Struct({
  kind: Schema.Literal('ref'),
  // Target is any ECHO object; the renderer resolves the label at render time.
  target: Ref.Ref(Obj.Unknown),
});

export const InlineSegment = Schema.Union(TextSpan, RefSpan);

export const StructuredContent = Schema.Array(InlineSegment);

// The Block is the substrate of the outliner. Most fields are optional and
// reserved for later increments; defined now so Tana Paste imports preserve
// every shape without a schema migration.

export const Block = Schema.Struct({
  // Inline content for this block (text + refs + marks).
  content: Schema.optional(StructuredContent),

  // Ordered children.
  // TODO(plugin-blocks): tighten to Ref.Ref(Block) once the recursive-schema pattern is settled.
  children: Schema.optional(Schema.Array(Ref.Ref(Obj.Unknown))),

  // Syntactic node kind from Tana Paste; bullet is the default.
  kind: Schema.optional(
    Schema.Literal('bullet', 'heading', 'todo', 'image', 'url', 'search', 'view', 'code'),
  ),

  // Supertags applied to this block. Refs target TagDef instances.
  // Named `supertags` (not `tags`) to avoid colliding with composer's
  // shared `BaseSchema.tags: Array<Ref<Tag>>` in `react-ui-form`'s
  // ObjectProperties — Effect-Schema cannot merge two `Array<Ref>`
  // fields of different element types when an object is opened in the
  // article surface (F-Open-Pane).
  // TODO(plugin-blocks): tighten to Ref.Ref(TagDef.TagDef).
  supertags: Schema.optional(Schema.Array(Ref.Ref(Obj.Unknown))),

  // Field map: name -> sub-blocks (multi-value friendly).
  fields: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Array(Ref.Ref(Obj.Unknown)) }),
  ),

  // Per-block transient state. `checked` is for todo kinds; `expanded` is
  // the user's collapse/expand state on this block's children. Default
  // (undefined) means expanded.
  state: Schema.optional(
    Schema.Struct({
      checked: Schema.optional(Schema.Boolean),
      expanded: Schema.optional(Schema.Boolean),
    }),
  ),

  // View descriptor (Tana Paste %%view:...%%).
  view: Schema.optional(
    Schema.Struct({ kind: Schema.Literal('table', 'cards', 'tabs', 'calendar') }),
  ),

  // Attachment for image/url kinds.
  attachment: Schema.optional(
    Schema.Struct({ kind: Schema.Literal('image', 'file'), url: Schema.String }),
  ),
}).pipe(
  Type.object({
    typename: 'org.dxos.type.block',
    version: '0.1.0',
  }),
  Annotation.IconAnnotation.set({
    icon: 'ph--circle--regular',
    hue: 'indigo',
  }),
);

export interface Block extends Schema.Schema.Type<typeof Block> {}

export const make = (props: Partial<Obj.MakeProps<typeof Block>> = {}): Block =>
  Obj.make(Block, props);
