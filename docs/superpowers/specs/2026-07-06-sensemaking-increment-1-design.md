# plugin-sensemaking — Increment 1: capture → inbox → triage (Readwise source)

- **Date:** 2026-07-06
- **Status:** Design approved in brainstorm (2026-07-06). Ready for an implementation plan.
- **Relation to concept:** This is the **first buildable increment** of the horizontal Workbench captured in `2026-07-06-workbench-concept.md`. That doc holds the full model + reasoning; this doc scopes the first slice and is the spec of record for it.
- **Relation to shipped work:** `plugin-readwise` (connect → sync → browse) is shipped. It becomes a **feeder** here; nothing shipped is thrown away (its `Highlight`/`Bookmark` types, sync, and `HighlightCard` are reused). The earlier Readwise-only "increment 2..5" framing is superseded and lives in git history only.

---

## 1. Goal

Turn synced Readwise reading from a passive browse into a **triaged, actionable list with provenance**, built on a **source-agnostic spine** so later sources drop in without a rewrite.

**The user journey (walking skeleton):**
1. Readwise highlights sync in and appear as **flagged captures** in an **Inbox**.
2. The Inbox shows captures **clustered by what they're about** (their referent) — for a single source, this is the familiar group-by-source.
3. The user **triages** a capture by hand into **results**: a **to-do**, a **question**, or a **connection** to a project.
4. Each result keeps a **link back** to the capture it came from (and through it, to the source and the referent).

**Value delivered:** a first end-to-end sensemaking loop — capture, cluster, triage, trace — usable with the one source we already have.

---

## 2. Strategy — depth-first, then widen

Chosen principle: each increment delivers user value, and the best direction is a **complete end-to-end flow from the user's POV**. So we **finish the single-source vertical** before adding sources:

- **Inc 1 (this doc):** capture → Inbox → manual triage → results + traceability. *(single source: Readwise)*
- **Inc 2+ (later, not scoped here):** the Pipeline board + work-with-AI; then AI-assisted triage; **then** source #2 (Bluesky / Composer notes / email) as a drop-in adapter, adapting the model as real second-source needs surface.

The spine is source-agnostic from day 1 (see §4), so widening later is additive.

---

## 3. Architecture — two plugins, one seam

**`plugin-sensemaking`** (new, horizontal) owns the source-agnostic spine:
- The **Capture** envelope, the **Result** model, the **connect** relation, the **traceability** relation, and the **Flag** primitive.
- The **Inbox** surface (cluster + triage). This is the single reading-and-triage surface.

**`plugin-readwise`** (shipped) becomes a **feeder**:
- Keeps: connect · sync · ingest · the `Highlight` and `Bookmark` types.
- Adds: a **capture adapter** (project a `Highlight` into the common capture shape) and a **flag translation** (each synced highlight becomes a capture — in Readwise, *acting on it* is the flag).
- Its account view shrinks to **connect / sync / status** (the Inbox now owns reading + triage).

**Bootstrap order (per the brainstorm):** grow the spine out of the shipped `plugin-readwise` scaffolding, shifting the horizontal pieces into `plugin-sensemaking` as the increment comes together — so we reach the first slice of user value quickly without permanently coupling the spine to Readwise.

**Package constraints:** `plugin-sensemaking` is a new package → `"private": true`, registered in `composer-app` in its own `chore(composer-app):` commit (mirrors how `plugin-readwise` was wired). Follows the DXOS namespace/module conventions.

---

## 4. Data model

All new types live in `plugin-sensemaking` (a strict layer above `@dxos/echo`; no core-schema edits).

- **`Capture`** — the uniform unit; a **copy-on-write envelope** that starts as pure pass-through: it holds a reference to the source object it wraps plus workbench state (when it was flagged, its results). Content fields (a note, tags) are **optional and resident only on demand** — they materialize on the envelope only when the source can't supply them or the user edits them. A capture with no source is a bare thought (not exercised in Inc 1, but the shape allows it).
  - *Why an envelope, not state on the source:* connector-owned source objects must not be mutated (a re-sync would clobber it, and we may not own the write). The flag/results float **beside** the source.

- **`Result`** — a triage outcome with `kind` ∈ { **to-do**, **question** } and a body. **Proposal:** a small new `Result` type rather than reusing `@dxos/types` `Task` — a "question" is not a task, and coupling to `Task`'s lifecycle is a Pipeline-rung concern. *(Open — see §8; flip to `Task` reuse if preferred.)*

