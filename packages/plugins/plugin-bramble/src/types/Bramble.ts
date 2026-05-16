//
// Copyright 2025 DXOS.org
//

// @import-as-namespace
//
// Bramble's three data primitives live in this one file so callers
// see them via a single `Bramble` namespace: `Bramble.Node`,
// `Bramble.Edge`, `Bramble.Graph`. This is a deliberate deviation
// from the one-file-per-type-per-namespace convention used by other
// DXOS plugins — the convention deviation encodes product identity
// in the type access surface. See CONCEPTS.md §6 for the data model
// rationale.

import * as Schema from 'effect/Schema';

import { Annotation, Obj, Ref, Type } from '@dxos/echo';
import { LabelAnnotation } from '@dxos/echo/internal';

// ─── Inline content segments ────────────────────────────────────────
// Used by Node.content. An ordered sequence of text spans (with
// optional marks) and ref segments. Ref segments render the target
// object's current label live (Tana-style); rename propagates.

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

// ─── Node ───────────────────────────────────────────────────────────
// The Distinction primitive (Cabrera DSRP-D). Substrate of the
// outliner: every visible bullet, every page, every tag node is a
// Node. Most fields are optional and reserved for later increments;
// defined now so Tana Paste imports preserve every shape without a
// schema migration.

export const Node = Schema.Struct({
  // Inline content for this node (text + refs + marks).
  content: Schema.optional(StructuredContent),

  // Ordered children. Legacy tree-shaped containment; superseded by
  // first-class Edge entities (F-DAG). Still supported as a readable
  // field during the migration window — readers must merge
  // `node.children` with Edges whose source is this Node
  // (see `useStructuralChildren` in `components/Node/edges.ts`).
  // TODO(bramble): tighten to Ref.Ref(Node) now that types are
  // colocated and the recursive-schema concern may have eased.
  children: Schema.optional(Schema.Array(Ref.Ref(Obj.Unknown))),

  // Syntactic node kind from Tana Paste; bullet is the default.
  // NOTE: distinct from `Edge.kind` (the agreed-upon relationship
  // semantics). This `Node.kind` is a visual/syntactic flavour of
  // the node itself; `Edge.kind` describes a relation between two.
  kind: Schema.optional(
    Schema.Literal('bullet', 'heading', 'todo', 'image', 'url', 'search', 'view', 'code'),
  ),

  // F-Supertag: typed-instance supertags. Each entry is a Ref to a
  // newly-created instance of an ECHO type from the `tag-types`
  // allowlist (e.g., `org.dxos.type.task`). Field values for the
  // applied tag live ON the linked instance (not in `Node.fields`).
  // Named `supertags` (not `tags`) to avoid colliding with
  // composer's shared `BaseSchema.tags: Array<Ref<Tag>>` in
  // `react-ui-form`'s ObjectProperties — Effect-Schema cannot merge
  // two `Array<Ref>` fields of different element types when an
  // object is opened in the article surface (F-Open-Pane).
  supertags: Schema.optional(Schema.Array(Ref.Ref(Obj.Unknown))),

  // Field map: name -> sub-nodes (multi-value friendly).
  fields: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Array(Ref.Ref(Obj.Unknown)) }),
  ),

  // Per-node transient state. `checked` is for todo kinds;
  // `expanded` is the user's collapse/expand state on this node's
  // children. Default (undefined) means expanded.
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
  //
  // F-PDF-Upload: extended with optional `name`, `mimeType`, and
  // `sha256` fields. `sha256` (hex digest of the file bytes) keys
  // the dedup index — uploading the same file twice reuses the
  // existing Node carrying that hash rather than creating a
  // duplicate. `name` is the user-visible filename rendered
  // alongside the PDF chip; `mimeType` is the browser-reported
  // content type at upload time. All three are optional so
  // pre-PDF-Upload `image` attachments remain valid.
  attachment: Schema.optional(
    Schema.Struct({
      kind: Schema.Literal('image', 'file'),
      url: Schema.String,
      name: Schema.optional(Schema.String),
      mimeType: Schema.optional(Schema.String),
      sha256: Schema.optional(Schema.String),
    }),
  ),

  // F-Supertag (option-node): per-space wrapper for one literal
  // choice of a tagged-typename's enum-style field (e.g. the "high"
  // option for `Task.priority`). `literal` is the schema-declared
  // identity that stays stable across renames; the Node's `content`
  // is the user-visible (renameable) label. Lookups go by
  // (typename, fieldName, literal); see `tag-options.ts`.
  tagOption: Schema.optional(
    Schema.Struct({
      typename: Schema.String,
      fieldName: Schema.String,
      literal: Schema.String,
    }),
  ),

  // F-Supertag (tag-node): per-space wrapper for a tag-ready
  // typename (e.g. `org.dxos.type.task`). When a Node carries this
  // marker, clicking any `#Task` chip elsewhere in the space zooms
  // into this Node. The Node's `content` is the renameable label
  // shown on every chip for that typename (so renaming "Task" →
  // "Job" updates every chip live). Lookups go by `tagTypename`;
  // see `tag-supertags.ts`.
  tagTypename: Schema.optional(Schema.String),

  // F-Supertag (system-node): per-space permanent placeholder Node
  // created by Bramble itself. The marker value names the role:
  // 'schema' (parent of tag-typename Nodes), 'library' (parent of
  // orphan instance wrappers). System nodes have a read-only page
  // header and cannot be deleted by the user.
  systemNode: Schema.optional(Schema.String),

  // F-Supertag (query-node): when set, this Node is a live query
  // result list — its outline rendering is REPLACED by a list of
  // every ECHO instance whose typename matches `queryRef.typename`,
  // including instances that don't have a wrapping Node yet.
  // Materialized automatically as the sole child of a tag node at
  // tag-Node creation time. Clicking a wrapper-less row promotes
  // it into a wrapper Node under the per-space Library.
  queryRef: Schema.optional(
    Schema.Struct({
      typename: Schema.String,
    }),
  ),
}).pipe(
  Type.object({
    typename: 'org.dxos.type.bramble.node',
    version: '0.1.0',
  }),
  Annotation.IconAnnotation.set({
    icon: 'ph--circle--regular',
    hue: 'indigo',
  }),
);

