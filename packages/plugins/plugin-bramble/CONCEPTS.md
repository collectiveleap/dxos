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

## 9. Sources

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

---

## 10. How to use this doc

- **Pull from it.** When a `PLUGIN.mdl` rule, feature, or req
  needs philosophical grounding, cite a section here rather than
  paraphrasing. Example: a future `R-Edge-Kind-Is-Social` rule can
  cite §5 and §8.1.
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
