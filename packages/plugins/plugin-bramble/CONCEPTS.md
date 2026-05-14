# Bramble — Conceptual Scaffolding

> Bramble honours the mess. We don't tidy your knowledge — we provide
> Lenses so you can dance with it.

This document is the *generative* sibling to `PLUGIN.mdl`. The spec is
operational: positive language, refer-don't-restate, abstract `#T`
form. This file is none of those things. It captures the reasoning
under the product — Ackoff's mess, Snowden's anthro-complexity,
Cabrera's DSRP, the triple-store refinement we landed on, and why the
product is named Bramble — so future spec entries can cite a stable
source rather than re-deriving from scratch.

It is also a working document. Pull from it into `PLUGIN.mdl` when a
passage becomes load-bearing; add to it when new conceptual ground is
covered. Drift between this and the spec is acceptable for prose
passages but not for primitive vocabulary — when the data model gets
new primitives, this doc updates first and the spec follows.

---

## 1. Stance

Three positions are coherent for a knowledge-graph tool:

| Stance | What the tool asserts | Picks |
|---|---|---|
| **Honour the mess** | "Your knowledge is non-decomposable. We don't pretend to tidy it." | Bramble, Tangle, Thicket, Rhizome |
| **Tend the mess** | "Cultivated wildness — we don't impose order, we support your acts of distinction." | Coppice, Hedgerow, Trellis, Cairn |
| **Be the lens** | "The data IS mess. Our value is the perspective-machinery." | Lens, Optic, Facet, Aspect, Prism |

Bramble takes **stance 1** as its product identity. Stance 3 is
reserved as a *feature* surface — eventually unifying F-Zoom,
F-Open-Pane, F-Page-Header, and F-DAG.Phase3e predecessor-nav into a
coherent "Lenses" abstraction. The two stances braid: the substrate
is mess (Bramble); the moat is the user's ability to carve coherent
perspectives from that mess (Lenses).

This separation matters. Most knowledge tools collapse the two by
oversellling tidiness — Notion / Tana / Roam all imply "we will help
you organise". Bramble doesn't. The product positioning is: *the
mess is real; the value is in dancing with it, not in eliminating
it.* When future increments add features, they should be evaluated
against whether they help the user dance — not whether they reduce
the apparent mess.

### 1.1 Anti-Tana / anti-saved-view positioning

Bramble's product positioning is explicitly **anti-Tana,
anti-saved-view, anti-database-view**. Not "Tana but local-first."
Not "Notion's database views with property-graph semantics
underneath." A different category of tool — *perspective-aware*
rather than view-of-a-table.

The gravitational pull during design conversations is toward
"saved query + rendering pipeline" — what Tana / Notion / Roam
already ship. *Lens-as-saved-view* is the canonical drift to watch
for; whenever a Lens proposal collapses to "filter rows + pick
renderer," that's a regression to abandon, not a feature to refine.
See §9.1 (The Tana trap) for the diagnosis and §9.2–9.5 for what
generative-P does that saved-view categorically cannot.

This is positioning, not just design. The product narrative,
documentation tone, demo flows, and feature prioritisation should
all run *away* from "Tana but…" framings. Bramble does what
Tana cannot, not what Tana already does plus a twist.

---

## 2. Substrate: it is actually a mess

### Ackoff's mess (1979)

Russell Ackoff coined the technical use of "mess" to mean *a system
of interrelated problems* — not a complicated problem, not a list of
problems, but a *non-decomposable* whole.

> *"Managers are not confronted with problems that are independent
> of each other, but with dynamic situations that consist of complex
> systems of changing problems that interact with each other. I call
> such situations messes."*
>
> — Ackoff, *Redesigning the Future*, 1974

The critical property is non-decomposability:

> *"When a mess, which is a system of problems, is taken apart, it
> loses its essential properties, and so does each of its parts."*
>
> — Ackoff, *The Art and Science of Mess Management*, 1981

The corollary is that messes don't have *solutions* in the classical
sense — you don't solve a mess, you *cope* with it, *dissolve* it,
or *manage* it. Coping strategies are the work, not problem-solving.

### The Buddhist parallel

Ackoff's non-decomposability has an older sibling in Buddhist
philosophy: *pratītyasamutpāda* — dependent co-arising, or dependent
origination. The doctrine asserts that phenomena have no inherent
essence (*svabhāva*); they exist only through their relations to
other phenomena. To pluck a thing from its web of relations is to
destroy what the thing actually was — the same move Ackoff calls a
category error in systems thinking.

The connection isn't decorative. Both frameworks are saying: *the
substrate is relational; "things" are conceptual carvings.* This is
the bedrock on which the rest of Bramble's data model sits.