export interface Node extends Schema.Schema.Type<typeof Node> {}

export const makeNode = (props: Partial<Obj.MakeProps<typeof Node>> = {}): Node =>
  Obj.make(Node, props);

// ─── Edge ───────────────────────────────────────────────────────────
// The relation primitive. An Edge connects a source Node to a target
// Node and carries a `kind` field naming the agreed-upon
// Relationship semantics (DSRP-R; see CONCEPTS.md §5).
//
// Today all edges are structural part-whole links (`kind: 'child'`).
// The closed kind taxonomy grows by deliberate addition — each kind
// declares its source/target role semantics. See CONCEPTS.md §8.1
// for the planned expansion (`'reference'`, `'tag-applies'`,
// `'cause'`, `'co-occurs-with'`).
//
// Migration policy (during F-DAG completion): writers convert call-
// sites incrementally; legacy `Node.children` remains readable;
// readers merge `Node.children` with Edges whose source is the Node
// (see `useStructuralChildren` in `components/Node/edges.ts`).
//
// Uses ECHO's native `Relation` API — properties beyond
// source/target/order live on the relation as plain schema fields.
export const Edge = Schema.Struct({
  // Position among this source's outgoing edges. Sortable; lower =
  // earlier. Newly-added edges get a value greater than any existing
  // edge under the same source.
  order: Schema.Number,

  // Reserved for the per-occurrence collapse state once we move
  // `Node.state.expanded` off the Node. Not consumed yet.
  expanded: Schema.optional(Schema.Boolean),

  // Edge kind — the agreed-upon Relationship semantics. The closed
  // taxonomy grows by deliberate addition; each kind declares its
  // source/target role semantics (see CONCEPTS.md §8.1 for planned
  // expansions, §12.4 / §12.6 for the substrate-vocabulary set).
  //
  // - `'child'`: structural part-whole; source = whole, target = part.
  //   Outline-rendered; cycle-checked at create time. The original
  //   and only user-visible edge kind today.
  // - `'is-run-of'`: source = Run-Node (`#Run`), target = Step-Node
  //   (`#Step`). Cardinality: one Step has many Runs. Not outline-
  //   rendered; appears in journal/run-list UX (F-Run, 2b).
  // - `'parent-run'`: source = child Run-Node, target = parent
  //   Run-Node. Mirrors `'child'` semantics but for run hierarchy.
  //   Not outline-rendered.
  kind: Schema.Literal('child', 'is-run-of', 'parent-run'),
}).pipe(
  Type.relation({
    typename: 'org.dxos.type.bramble.edge',
    version: '0.1.0',
    source: Node,
    target: Node,
  }),
);