- **connect** — **not an object: a relation** `Capture —connects→ target`. A non-actionable observation ("this belongs with X") is a connection, not a note — this **replaces "comment."** Connections are relations, not board work. **Proposal:** the default target is a Collection ("project"); the full target-type set is refined later. *(Open — see §8.)*

- **traceability** — a relation `Result —from→ Capture`. The full chain a later work step can walk: `Result → Capture → source → referent`.

- **referent** — reused, not new: the shipped `Highlight.source → Bookmark{title,url}` **is** the referent. Clustering "by referent" for Readwise = clustering by that Bookmark. (The shipped `Highlight.origin` field and the canonical-URL referent key already added to `plugin-readwise` are the forward-compatible groundwork for cross-source clustering later.)

- **`Flag`** — a primitive to flag any object into a capture. For Readwise it is **applied automatically** by the feeder (every synced highlight is flagged); explicit in-Composer flagging of arbitrary objects is a later-source concern.

---

## 5. Surfaces & journey

- **Inbox** (`plugin-sensemaking`, new) — the single reading + triage surface. Shows flagged captures **clustered by referent**, each capture **rendered natively for its source** (a Readwise capture reuses the shipped `HighlightCard`; future sources register their own card via the same fan-out). Ordering mirrors the shipped browse (most-recently-active cluster first).
- **Manual triage** — on a capture: a **`+ result`** affordance creates a to-do or a question; a **`connect to…`** affordance creates the connection relation. Created results appear **inline under their capture**, each showing the link back to it.
- **Readwise account view** (`plugin-readwise`, shrunk) — connect / sync / status only; it no longer renders the browse (the Inbox does).

Non-goals for the surfaces in Inc 1: the Pipeline board, any AI chat, editing/working a result, cross-source rendering.

---

## 6. What changes for `plugin-readwise`

- **Add** the capture adapter + flag translation: on each sync, idempotently create/maintain one `Capture` per `Highlight` (same foreign-key discipline as the shipped idempotent capture — re-sync creates no duplicate captures).
- **Reuse** `HighlightCard` as the Inbox renderer for Readwise captures (moved or exposed for `plugin-sensemaking` to consume).
- **Shrink** `ReadwiseContainer` to the connect / sync / status affordances.
- The shipped forward-compat data-model work (`Highlight.origin`, the canonical-URL referent key, removal of the reserved `processingState`) stays and supports this.

---

## 7. Non-goals / deferred (later rungs, not this increment)

- The **Pipeline** (to-do/question results flowing onto a board; work-with-AI per result). *(Note: when the Pipeline rung is designed, the concept doc's Pipeline section should be corrected to reuse `plugin-pipeline` / the View-backed `Pipeline` type, not a plain kanban.)*
- **AI-assisted triage** (the seeded chat + learning loop).
- **Additional sources** (Bluesky / notes / email) and their adapters + flag mechanics.
- **Learned merge-aliases** for referent clustering (conservative canonicalization only, already shipped).

---

## 8. Open decisions to confirm at plan time

- **`Result` type vs `Task` reuse** — proposed a new `Result` type; confirm or reuse `@dxos/types` `Task` (+ a kind for "question").
- **connect target types** — proposed default = Collection ("project"); confirm the target-type set (project · topic · other).
- **Naming stance pass** — working names (`Capture` · `Inbox` · `Result` · `Flag` · plugin name `sensemaking`) are provisional; a short stance exercise (à la plugin-bramble's naming) can run before/at plan time. The plugin name `plugin-sensemaking` is decided.
- **Flag scope for Readwise** — confirmed model: *all* synced highlights become captures (Readwise "everything you do there flows in"); revisit if a narrower flag (only annotated highlights) is wanted.

---

## 9. Acceptance (behavior-level)

```
given: a connected Readwise account with synced highlights
when: the user opens the Inbox
then: each synced highlight appears as a capture
and: captures are clustered by what they are about (their referent)
and: each capture is rendered in its source's native card
```

```
given: a capture in the Inbox
when: the user triages it into a to-do (or a question)
then: a result of that kind is created
and: the result is shown with a link back to its capture
```

```
given: a capture in the Inbox
when: the user connects it to a project
then: a connection relation is created between the capture and that project
and: no board item / actionable result is created for the connection
```

```
given: a connected Readwise account
when: sync runs again with no new remote activity
then: no duplicate captures are created
```

```
given: a connected Readwise account
when: the user opens its account view
then: only connect / sync / status affordances are shown
and: the reading + triage happens in the Inbox, not the account view
```