Practically: a Block (Node) in Bramble has no intrinsic
content-meaning. Its meaning emerges from what it's connected to,
which supertags it carries, where it sits in the predecessor/
successor topology. The Node itself is a fold in the mess, not a
thing-in-itself. This is why F-DAG was the right move (Blocks have
multiple predecessors; they're not "owned" by one parent); it's why
F-Supertag is right (typing is per-relation, not per-essence); it's
why future first-class Perspectives are right (the same fold looks
different from different vantages, and no vantage is privileged).

### Wicked problems (Rittel & Webber, 1973)

The mid-twentieth-century cousin of Ackoff's mess is Rittel &
Webber's *wicked problem*: a problem with no clear formulation, no
stopping rule, no definitive solutions, and where the problem
*depends on* the proposed solution. Wicked problems are messes with
political consequences — what Snowden later folded into the
*complex* domain of his Cynefin framework.

The Wicked Messes chapter (Springer, 2021) ties the threads
together: "social messes" are interconnected wicked problems at
multiple levels of governance and society. The vocabulary varies
(mess, wicked problem, complex domain); the underlying observation
is one — *the substrate doesn't yield to decomposition*.

### Snowden's anthro-complexity

Dave Snowden's Cynefin framework distinguishes the *complex* domain
(many cause-effect relationships interacting unpredictably) from the
*complicated* (knowable cause-effect requiring expertise). His
*anthro-complexity* refinement narrows to the human/social case,
where actors carry intent and history, and so the system isn't just
unpredictable — it's *entangled*.

Three Snowden concepts are load-bearing for Bramble:

- **Coherence, not correctness.** In a complex domain, you can't
  ask "is this idea correct?" because correctness implies a
  thing-in-itself view the substrate doesn't grant. You can only
  ask "is this idea *coherent* with what else is there?" Coherence
  is relational; it lives in fit, not truth.

- **Entanglement.** Actors aren't separable from contexts. A move
  in one part of the system reverberates through others in ways
  you can't fully predict. The "actor + context" are one thing.

- **Wayshaping.** You don't *find* a path through complex
  territory; you *shape* one as you walk. The path is what your
  walking did to the territory, not a pre-existing feature of it.

Bramble's product proposition is wayshaping-flavoured. We don't
offer a path through your knowledge; we offer the tools (typed
edges, supertags, multi-pane, predecessor-nav, future Lenses) for
*you* to shape one — and we accept that the shape will be yours,
not ours.

---

## 3. Perspectival construction (POV-2)

Ackoff's second observation, sometimes called POV-2:

> A "problem" is identified from the point of view of an
> individual. A traffic engineer and a landscape architect can
> stand in the same place, see the same mess, and identify
> different "problems" — each coherent within their lens, neither
> reducible to the other.

This is the constructivist turn that runs from Maturana & Varela
(autopoiesis) through Heinz von Foerster's second-order cybernetics
to Ernst von Glasersfeld's radical constructivism. The observer
isn't an external recorder; the observer's *act of distinction* is
what produces the observed. There is no view from nowhere.

For Bramble this is more than philosophy — it's a design constraint.
Three implications:

1. **Multiple coherent carvings of the same data must be possible.**
   The same set of Nodes and Edges has to support a project-view, a
   chronological view, a person-view, a tag-typed view, and so on.
   No single carving is privileged. F-Supertag-conditional rendering
   is a partial implementation of this; future first-class
   Perspectives complete it.

2. **The system should make the lens explicit.** A user looking at
   a Node should be able to see *through which lens* they're
   looking — and switch. The predecessor-nav control
   (F-DAG.Phase3e) is the prototype: it surfaces "which predecessor
   am I looking from?" as an explicit choice. Generalising this is
   the Lenses feature surface.

3. **No claim to objective representation.** Bramble doesn't
   promise that your graph is "true" — it promises that it's
   *yours*, coherent within the lenses you've chosen. Users are
   the meaning-makers; the tool is the support structure.

The Maturana / von Foerster / Glasersfeld lineage matters because
it's the strongest philosophical defence against the
"organise-your-thinking" pitch that knowledge tools default to.
Organising-your-thinking *for you* is a category error in a
constructivist frame. The most the tool can do is *support your
ongoing act of construction*.

---

## 4. DSRP (Cabrera) — a primer

Derek Cabrera proposes that all cognition reduces to four primitive
operations, each with two complementary poles. (See Wikipedia DSRP;
Cabrera Research Lab.)

| Op | Poles | What it does |
|---|---|---|
| **D** Distinction | identity ↔ other | carves a "thing" from background |
| **S** System | part ↔ whole | groups parts into wholes / decomposes wholes into parts |
| **R** Relationship | source ↔ target (action ↔ reaction) | connects distinct things |
| **P** Perspective | point ↔ view | chooses *from where* the other three are performed |

Cabrera's *strong* claim — that DSRP is the universal substrate of
human cognition — is contested. Critics find it reductive (cognition
includes affect, embodiment, language-games that don't fit the four
ops cleanly). We don't have to accept the strong claim to use DSRP
as a *vocabulary* for talking about a typed-graph knowledge tool. As
a vocabulary, it's unusually well-fitted: the four ops correspond
almost 1:1 to the primitives Bramble's data model has been pushing
towards since F-DAG, and they make explicit a dimension (Perspective)
that's been implicit in F-Zoom / F-Open-Pane / F-DAG.Phase3e but
never named.

The fifth subtle Cabrera point is **recursion**: each op can be
applied to the others. You can take *a Perspective on a Distinction*
(rename a category). You can build *a System of Perspectives* (saved
views indexed by topic). You can identify *a Relationship between
Perspectives* (this team's view differs from that team's view).
Recursion is what makes DSRP a usable vocabulary rather than a flat
checklist — and it's where the most interesting future Bramble
features live (see §8).

---

## 5. The DSRP-on-triples refinement

Cabrera treats S (System / part-whole) and R (Relationship /
action-reaction) as separate primitives. Working through Bramble's
data model surfaces a subtler reading: at the data layer, S and R
collapse into a single typed-edge primitive. The cognitive
distinction (grouping vs causal-chaining) remains real, but it lives
in *how you traverse / query / render* edges, not in their
representation.

### The move

An Edge is the raw primitive: a directed link from a source Node to
a target Node. Nothing more.

A *Relationship* is not a separate primitive — it is the
**agreed-upon semantic label** that an Edge carries. Part-whole
("source is whole, target is part") is one such label. Cause-effect
is another. Reference is another. Supertag-applies-to is another.

Under this reading:

- **D Distinction** survives: a Node is what it is by being
  distinguished (its content + its supertags carve identity from
  the blank).
- **Edge + Edge.kind** subsumes both R and S. The Edge is the
  carrier; the kind is the agreed relationship. *System* (part-
  whole hierarchy) **emerges** when edges of `kind: 'child'` form
  coherent containment structures. No native S primitive needed.
- **P Perspective** survives — and becomes the most interesting
  axis (see §6, §8).

### The triple-store parallel

This is the same shape as the **RDF triple-store**:
`<subject, predicate, object>` — where the predicate IS the
relationship semantics, and there is no separate "system"
abstraction. "Part-of" is one predicate among many. OWL adds
vocabularies that *mean* containment, but the substrate is uniform.

Quad-stores add a fourth element: the **named graph**. This is the
Perspective scope — which subset of triples is "in view". A clean
DSRP-on-quads mapping:

| DSRP-refined | RDF quad |
|---|---|
| D Distinction | resource (subject or object) |
| Edge + Edge.kind | predicate |
| P Perspective | named graph |

Cabrera's S — "the cognitive operation of grouping" — becomes
"predicates of kind whole-part forming coherent hierarchies, viewed
through a Perspective that foregrounds them". Not a primitive, but a
*derived view* over the substrate.

### "Agreed upon" is doing real work

The phrase **agreed-upon** matters more than it looks. The kind
vocabulary is **social, not intrinsic**. Different communities, supertags,
or users may agree differently on what an edge means. This connects
back to Snowden's coherence: an edge-kind is coherent inside its
declaring context, not globally correct.

Concretely:

- **Global kinds** — built into Bramble, agreed by everyone:
  `'child'` (structural part-whole, source = whole).
- **Per-supertag kinds** — declared by a supertag schema and
  scoped to relations involving instances of that type. A
  `#Project` might declare `has-task` whose semantics are coherent
  within Project-Task relations, undefined outside.
- **Per-user / per-space custom kinds** — a user's own taxonomy
  of edge labels, valid within their workspace and not portable
  by default.

This is why Edge.kind shouldn't be `Schema.String` — that admits
typos and undeclared kinds. It should be a closed vocabulary that
*grows by deliberate addition*, with each addition carrying declared
semantics:

- `sourceRole` — what the source plays (whole, cause, referrer)
- `targetRole` — what the target plays (part, effect, referenced)
- `symmetric: boolean` — whether direction is reversible

Each kind is a *unit of agreement*. Adding a kind is a social-
political act — it commits to a meaning. Removing or redefining a
kind is a coherence-breaking event for everyone who used the old
meaning. The Schema makes this explicit so the act of agreement is
visible in the type system.

---

## 6. Bramble's data model in DSRP/triples terms

| DSRP-refined | Bramble | RDF quad | Status |
|---|---|---|---|
| **D** Distinction | `Bramble.Node` + supertag (typed distinction; `#Task` distinguishes a Node from generic Nodes) | resource | shipped (F-Supertag) |
| Edge carrier | `Bramble.Edge` (source, target, directed) | (s, _, o) | shipped (F-DAG) |
| **R** agreed label | `Edge.kind` (currently single value `'child'`) | predicate | scaffolded (this rename); taxonomy growth = open thread |
| **S** emergent | hierarchies of `kind: 'child'` edges; the "outline" you see is this view | (no native primitive) | shipped (F-DAG part-whole semantics) |
| **P** Perspective | scattered today across F-Zoom (page-block shifts), F-Open-Pane (multiple panes), F-Page-Header (root-as-page), F-DAG.Phase3e (predecessor-nav), F-Supertag conditional rendering | named graph | implicit / scattered — future first-class Perspective Node-subtype consolidates these into one abstraction (the Lenses feature surface) |

### Where the fit is sharp

Distinction and System are well-represented and explicitly named.
Supertags are textbook D-operators (carve a typed identity).
ChildEdges (now `Edge` with `kind: 'child'`) are textbook S-emergent
structures.

### Where the fit is loose-but-suggestive

Two axes are scaffolded but not finished:

1. **Edge.kind taxonomy.** Today only `'child'` exists. The future
   work is to grow the closed vocabulary deliberately, with each
   kind declaring its role semantics. This is captured as an open
   thread (§8) and as `R-Edges-First-Class`'s reserved-`kind` clause
   in `PLUGIN.mdl`.

2. **Perspective.** Today perspectival affordances are scattered
   across four named features. The future work is a first-class
   `Perspective` Node-subtype that consolidates them. This is the
   Lenses feature surface — stance 3 of the naming framework, held
   in reserve.

### Where the fit is tight enough to inform the spec

The four primitives — `Node`, `Edge`, `Edge.kind`, `Perspective` —
are the *complete and minimal* data model under the DSRP-on-triples
reading. Any feature that doesn't reduce to one of these four
should be challenged: is it really a new primitive, or is it a
specialisation that should sit in `Edge.kind` or as a Perspective
configuration?

This is a stronger constraint than the spec carries today. It's
worth surfacing in a future `R-Four-Primitives` rule if the
discipline holds across a few feature increments.

---

## 7. Naming the product

The three-stance framework from §1 generated a long candidate list.
What follows preserves the search space so future renames or sister
products can see what's been considered. Bramble was chosen; the
others remain available as future candidates for adjacent features
or sister tools.

### Why Bramble (from the honour-the-mess stance)

- **Alive.** A bramble *grows* — it's a verb-able noun. You don't
  dance with a tangle (static knot — you untangle); you don't dance
  in a thicket (you're *stuck* in it). You dance *through* a
  bramble, and you get better at it over time.
- **The Br'er Rabbit folklore is the exact metaphor.** *"Please
  don't throw me in the briar patch!"* — the trickster who's at
  home in what traps others. *"Born and bred in the briar patch."*
  That story IS "dancing with the mess". No other word in English
  carries this so cleanly. It is the canonical English-language
  metaphor for thriving in entanglement.
- **The thorns are honest.** The mess pricks the unprepared —
  that's true to Ackoff (you can't naively decompose) and to
  Snowden (coherent moves require local knowledge). A skilled
  inhabitant moves through without bleeding. The thorns aren't a
  bug in the metaphor; they're the feature that distinguishes
  mastery from naïveté.
- **Compounds well.** `Bramble.Node / Bramble.Edge / Bramble.Graph`
  read as cleanly as anything in this conversation produced.
- **Collisions are minor.** Bramble whisky cocktail, Bramble
  dating app — neither in tech or knowledge management.

### Stance-1 candidates considered

| Pick | Compound test | Why-not |
|---|---|---|
| **Bramble** ✅ | `Bramble.{Node,Edge,Graph}` clean | *chosen* |
| Tangle | `Tangle.*` | IOTA Tangle is literally a DAG ledger for cryptocurrency — direct dev-tool collision in adjacent space |
| Thicket | `Thicket.*` | Passive: "stuck in a thicket of regulations". Less alive than bramble |
| Rhizome | `Rhizome.*` | Strongest philosophical pedigree (Deleuze) but polarising; Rhizome.org art-organisation collision; intellectual signal may not match the warmth of the Br'er Rabbit framing |
| Mycelium | `Mycelium.*` | Long compound; biotech connotation; trendy reference |
| Bramble's cousins (Briar, Bramble-Patch) | varies | Briar = Briar Project P2P messenger (DXOS-adjacent space — risky) |

### Stance-2 candidates considered (tend the mess)

| Pick | Why considered |
|---|---|
| Coppice | Best metaphor in this stance: multi-stem regrowth from human-cut stumps = literal DAG of cultivated wildness. Lost to Bramble on liveliness and the dance-with-mess criterion |
| Hedgerow | Cultivated wild edge supporting biodiversity. Less DAG-shaped (linear) |
| Trellis | Frame-for-growth — but overclaims structure relative to Bramble's honour-the-mess stance |
| Cairn | Strong dark horse: thought-marker on the trail, wayshaping vibe, no collision. Lost to Bramble on alignment with the honour-the-mess product positioning (Cairn implies marking-a-path-through, which is closer to stance-3 territory) |

### Stance-3 candidates (be the lens) — reserved for the Lenses feature

These remain on the table as the *feature* name for the perspective-
machinery surface, when it consolidates. Worth re-evaluating then:

| Pick | Reason to hold |
|---|---|
| Lens | Most accessible mainstream readability; "what's your lens on this?" |
| Optic | Best FP / developer-conceptual fit; composable views into data structures |
| Facet | Best multiplicity emphasis: a Node has many facets per supertag |
| Aspect | Wittgenstein's "seeing-as" pedigree; AspectJ collision |
| Vantage | Older / literary register |
| Prism | Splits one source into many; Prisma ORM collision (significant) |

The recommendation when the feature lands is **Lenses** (plural;
mainstream-readable; doesn't conflict with any pending Bramble
type). The other stance-3 picks can supply sub-feature names if
useful (e.g., "a Vantage on this Node" for an unzoomed bird's-eye
view; "this Facet of #Task" for one schema-conditional rendering).

### What was eliminated by direct collision

Surfaced during web search; named here so future renames don't
re-discover the same dead ends:

- Atlas — atlasworkspace.ai, AI knowledge-graph product
- Loom — Atlassian (video) + Play Store notes app
- Lattics — knowledge management
- Plexus / Plexus Notes — concept-map notes
- Helix Notes — local-first markdown notes
- Synapse / Cortex / Nexus — saturated (Synapse Cortex, Synapse
  Nexus, KGraph Nexus, Blue Brain Nexus)
- Fugue — Fugue Inc (cloud security, Snyk-acquired); dropped
  despite beautiful Composer-app polyphonic-DAG metaphor
- Tangle — IOTA Tangle DAG ledger; dropped

---

## 8. Open threads (carry forward into future spec increments)

Things this scaffolding generates that haven't yet landed in
`PLUGIN.mdl`. Some are flagged in the spec's `## Remaining` section;
others are conceptual ground covered here that hasn't yet warranted
a rule or feature entry.

### 8.1 Edge.kind taxonomy expansion

Today: `Edge.kind = Schema.Literal('child')`. Only one value.

Future kinds to introduce, each with declared role semantics:

| Kind | sourceRole | targetRole | symmetric | DSRP-S vs DSRP-R |
|---|---|---|---|---|
| `'child'` | whole | part | no | DSRP-S emergent |
| `'reference'` | referrer | referenced | no | DSRP-R |
| `'tag-applies'` | tag (e.g. `#Task` Node) | instance | no | DSRP-R + D |
| `'cause'` | cause | effect | no | DSRP-R |
| `'co-occurs-with'` | — | — | yes | DSRP-R |

The closed enum at the schema level captures the *agreed-upon*
nature. Adding a kind is a deliberate spec move; removing one is a
breaking change. Per `R-Greenfield-Stance` (no real users yet),
additive expansion is cheap pre-launch.

A recursive move worth flagging: **each kind could itself be a
Node**, carrying its declared semantics in fields rather than in a
schema literal. That makes the kind taxonomy data-discoverable
rather than code-resident, and enables per-supertag and per-user
custom kinds to coexist with built-ins without schema bumps. The
trade-off: type-time safety of literal kinds vs. runtime extensibility
of data-resident kinds. Probably the right move is to keep built-in
kinds as literals AND allow data-resident extension kinds that
reference a generic `'extension'` literal — best of both.

### 8.2 First-class Perspective Node-subtype

Today: perspectival affordances live in:
- F-Zoom (page-block shifts within a pane)
- F-Open-Pane (multiple simultaneous perspectives)
- F-Page-Header (root-as-page H1 rendering)
- F-DAG.Phase3e predecessor-nav (explicit choice of "from which
  predecessor am I viewing")
- F-Supertag conditional rendering (typed schema per supertag)

Each was added as a one-off. They share a structural concern that
hasn't been named: *which scope + which vantage am I rendering this
graph from?*

Proposed future Node-subtype, working name `Perspective` (or
`Lens` if the feature name lands):

```
Perspective {
  anchor: Ref<Node>          # the page-block / starting point
  predecessorFocus?: Ref<Node>  # the chosen predecessor (F-DAG.Phase3e)
  supertagFilter?: Ref<Node>    # which supertag's schema to foreground
  zoomDepth?: number            # how far down to render
  paneId?: string               # which pane this perspective is mounted in
  label?: string                # user-given name for the perspective
}
```

Users can save perspectives, share them, browse a list of their
own (S-on-P recursion: a System of Perspectives is itself a Node
tree). Cross-cutting concerns like "show me this Block as part of
project X" become Perspective configurations, not new features.

### 8.3 `components/Edge/` and `components/Perspective/`

The Bramble rename adopted **primitive-aligned component dir names**:
`components/Node/`, `components/Graph/`, `components/Editor/`. Two
symmetric directories are deliberately absent:

- `components/Edge/` — no edge-kind UI today (edges are implicit
  in tree indentation). When edge-kind chips, kind-taxonomy editors,
  or kind-declaration UIs land, this is the home.
- `components/Perspective/` — no first-class Perspective today (see
  §8.2). When the Lenses feature lands, this is the home.

The absences are visible in the directory tree, which is a feature:
new contributors see *what's missing* in the renderer surface.

### 8.4 Recursive DSRP applications

Cabrera's recursion claim opens features Bramble doesn't have yet:

- **Perspective on a Distinction.** Rename a category or change its
  default rendering across many perspectives.
- **System of Perspectives.** A saved-perspectives folder; one
  perspective can be "the project view's parent" of another.
- **Relationship between Perspectives.** This team's view of Topic
  X differs from another team's view; the difference itself is
  data (an edge of kind `'differs-from'`?).
- **Perspective on a Perspective.** A meta-view: "show me my
  perspectives organised by which supertag they foreground".

None are urgent. They're flagged so the data model's headroom is
visible. If features keep arriving that hit one of these patterns,
that's a signal recursion is doing real work and deserves explicit
spec accommodation.

### 8.5 Lenses as the feature name for stance 3

When the consolidation of §8.2 lands, the user-facing feature name
should be **Lenses** (plural). Reasoning in §7. The product remains
Bramble; Lenses is what you *do* in Bramble.

### 8.6 Day-pages and the singleton question

Adjacent open thread from the same conversation: should Bramble be a
**singleton per ECHO space** (one Graph object per space) or
multi-instance (each Graph instance is independent)? Today multi-
instance is shipped (`createObject` creates a new Graph each time).
But the data model is space-wide (Schema/Library Blocks, supertag
instances, all queryable across the space), so "two Graphs" today
means "two roots into the same graph" — not two isolated graphs.

The cleanest position is **option 2 from the conversation**:
singleton-per-space. Internal precedents: Schema Block, Library
Block, tag Blocks, option Blocks are all already singleton-per-
space via `findOrCreate*Block + acquireLock`. A fifth singleton (the
Bramble Graph itself) extends the pattern instead of introducing a
new abstraction.

Captured here so the next session can pick it up — was a planned
F-One-Graph increment in the original conversation, deferred to do
the rename first.

---

## 9. Lens — from concept to operational primitive

What follows extends §8.2's "first-class Perspective Node-subtype"
into a concrete design. Captured 2026-05-13/14 from a working
session that explored what Lens has to BE if it's going to earn its
keep — i.e. do work that a saved query with rendering options
cannot.

### 9.1 The Tana trap

If a Lens is "an anchor + a filter + a renderer," then Bramble's
Lens primitive collapses to a saved query with rendering options.
Tana ships exactly that. Notion ships exactly that. There is no
reason a user would adopt Bramble specifically for *that*.

The Tana shape leaves Cabrera's P doing no work: in a saved-query
view, the *point* is just "the predicate I filter by," and the
*view* is just "the rows that pass." Same distinctions, regrouped.
Pivot-table semantics. Cabrera's stronger claim — *the point
generates new distinctions* — is wholly absent.

The Lens primitive earns its existence only if it does what saved
queries categorically cannot. The design conversation kept drifting
toward Tana-shape; flagging this drift in advance.

### 9.2 What Cabrera's P actually does — five operations

Cabrera's formula: **P := (ρ ↔ v)** — a point co-implying a view.
Working through what that means operationally (and what the
real-world examples in §9.4 demonstrate empirically):

1. **Observer substitution.** The agent doing the thinking
   changes. From "I, the user" to "I, the microbe / the customer
   / the future generation / the strongest critic." The cognitive
   stand-in is the perspective; the substrate has not changed.

2. **Ontology inheritance.** The new observer brings its own
   salience map — preferred D's, S's, R's. A microbe-perspective
   foregrounds chemical gradients; a customer-perspective
   foregrounds friction and price; an engineer-perspective
   foregrounds technical debt. The perspective doesn't just
   filter; it *imports a vocabulary of relevance*.

3. **Generative response.** With observer substituted and ontology
   inherited, the perspective produces *new content* — statements,
   judgments, narratives, predicaments — that did not exist before
   its activation. This is the move Tana's views cannot make. The
   graph grows by one perspective-produced artifact per
   invocation.

4. **Attribution.** The generated content carries its provenance.
   *The Penelopiad* is recognisably the maids' account, not
   Homer's. The premortem risks are tagged future-failure-team.
   Without attribution, perspective-generated content drifts loose
   from its source point and loses meaning.

5. **Composition (P-on-P).** Perspectives operate on the outputs
   of other perspectives. *Wide Sargasso Sea* is a perspective on
   the perspective *Jane Eyre* embedded. Steelmanning is a
   perspective on the opponent's perspective. The recursion isn't
   a curiosity; it's how genuine cultural critique works.

### 9.3 The homogenous-perspective error

Cabrera explicitly names a failure mode:

> *Homogenous perspective error: assuming any group is
> characterised by a single perspective.*

A tool that surfaces *only one* perspective on a graph (the
"outline view") trains the user to think there is one true view.
Making perspectives *plural* and *explicit* is itself a cognitive
intervention. Tools that allow only an implicit perspective do
cognitive harm — they bake in a default vantage and obscure that
other vantages exist.

Bramble's Lens primitive earns its keep when it makes plurality
visible and switchable. This is the deepest justification for the
primitive's existence I've found in Cabrera.

### 9.4 Generative-P examples from the wider world

A sampler of how perspective-taking actually works outside
knowledge tools. Each example does what a query cannot. Captured
here so the design has anchors when "what is a Lens, really?"
comes up later.

**Irreconcilable accounts of the same event:**

- *Rashomon* (Kurosawa, 1950). Four witnesses, four accounts of a
  forest killing. None is a filter on the others; each *generates
  different facts*. The "Rashomon effect" is now a term cognitive
  scientists use for the constitutive role of perspective in
  memory.
- *The Sound and the Fury* (Faulkner, 1929). Same family decline
  narrated four times. The first section is told by Benjy whose
  perception is non-linear and pre-verbal; decades collide on one
  page because that is the cognitive architecture of his point.
  Point as constitutive of what counts as an event.

**P as cognitive scaffold:**

- Rawls's *Veil of Ignorance* (1971). Design a society from a
  perspective where you don't know your own position. The point
  IS the ignorance. Produces principles (the difference
  principle) that exist nowhere in the world prior.
- Gary Klein's *Premortem* (2007). Imagine the project has
  already failed; reason backwards. Klein's research: ~30% more
  risks surfaced vs. standard risk workshops. Same project;
  future-failure-perspective sees what present-perspective
  cannot.
- Haudenosaunee Seventh-Generation Principle. Decide as if a
  generation alive in the 23rd century will judge. Operative in
  constitutional change and resource management for six
  centuries. Different perspective → different priorities than
  quarterly-shareholder thinking ever produces.

**P of a non-human / non-conscious entity:**

- Lynn Margulis & endosymbiotic theory (1967 onwards). The
  biologist's decade of inhabiting the microbial perspective
  produced the theory that eukaryotic cells are consortia of
  formerly free-living microbes. Textbook biology now. Same
  cells; different ontology — generated by the perspective.
- Aldo Leopold, "Thinking Like a Mountain" (1949). The mountain
  has a perspective across geological time; from the mountain's
  view, the wolf is essential infrastructure. Foundational essay
  of modern ecological ethics — generated by perspective on a
  non-conscious entity.
- Einstein's light-beam thought experiment (1895). "What would I
  see riding alongside a light beam?" The impossible perspective
  generated, ten years later, the theory (special relativity)
  that explained why no observer can occupy it. Physics advanced
  via point-of-view.
- Robin Wall Kimmerer, *Braiding Sweetgrass* (2013). Potawatomi
  botanist; takes the perspective of plants ("what does the
  strawberry want?") as a research method. Yields agronomic
  practices Western biology missed.

**P that inverts the canonical narrative:**

- Margaret Atwood's *The Penelopiad* (2005) — *Odyssey* from the
  perspective of the twelve murdered maids.
- Tom Stoppard's *Rosencrantz and Guildenstern Are Dead* (1966)
  — *Hamlet* from two of Shakespeare's minor characters; the
  famous soliloquies become gibberish heard offstage.
- Jean Rhys's *Wide Sargasso Sea* (1966) — *Jane Eyre*'s
  "madwoman in the attic" written as a Creole protagonist
  destroyed by colonial racism.

**P as negotiation / empathy infrastructure:**

- Gestalt "Empty Chair" technique. The client physically
  switches chairs and speaks *as* the absent person; words
  emerge the client didn't know they could access.
- Internal Family Systems (Schwartz, 1990s). The psyche as
  multiple "parts" each with its own perspective; therapy works
  by dialoguing among them.
- Steelmanning. Before arguing against a position, state its
  strongest form — stronger than the opponent did. Sometimes the
  steelman convinces you and you change your mind.
- Project Zero's "Step Inside" routine (Ritchhart et al.).
  Three sub-prompts — perceive / know / care about — applied to
  any chosen point. Captured separately in §9.10 because it's
  the cleanest pedagogical instantiation of generative P.

**P as aesthetic primitive:**

- Cubism (Picasso/Braque, ~1907–12). Multiple simultaneous
  perspectives on one canvas. Asserts that single-point
  perspective *under-represents* the object.
- Italo Calvino, *Invisible Cities* (1972). 55 cities described
  *from the city's own perspective* — each a meditation on a
  single quality (memory, desire, signs, exchange).
- Wes Anderson's *Grand Budapest Hotel* (2014). Plot nested four
  perspective-levels deep; the story changes meaning at each
  level. P-on-P-on-P-on-P as structural principle.

**P that reveals what perspective itself is:**

- Thomas Nagel, "What Is It Like to Be a Bat?" (1974). The
  structural inaccessibility of one perspective from another
  becomes a definition of consciousness.
- Wittgenstein's duck-rabbit (*Philosophical Investigations*,
  1953). Same lines, two seeings. Perception always involves a
  perspective.
- Bohr's Complementarity (1927). The wave/particle property of
  light *depends on the measurement perspective*. Physics
  accepted that the substrate itself is perspectival.

### 9.5 What unites these examples

- **The point is a stance, not a filter.** None of these can be
  expressed as `WHERE typename = X`. Each is a cognitive-
  imaginative apparatus.
- **The output is new content, not subset.** The graph grows
  under perspective-taking; rows are not selected.
- **Multiple perspectives can be irreconcilable and that's the
  point.** Rashomon's accounts don't average to a truth.
- **The perspective can be of a thing** (mountain, microbe,
  city, beam of light). "Perspective of an idea or thing" is a
  real cognitive move with empirical track record (Margulis,
  Leopold, Kimmerer).
- **P can be of P.** Recursion is how cultural critique,
  therapy, philosophy of science, and metacognition all operate.
- **Time horizons are points.** Seven generations, premortem,
  80-year-old self, geological time. The temporal frame *is*
  itself a perspective primitive.

### 9.6 What a tool must provide to enable generative P

Decomposing the five operations from §9.2 into tool affordances:

| Operation | Tool affordance |
|---|---|
| Observer substitution | Perspective Node — first-class data object with `identity` (who/what), `vocabulary` (positive + negative), `access` (what it can/can't know), `priorities`, `temporal frame`, `failure-modes` (what it MUST NOT do) |
| Ontology inheritance | Salience declaration — which `Edge.kind`s foregrounded; which dimmed; which supertags salient; which fields prioritised. Same Node renders differently per Lens |
| Generative response | Invocation surface — pair (Perspective, Target) → produce annotation. Three modes: human-driven (Step-Inside style); AI-driven (LLM with Perspective declaration as prompt); hybrid |
| Attribution | Annotation as new Node + provenance edges: `about: Ref<Node>`, `from: Ref<Perspective>`, `by: Ref<User>`, `at: timestamp`. The graph remembers cognitive history |
| Composition | Perspectives apply to annotation Nodes the same way they apply to source Nodes. P-on-P emerges naturally; no special machinery |

**Why this is newly feasible:**

- **LLMs as drop-in perspective-takers.** Modern LLMs are
  extraordinary at perspective-taking — a capability Margulis
  cultivated over a decade, a model can perform in seconds for a
  wide class of perspectives. Not all (you wouldn't trust an LLM
  with a microbial perspective on novel biology) but many useful
  ones (customer voices, role-stakeholders, conceptual stances,
  historical figures, future-selves).
- **Local-first graph databases (ECHO).** Annotation Nodes need
  to persist, link to source, be edited, queried, survive
  sessions. ECHO provides this without a server round-trip per
  generation.
- **Plugin architecture (Composer).** A perspective surface is
  not yet-another-app; it's a new kind of *interaction* inside
  an environment the user already uses for everything else.

**The big-picture move:**

What this enables, in one sentence: *a knowledge graph that
records not just what the user knows, but who they had to become
to see it.*

That's a category of tool no one has shipped. Notion shows what
you know. Tana shows what you know, typed. Roam shows what you
know, linked. Bramble (in this model) would show what you know,
*viewed-from-where*. Every Node would carry answers to two
questions:

- *What is this?* (the content)
- *From which perspectives have I looked at this?* (the
  annotations and their attributions)

The second question has never been first-class in a knowledge
tool. Books carry it implicitly (an author). Conversations carry
it as turn-taking. Wikis explicitly try to hide it (NPOV). A
perspective-aware graph would make it the central thing.

### 9.7 Worked example — Steve's follow-up-email process as Cabrera-P operationalised

In an adjacent Claude session (2026-05-13), Steve drafted a
follow-up email to a venture partner using a process he later
reframed as Perspective work. The full process doc is at
`sandbox/alright-whats-next/.claude/worktrees/great-ellis-47116c/People/eric-engineer/notes/2026-05-13-followup-email-process.md`
in the adjacent worktree.

The document is unusually disciplined Cabrera-P in operational
form. Reproducing its structure here because it crystallises what
Bramble's Lens primitive needs to support.

**The Point is structured, not narrated.** A seven-row table
making each aspect of the perspective examinable and linked to
source artifacts:

| Aspect | Generalised role |
|---|---|
| Who is sending | author identity (grounded in canonical source files) |
| Relationship to receiver | dyadic context (history, prior contact, register) |
| Capacity actually available | author scope (what they can deliver right now) |
| Credibility scope claimable | author provenance (evidence basis for claims) |
| What the agent NEEDS | the positive ask |
| What the agent does NOT need | the explicit negative space |
| Failure modes to avoid | the forbidden moves |

The last two rows do work my earlier Lens sketches missed: a
perspective is *as much defined by what's excluded as what's
included*. Inhabiting Steve-here means refusing the
"stay-in-touch" register, the pity-conversation, the
portfolio-recital. The forbidden moves are part of the
perspective's identity.

**The 7 phases are perspective-discipline, not a pipeline.**

- Phase 0: re-anchor the Point (re-load source artifacts before
  drafting).
- Phase 1: re-ground the source conversation (raw transcript over
  auto-summary; surface attribution errors).
- Phase 2: build named-entity research substrate.
- Phase 3: scan adjacent space honestly (judgment-producing
  lens, not row-selecting filter).
- Phase 4: draft the View, mirror source language, refuse Claude
  register inflation, three-iteration scope calibration on
  credibility claims.
- Phase 5: audit the View *from the Point* — every claim
  defensible per-segment, confidence-rated, weak claims flagged
  with distinct visual treatment.
- Phase 6: render the audited View legibly (per-segment hover
  links to audit entries; flagged claims visually distinct).
- Phase 7: author writes personal portion (Phases 4–6 guarantee
  the structural content is defensible; the personal opener is
  voice-preserved by convention — the system refuses to draft
  it).

Phases 0 and 5 are P-on-P moves: applying the Point to its own
state and to its own output.

**The closing "What a different Point would have produced"
section.** Five alternative Points are named and what each would
have generated:

| Alternative Point | Would have produced |
|---|---|
| "Generic networking" | padded candidate list to look thorough |
| "VC-pitch" | specific ask for a specific intro |
| "Research-summary" | recited info the recipient already knows in finer detail |
| "Credentialed-stranger" | over-justified qualifications |
| "Claude-default professional register" | "thought leadership / strategic alignment / value-add" inflation |

This is Cabrera's homogenous-perspective-error correction in
operational form. Most perspective-work skips this verification
step; including it elevates the document from "thoughtful process
notes" to "P operationalised."

**The process generates *canon*.** Each iteration produces new
generalisable rules:

- `canon/quoted-material-is-verbatim.md` — quoted phrases must be
  source-verbatim.
- `canon/mirror-source-language.md` — mirror the source's actual
  words for rapport (paired with the above).
- `canon/experience/rackspace.md` — captures the operator-
  adjacent provenance for "infrastructure" as a credibility
  claim.

This is *better than the earlier Bramble sketch*. The
perspective-discipline produces *generalisable principles* that
constrain future perspective-work. Each cycle improves the
institution's perspective-taking capacity. Canon is not the
Point; it is the *habits* that maintain the Point's integrity
across many Views over time.

**Implicit P moves in Steve's process that weren't labelled as P:**

- *Phase 1's transcript re-grounding.* Going back to the raw
  transcript and discovering auto-summary fabrications is taking
  the perspective of *actual utterance* over the perspective of
  *Claude's summary*. Both are perspectives on the same audio;
  one is closer to source. The discipline is to keep checking
  which Point your facts came from.
- *Phase 4 rule "Don't recite to a board member."* Multi-Point
  sensitivity — the View must accommodate that the *reader* has
  their own Point on the content. You're not just generating
  *from your Point* but *for their Point*. The dyadic case of P.
- *Phase 4 rule "Claim credibility at accurate scope."* The
  three-iteration walk (overclaim → underclaim → accurate) is
  P-against-P: the author's self-perception Point vs. an
  imagined honest-auditor's Point. The iteration calibrates
  between them.
- *The canon library itself.* Each canon artifact is a
  *constraint on perspective-taking* — a meta-perspective on
  future selves who might cut corners.

### 9.8 What this teaches Bramble's Lens design

Consolidated implications from §9.6 + the Steve worked example:

1. **Lens fields should include `failure-modes` and `does-not-need`,
   not just `priorities`.** The forbidden moves define the Lens as
   sharply as the positive ones. Without negative space, the Lens
   drifts toward Claude-default register or generic best-practice.

2. **Lens activation should include a *re-anchor* phase.** Before
   generating, the tool re-loads the Point's source artifacts and
   presents them to the user (or the AI). Without it, the Point
   ossifies and successive Views drift.

3. **Views generate artifacts with per-claim provenance.** Audit
   as the default output shape, not a separate step. The audit
   *is* the View's accountability surface.

4. **The Point must respect that the reader has their own Point.**
   Two-Point work — generating-from-author-Point, generating-for-
   audience-Point — is a distinct mode. The Lens should carry
   "audience Point" as a constraint, not just "author Point."
   This is multi-Point sensitivity most knowledge-tool design
   ignores.

5. **The work generates canon.** Each Lens-application can
   produce new rules that get added to a canon library. The
   library is itself a graph object, browsable, citable from
   future Lens-applications. This is how the institution's
   perspective-taking capacity *compounds*.

6. **Alternative-Point counterfactual checking should be a
   standard view.** "Show me what this artifact would look like
   under [these other Points]" should be a one-click affordance.
   Phase-5-style verification, made invokable.

7. **The personal portion belongs to the user.** The Lens system
   should *refuse* to draft author-personal content. The tool
   should be opinionated about which parts of a View are
   author-personal and which are perspective-mechanical.

8. **Per-segment hover-audit rendering is the generalisable
   pattern.** Phase 6's "every claim is a link to its audit,
   with hover summary, with flagged-claim visual treatment"
   should be how Bramble renders ANY perspective-generated
   artifact. Readable prose for the reader; one-click
   defensibility for the author.

**A small refinement to the framing.** Steve's "Point" is doing
two distinct jobs: (a) the stance (who he is, what he needs, his
vocabulary, his failure modes), and (b) the constraint set
(canon principles, mirroring rules, audit requirements).
Cabrera's P-as-(ρ ↔ v) handles (a) cleanly. (b) is more like
*cultivated discipline* than perspective-as-such — what *maintains
the integrity* of perspective-taking across many Views over time.

So: the **Point** is the agent; the **canon** is the agent's
*habits*. Both are needed to produce a consistent View, but
they're different kinds of artifact. In the tool: the Perspective
Node carries stance fields; a separate "Practice" or "Canon"
layer carries the rules that constrain *how* the perspective
operates.

### 9.9 Opening screen as a Lens — design walks

Two scenarios walked in this round of work to test what "Lens"
means as a first-instance feature.

**Today Lens (single anchor, dynamic resolver):**

- Point: `() => getOrCreateDayPage(graph, today())` — a function
  resolving to a date-specific Node each open.
- View: standard Article surface, page-block = today's day-page.
- UX: Bramble opens to today's date as an H1, ready for typing.
  Subsequent opens same day resolve to the same Node; next day
  resolves to a fresh one.
- Open decisions (deferred):
  - Date in `content` (renamable) vs typed field (stable label
    via renderer)?
  - Continuity: snap-to-today on re-open, or restore last-zoom?
  - Date navigation chrome: page-header arrows, calendar picker,
    recent-days list, or none?
  - Lens chrome visibility: invisible until second Lens exists,
    subtle label always, or palette-only?

**Tasks Lens (cross-cutting typename point):**

- Point: a typename (e.g., `org.dxos.type.task`) — a *category*,
  not a place.
- View: the QueryNodeView surface (existing F-Supertag Phase 3b
  infrastructure) listing all instances.
- Distance from Today: orthogonal axis. Today asks "what am I
  doing right now?"; Tasks asks "what am I responsible for
  across all time?" Same graph; non-overlapping vantages.
- The introduction of "Lens" as a distinction: when the user
  creates this second Lens (e.g., via "Save as Lens…" on a
  tag-node page), they encounter "Lens" vocabulary for the
  first time. The Today Lens retroactively becomes legible as a
  Lens too. This is the Cabrera move literally: *naming a
  perspective surfaces the prior implicit perspective that was
  already shaping their view*.

**Crucial constraint surfaced in the walks.** Lens-as-distinction
cannot exist with N=1. With only Today, "Today" is
indistinguishable from "how Bramble works." Plurality is what
introduces the concept. The Tasks walk was chosen because it's
*genuinely distant* from Today on every axis (point is a category
not a place; view is cross-cutting not local; relationship to
graph is orthogonal). Threshold / Continuation / Inbox aren't
distant enough — they just substitute the anchor with a different
"where to start" while keeping the same view-shape.

**What the Tasks walk revealed.** With Today alone, `point` could
be a function-or-Ref union. With Tasks added, it becomes a tagged
union with `kind` discriminator:

- `kind: 'function'` (Today) — resolves dynamically each open.
- `kind: 'typename'` (Tasks) — resolves the per-space tagBlock.
- `kind: 'node-ref'` (future Threshold) — resolves to a specific
  Node.
- `kind: 'composition'` (future meta-perspective home) —
  resolves multiple sub-perspectives.

This is a design forcing-function that wasn't visible when only
Today was in scope.

**Is the Tasks Lens "effectively a query"?** Mostly yes for
catalog Lenses: a typename predicate. Bramble *already has* this
primitive (the `Bramble.Node.queryRef` field used by F-Supertag
Phase 3b query-nodes — "when set, this Node is a live query
result list — its outline rendering is REPLACED by a list of
every ECHO instance whose typename matches `queryRef.typename`").
The Tasks Lens is largely a saved query-node treated as a
first-class opening — no new schema beyond a
`BrambleGraph.defaultPerspective: Ref<Node>` pointer.

But **Lens ⊃ Query.** State-dependent points (Continuation Lens —
last-viewed Node), find-or-create resolvers (Today),
compositions (Morning Lens) are not expressible as graph queries.
The Perspective primitive is the *generalisation* of `queryRef`
to other kinds of points — not a parallel primitive.

**The trap to avoid:** the design conversation kept collapsing
back into "saved view + rendering" because Tasks fits that shape
neatly. Today doesn't (it's a find-or-create resolver, not a
query). The Lens primitive should be designed so that *Today is
not the special case* and Tasks is — the more general form
accommodates the function-and-state-dependent points that don't
reduce to queries.

### 9.10 Step-Inside as the canonical first generative Lens

If Bramble ships one perspective-taking Lens beyond Today + Tasks,
Step-Inside (Harvard Project Zero — Ritchhart, Church, Morrison)
is the cleanest Cabrera move:

> Three sub-prompts applied to any chosen point X:
>
> 1. What can [X] **perceive**?
> 2. What might [X] **know**?
> 3. What might [X] **care about**?

X can be a persona, an object, an idea, a future self, a non-
human entity, an artwork, an institution, an abstract concept.
The protocol generates content the substrate did not previously
contain — Cabrera's "perspective of an idea or thing" made
concrete in three prompts.

The Project Zero materials specifically endorse non-human points:
"works really well with self-portraits, portraits and group
portraits and also with objects too." A painting can be a point;
an architectural space can be a point; a historical moment can
be a point. The Step-Inside routine commits the user (or the AI)
to answer perceive/know/care from inside that point.

Bramble UX for Step-Inside:

- User invokes "Step Inside" on the current Node, picks (or
  declares) a point — a persona, an object, an abstract concept.
- A three-pane form opens: Perceive / Know / Care.
- Either user fills it in (cognitive gym mode), or LLM fills it
  in given the point declaration + Node content (AI-driven
  mode), or both (hybrid — LLM drafts, user revises).
- Output: three child Nodes attributed to the Step-Inside
  invocation with provenance edges back to the point and the
  source Node.

This is the smallest unit of "Lens does generative work" that
isn't a database view. If Bramble ships it, the Lens vocabulary
is earned.

**Other generative Lens types worth holding as candidates:**

| Lens | What it generates |
|---|---|
| Six-Hats (de Bono) | Six bundled perspectives — Facts, Feelings, Critique, Benefits, Creative, Process — each producing a different kind of contribution. Switching reveals what each hat sees that the others don't. |
| Iceberg (Donella Meadows) | Four perspective-altitudes on the same event — Events, Patterns, Structure, Mental Models. Each altitude foregrounds different distinctions about the same content. |
| CATWOE (Checkland's Soft Systems) | Six stakeholder perspectives — Customer, Actor, Transformation, Worldview, Owner, Environment — for any change initiative. |
| Premortem (Klein) | Future-failure point. "It's a year from now, this project failed catastrophically. Why?" Generates risks present-perspective cannot see. |
| Adversarial / Red-Team | "What would the strongest critic argue?" Counter-perspective. |
| Outsider | "Someone with no prior context for this." Surfaces what's missing, jargon-y, tacit. |
| Future-Self | "Your 80-year-old self / your team next year." Time-horizon shift. |
| Voice-of-the-Idea | "The project itself." Personification-as-cognitive-aid. The codebase wants simplicity; the design fears feature-creep; the project remembers its origin commitment. |
| Conflict Lens | A meta-Lens surfacing Nodes where two of your other Lenses produce contradictory annotations. |

Each of these *generates content* — annotations, judgments,
risks, framings — that didn't exist before the perspective was
taken. None of them collapse to "WHERE typename = X."

### 9.11 Open questions carried forward

Captured here so the next session can pick up the thread:

- **Perspective Node schema fields.** Concrete shape to be
  drafted. Candidate fields: `name`, `identity` (prose),
  `vocabulary` (positive + negative), `access`, `priorities`,
  `failure-modes`, `temporal-frame`, `point` (tagged union per
  §9.9), `renderer-hint` (which view surface).
- **Point as tagged union — what kinds ship in v1?** Suggest:
  `function` (Today), `typename` (Tasks), `node-ref` (Threshold).
  Reserve `composition` for later.
- **Annotation Node schema.** What fields beyond the provenance
  edges? Confidence? Hedges? Author tags? Conversation thread?
  Per-segment audit linkage (Phase 6 pattern)?
- **Canon as a graph object.** Should canon entries be Bramble
  Nodes (the discipline-layer integrated into the graph), or
  external Markdown files (Steve's current approach)? Tradeoffs
  in composability vs. portability.
- **Alternative-Point counterfactual rendering.** What does the
  Phase-5-style "what would Point B have produced?" UI look
  like? A separate panel? An overlay? A diff view?
- **The personal-portion guarantee.** How does the Lens
  primitive know which parts of a View are author-personal?
  Marked regions in the template? A reserved "human-voice"
  Edge.kind? Convention-only?
- **Multi-Point work.** Author-Point + audience-Point as paired
  inputs to a single Lens activation. Schema implication: does
  a Lens carry `audience: Ref<Perspective>` as a field?
- **LLM provider abstraction.** AI-driven invocation needs an
  LLM. Which? Inline call, external service, BYOK? How does the
  provenance edge name the model + prompt-version so future
  iterations can audit "what model generated which annotation
  when"?
- **What ships first?** Three plausible sequences:
  1. *Today Lens only* (simplest; doesn't earn the Lens
     vocabulary until a second Lens lands).
  2. *Step-Inside as the first Lens* (most Cabrera-honest;
     introduces P as generative from day one; needs LLM
     integration).
  3. *Today + a Catalog Lens (Tasks)* (introduces plurality
     without needing LLM; cheapest to ship; least
     inspirational).
  - The walks in §9.9 mapped (3); the strongest design case is
    arguably for (2); (1) is the most pragmatic. Decision
    deferred.
- **Naming alignment.** Spec-and-code probably want to use
  "Perspective" (matching Cabrera); user-facing UI keeps "Lens"
  (friendlier, well-precedented in optics-and-microscopy
  metaphor). Decision deferred until the schema lands.
- **Relationship to existing `Node.queryRef`.** Is the
  Perspective Node a new type that *contains* a query-ref (when
  `point.kind === 'typename'`), or is the existing query-node
  pattern *generalised in place* by adding optional Perspective
  fields to `Bramble.Node` itself? Smaller schema delta vs.
  cleaner semantics. Decision deferred.

### 9.12 Strikingly-disciplined Cabrera moves worth naming

Pulled out of the Steve worked example and the literature, things
the design should explicitly support because they're rare and
high-leverage:

- **"What this Point produced that a different Point would not
  have."** Verification by counter-factual. Most
  perspective-work skips this; including it is what makes
  perspective-taking honest rather than self-confirming.
- **"What's NOT here yet."** Outsider-Lens / negation-Lens.
  Producing what's *missing* as first-class output. Databases
  categorically cannot do this; perspectives can.
- **"Mirror the source's actual language."** When a perspective
  acts ON something with a voice (a person, an institution, a
  prior document), mirroring its actual words rather than
  paraphrasing is a respect-and-rapport move that AI generation
  routinely fails on without explicit constraint.
- **"Re-anchor before each session."** Perspectives drift. The
  protocol-level habit of reloading source artifacts is what
  prevents Claude-default-register seeping into successive
  Views.
- **"Refuse to draft the personal portion."** The tool should
  be opinionated about author-voice preservation. Lens machinery
  for everything else; convention-protected handwritten opener.
- **"Generate canon as a byproduct."** Each cycle of
  perspective-taking that lands new rules adds to a discipline-
  library that compounds. The institution's perspective-taking
  capacity *grows*, rather than being re-discovered each
  session.

---

## 10. Sources

Web-search-verified during the conversation that produced this doc:

- Russell L. Ackoff, *The Art and Science of Mess Management*
  (1981) — [PDF](https://www.systemswisdom.com/sites/default/files/Ackoff-1981-Mess-Management_0.pdf)
- *Russell Ackoff: A Visionary in Systems Thinking* —
  [Systems Thinking Alliance](https://systemsthinkingalliance.org/russell-ackoff/)
- *Wicked Messes: The Ultimate Challenge to Reality* — Springer,
  2021 — [chapter link](https://link.springer.com/chapter/10.1007/978-3-030-71764-3_3)
- Wikipedia — [Wicked problem](https://en.wikipedia.org/wiki/Wicked_problem)
- Dave Snowden — *Anthro-complexity* —
  [Cynefin.io wiki](https://cynefin.io/wiki/Anthro-complexity)
- VOICECRAFT podcast E142 — *Anthro-Complexity: Entanglement,
  Wayshaping and Addressing Existential Threat with Dave Snowden* —
  [link](https://www.voicecraft.io/content/e142-anthro-complexity-entanglement-wayshaping-and-addressing-existential-threat-w/-dave-snowden)
- *Cynefin framework* —
  [Wikipedia](https://en.wikipedia.org/wiki/Cynefin_framework)
- Derek Cabrera — DSRP — [Cabrera Research Lab](https://cabreraresearch.org/dsrp/)
- *DSRP* — [Wikipedia](https://en.wikipedia.org/wiki/DSRP)
- *Dependent origination / pratītyasamutpāda* — Buddhist
  philosophy; the standard reference is the *Mahānidāna Sutta* in
  the Pali Canon, but a more accessible entry point is Joanna
  Macy's *Mutual Causality in Buddhism and General Systems Theory*
  (1991), which makes the systems-theory parallel explicit
- Maturana & Varela — *Autopoiesis and Cognition* (1980)
- Heinz von Foerster — *Understanding Understanding* (2003)
- Ernst von Glasersfeld — *Radical Constructivism* (1995)
- Joel Chandler Harris — *Uncle Remus: His Songs and His Sayings*
  (1881) — the Br'er Rabbit / briar patch story is in *The Tar-Baby*
  cycle. The folktale predates Harris and traces to West African
  trickster narratives via the African diaspora — the canonical
  English-language preservation is Harris's, the metaphor is older

**Added during the §9 (Lens) round, 2026-05-13/14:**

- Cabrera, D. — *DSRP Theory: A Primer*, Systems 10(2) 26 (2022) —
  [MDPI](https://www.mdpi.com/2079-8954/10/2/26) /
  [ResearchGate PDF](https://www.researchgate.net/publication/358965380_DSRP_Theory_A_Primer)
- Cabrera, D. — *Perspectives Organize Information in Mind and
  Nature: Empirical Findings of Point-View Perspective (P) in
  Cognitive and Material Complexity*, Systems 10(3) 52 (2022) —
  [MDPI](https://www.mdpi.com/2079-8954/10/3/52)
- Cabrera & Cabrera — *Four building blocks of systems thinking*,
  Integration and Implementation Insights (2022) —
  [i2insights](https://i2insights.org/2022/04/12/dsrp-systems-thinking-building-blocks/)
- Project Zero, Harvard Graduate School of Education —
  *Step Inside* thinking routine (formerly *Perceive, Know, Care
  About*) — written up at
  [Thinking Museum](https://thinkingmuseum.com/2021/06/30/step-inside-thinking-routines-to-foster-perspective-taking/);
  routine landing page at
  [PZ Thinking Routines](https://pz.harvard.edu/thinking-routines).
  Generalised in Ritchhart, Church, Morrison — *Making Thinking
  Visible* (Jossey-Bass, 2011).
- Project Zero — *Circle of Viewpoints* routine —
  [PZ routine PDF](https://pz.harvard.edu/sites/default/files/Circle%20of%20Viewpoints_0.pdf)
- Klein, Gary — *Performing a Project Premortem*, Harvard Business
  Review (Sept 2007) — [HBR](https://hbr.org/2007/09/performing-a-project-premortem)
- Rawls, John — *A Theory of Justice* (Harvard UP, 1971); veil of
  ignorance entry at [SEP](https://plato.stanford.edu/entries/rawls/)
- Margulis, Lynn — origin of endosymbiotic theory in the 1967 paper
  *On the Origin of Mitosing Cells* (J. Theor. Biol.); broader
  account in *Symbiotic Planet* (1998) and [Wikipedia](https://en.wikipedia.org/wiki/Symbiogenesis)
- Leopold, Aldo — *A Sand County Almanac* (Oxford UP, 1949); the
  essay "Thinking Like a Mountain" is its load-bearing chapter —
  [Wikipedia](https://en.wikipedia.org/wiki/A_Sand_County_Almanac)
- Kimmerer, Robin Wall — *Braiding Sweetgrass: Indigenous Wisdom,
  Scientific Knowledge and the Teachings of Plants* (Milkweed,
  2013) — [publisher](https://milkweed.org/book/braiding-sweetgrass)
- Haudenosaunee Confederacy — *Seventh-Generation Principle*, part
  of the Great Law of Peace —
  [Iroquois Museum](https://www.iroquoismuseum.org/sevengenerations/)
- Nagel, Thomas — *What Is It Like to Be a Bat?*, Philosophical
  Review 83 (Oct 1974) —
  [Wikipedia](https://en.wikipedia.org/wiki/What_Is_It_Like_to_Be_a_Bat%3F)
- Bohr complementarity (1927) — Copenhagen interpretation entry at
  [SEP](https://plato.stanford.edu/entries/qm-copenhagen/)
- Schwartz, Richard — *Internal Family Systems Therapy* (Guilford,
  1995); IFS overview at [Wikipedia](https://en.wikipedia.org/wiki/Internal_family_systems_model)
- *Rashomon effect* general entry — [Wikipedia](https://en.wikipedia.org/wiki/Rashomon_effect)
  (cinematic source: Kurosawa, *Rashomon*, 1950, adapted from
  Akutagawa's *In a Grove* / *Rashomon* short stories)
- Faulkner, William — *The Sound and the Fury* (1929)
- Atwood, Margaret — *The Penelopiad* (Canongate, 2005)
- Stoppard, Tom — *Rosencrantz and Guildenstern Are Dead* (Faber,
  1967)
- Rhys, Jean — *Wide Sargasso Sea* (Penguin, 1966)
- Calvino, Italo — *Invisible Cities* (Einaudi, 1972; trans.
  Weaver, Harcourt, 1974)
- Anderson, Wes — *The Grand Budapest Hotel* (2014) — for the
  nested-perspective structure as a formal device
- de Bono, Edward — *Six Thinking Hats* (Penguin, 1985) — six
  pre-built generative perspectives
- Meadows, Donella — *Thinking in Systems: A Primer* (Chelsea
  Green, 2008); the four-level iceberg model is widely attributed
  but discussed throughout her work and elaborated by Senge in
  *The Fifth Discipline* (Doubleday, 1990)
- Checkland, Peter — *Soft Systems Methodology in Action* (Wiley,
  1990); CATWOE root definitions
- Wittgenstein, Ludwig — *Philosophical Investigations* (1953); the
  duck-rabbit "aspect-seeing" passage at PI II.xi

---

## 11. How to use this doc

- **Pull from it.** When a `PLUGIN.mdl` rule, feature, or req
  needs philosophical grounding, cite a section here rather than
  paraphrasing. Example: a future `R-Edge-Kind-Is-Social` rule can
  cite §5 and §8.1. A future `F-Lens` increment can cite §9.
- **Append to it.** When new conceptual ground gets covered (a new
  philosophical source, a new stance refinement, a new framework
  contact like David Bohm's implicate order or Karen Barad's
  agential realism), add it here before the spec lands the
  feature.
- **Don't bind it.** This is not the spec. `R-Spec-Entry-Conventions`
  doesn't apply. Prose, contradictions, exploratory passages are
  all welcome — they're the material the spec works from, not the
  spec itself.
- **Resolve drift toward the spec.** When this doc and `PLUGIN.mdl`
  describe the same data primitive in incompatible terms, the spec
  wins for vocabulary; this doc updates. The reverse holds for
  philosophical framings (the doc wins for stance; the spec text
  updates to match).