export interface Edge extends Schema.Schema.Type<typeof Edge> {}

// ─── Step ───────────────────────────────────────────────────────────
// F-Step (Iteration 2a; substrate-principles vocabulary, see
// CONCEPTS.md §12.3): a Bramble.Node tagged with this supertag is a
// Step — "a named piece of work, recursively composed." The Schema
// starts empty: the marker alone is enough to mark a Node as a
// substrate work-unit. Future fields (formalization,
// description-conventions, etc.) are added as demand surfaces
// (Principle #1).
//
// Registration alone is sufficient to make `#Step` appear in the
// F-Supertag picker (per `collectTagTypes` in
// `components/Editor/tag-types.ts`).
export const Step = Schema.Struct({}).pipe(
  Type.object({
    typename: 'org.dxos.type.bramble.step',
    version: '0.1.0',
  }),
  Annotation.IconAnnotation.set({
    icon: 'ph--list-checks--regular',
    hue: 'emerald',
  }),
);

export interface Step extends Schema.Schema.Type<typeof Step> {}

// ─── Run ────────────────────────────────────────────────────────────
// F-Run (Iteration 2b; substrate-principles vocabulary, see
// CONCEPTS.md §12.4): a Bramble.Node tagged with this supertag is a
// Run — "an instance of a step being executed." Relations to the
// Step the Run is of, and to a parent Run, are modelled as Edges of
// kind 'is-run-of' / 'parent-run' respectively (see Edge below).
//
// The `completed` field (added 2c.5) is set when the user clicks
// "Done" in the Run Lens — i.e. the journal-completion claim. Its
// value is an ISO-8601 timestamp; absence means the Run is still
// in progress or was Stopped without completing.
export const Run = Schema.Struct({
  completed: Schema.optional(Schema.String),
}).pipe(
  Type.object({
    typename: 'org.dxos.type.bramble.run',
    version: '0.1.0',
  }),
  Annotation.IconAnnotation.set({
    icon: 'ph--play-circle--regular',
    hue: 'sky',
  }),
);

export interface Run extends Schema.Schema.Type<typeof Run> {}

// ─── Graph ──────────────────────────────────────────────────────────
// Navigator-openable container. Holds a reference to the root Node;
// the rest of the structure unfolds via `Edge`s (and legacy
// `Node.children`).

export const Graph = Schema.Struct({
  name: Schema.optional(Schema.String.annotations({ title: 'Name' })),
  root: Ref.Ref(Node),
}).pipe(
  Type.object({
    typename: 'org.dxos.type.bramble.graph',
    version: '0.1.0',
  }),
  LabelAnnotation.set(['name']),
  Annotation.IconAnnotation.set({
    icon: 'ph--list-bullets--regular',
    hue: 'indigo',
  }),
);

export interface Graph extends Schema.Schema.Type<typeof Graph> {}

// Creates a Graph with an invisible root Node. The root starts
// CHILDLESS — the first visible bullet is seeded on mount by the
// Graph view's auto-seed effect, which creates the seed Node and
// attaches it via an Edge rather than by pushing onto `root.children`.
// Keeps Graph creation aligned with R-Edges-First-Class.
export const makeGraph = ({ name }: { name?: string } = {}): Graph => {
  const root = makeNode();
  return Obj.make(Graph, {
    name,
    root: Ref.make(root),
  });
};
