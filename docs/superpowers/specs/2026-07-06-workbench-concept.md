# Workbench — a horizontal sensemaking layer (design capture)

- **Date:** 2026-07-06
- **Status:** Brainstorm captured — NOT yet a spec or plan. This is durable scaffolding to resume the design cold.
- **Relation to shipped work:** plugin-readwise **Increment 1** (connect → sync → browse) is shipped and proven live. This doc reframes the *later* increments (triage / AI / work / connect) from "Readwise features" into a **horizontal Composer capability** that Readwise merely feeds. Inc-1 is not thrown away — it turns out to be the first slice of this (see §8).
- **Mockup (interactive, current model):** https://claude.ai/code/artifact/a6dc2447-7b07-4303-9543-4aaf9ca67490 (source: `scratchpad/workbench-mockup.html`). This is the **sole** design reference for the later increments.
- **Supersedes (conceptually):** the earlier Readwise-only roadmap's Inc-2..5 sketches (partitioned to git history). Those framed the triage/AI/work/connect value as Readwise-owned; the mechanism is now horizontal.

---

## 1. The pivot (why this exists)

The Readwise roadmap put triage → AI → work → connect *inside* plugin-readwise. The question that broke that frame: **what if the source for triaging, working, and connecting isn't just Readwise annotations — but also stray notes, Bluesky posts, emails, and anything else in Composer?**

Answer: the value was never the *source* — it's the **processing discipline**, which is source-agnostic. This is the commonplace-book / GTD-inbox pattern: one inbox mixing clippings, correspondence, and thoughts, and a ritual that turns raw captures into actions and connections regardless of origin.

So: a **horizontal Workbench**. Readwise shrinks to a pure ingest *connector*; the value-creating layers (triage, AI, work, connect) become a shared Composer surface that *any* source feeds. This is also more DXOS-native (everything is one ECHO graph) and, per the research, cheaper than five siloed pipelines (the `CardContent` fan-out, the generic assistant companion, and generic relations are already there).

---

## 2. The spine (the crystallized model)

### 2.1 Capture — the unit (copy-on-write envelope)
A **Capture** is the uniform thing the whole pipeline operates on. It is an **envelope** that *starts as pure pass-through*: it holds only a `source` ref (the ECHO object it wraps — a Highlight, a Bluesky post, an email, a note) + workbench state (flagged-when, processing-state, results, project). Every content field is **optional and resident only on demand** — a field materializes on the envelope *only* when the source can't supply it, or when the user edits it. Decided per-field, per-source, **lazily** (copy-on-write). A Capture with no source *is* a bare thought.

- **Why an envelope, not a tag on the source:** connector-owned objects (a Readwise highlight, a synced skeet) must **not** be mutated — a re-sync would clobber a tag, and you may not own that write (same reason plugin-inbox feeds are append-only). The flag/annotations layer floats *beside* the source. Mental model: **your markers + results float over a substrate of source objects you don't own.**
- **Deferral mechanism — per-source adapters:** a small registered capability projects "this source type → the common shape." Add one adapter per source *as you learn it*; the Capture type never changes. This is the exact shape of the `CardContent` fan-out and the plugin-inbox extractor registry — idiomatic, not novel.

### 2.2 The common shape (what every adapter fills)
Answerable from the *pipeline*, not the sources (so not knowing a source doesn't block it):
`body` (the text to read/triage/feed-AI) · `origin` · `referent(s)` · `captured-at` · `note` · `tags`.
Notably `Highlight` (shipped) already **is** this shape, so Readwise is the first adapter almost for free.

### 2.3 Two link roles — origin vs referent
- **Origin** — where the fragment lives / where you met it (the Readwise reader view, the Bluesky post permalink). Usually one.
- **Referent(s)** — what it's *about*: the original article, whatever the skeet links/quotes. **0..n.**

| Source | Origin | Referent(s) |
|---|---|---|
| Readwise | Readwise reader URL | original article |
| Bluesky | post permalink | linked article(s) / quoted post(s) |
| Email | the message | links in the body |
| Note | the note in Composer | whatever it cites |

**Model note:** our shipped `Highlight.source → Bookmark{title,url}` *is* the referent; we're only missing the **origin** (the Readwise reader URL) — a one-field add. UX: a card gets two "opens" — *See in Readwise* vs *Read the original*.

### 2.4 Referents are first-class and normalized — the join key (clustering)
A referent is **its own object**, deduped by canonical identity, so captures from different sources that point at the **same** thing cluster together automatically: *"everything I've captured about this, across Readwise + Bluesky + notes + mail."* That emergent clustering **is** half of connect-to-work.

- **Referent is a *role*, not a type** (per Steve's "shape-match isn't enough, the semantic must match" rule): a web article materializes as a reused `Bookmark`; a quoted skeet resolves to *that post's* object; a book/PDF/video is something else. So `Capture --references--> <any canonical object>`; Bookmark is just the default materialization for a bare URL.
- **Identity is a URL-normalization problem, handled CONSERVATIVELY (decided):**
  - Canonicalization is an **allowlist**, not a denylist: normalize scheme/host/case/trailing-slash; strip only *known-safe* params (`utm_*`, `fbclid`, `gclid`, `ref`…), **never** an unknown param (`?id=123` can be load-bearing). No shortener-following, no fuzzy titles. Two URLs cluster only if identical after that. **Never corrupt** = the guarantee; the cost is missed clusters, which are visible.
  - **Learned aliases (the "adjust over time"):** a manual **merge** writes a persistent alias ("this URL ≡ that referent"); the resolver checks aliases *before* upserting, so future captures of either URL auto-land in the right cluster. Manual merges **compound into automatic resolution** — the canonicalizer starts dumb and slowly *learns your web*. Reversible: split re-separates + drops the alias. (This is the roadmap's "learn my criteria over time" hook, pointed at identity.)
  - **Parked (safe-eager) option:** following an *actual* 301 from `t.co`/`bit.ly` (via the EDGE proxy) is deterministic, not a guess — could later join "conservative" without wrong-merge risk. Bluesky is shortener-heavy, so remember it.

### 2.5 Flagging — the gate into the Workbench
A flag has **two origins, one meaning**:
- **External signal**, translated by the connector: highlighting in Readwise *is* the flag (everything you do there flows in); a Bluesky bookmark is a flag.
- **In-Composer flag**: you flag any object (a note, a synced skeet) directly.
The Workbench = **everything flagged, whatever its type.** (Structurally the flag is part of the Capture envelope — see §2.1 — because you can't reliably write onto connector-owned sources.)

### 2.6 The action model — actions × scope
A Capture has an **action set**, and each action has a **scope**:

| Action | Scopes | Notes |
|---|---|---|
| **Triage — manual** (`＋ result`) | one capture | you author results by hand |
| **Triage — AI** (`✦ AI triage`) | **one capture only** | a *chat* seeded by a proposal (§2.7). **There is NO "triage all"** — you can't chat-triage everything at once. |
| **Work** (`✦ work`) | one **result** (primarily), also a capture | happens on the **Pipeline**, not the Inbox (§3) |
| **Connect** | — | **NOT a standalone action or stage** — it's a **result type** (§2.8) |

Grounding for the one/all duality that *does* exist (manual triage, batch ops): plugin-inbox's `ExtractMessage` (per-item) vs `ExtractMailbox` (feed-wide), and Composer's `disposition` (card vs toolbar).

### 2.7 Two AI chats (the key UX insight)
The companion chat is one primitive attached at two levels with two purposes:
- **Capture-level = the AI-triage chat.** Opens *seeded* with AI's proposed split; you converse to **revise/approve**; approving **creates the results**; and **your edits become learning material** for future initial proposals (a learning loop — new territory, no existing precedent). This replaces the static Accept/Edit/Reject panel — triage is a conversation, not a button widget.
- **Result-level = the work chat.** One chat per action-result, where that result's work gets done ("draft this post," "answer this question"). Working a result **pulls its source Capture + referent (and cluster-mates) in through the traceability relation** — the payoff of first-class relations.

### 2.8 Result types — to-do · question · connect
Triage produces **results**, each with a **traceability relation back to its Capture** (`result → capture → referent`). Types:
- **To-do** — an action → goes to the Pipeline.
- **Question** — an action (needs answering) → goes to the Pipeline.
- **Connect-to-[project/topic/…]** — a *relation*. **This replaces "comment."** A non-actionable observation is really "this belongs with X," so it's a connection, not a note. Connections are **relations, not board work** — they don't appear on the Pipeline.

---

## 3. Two surfaces

- **Inbox** — flagged captures, **clustered by referent**, rendered natively per source (a Highlight card, a skeet, an email, a bare note — via `CardContent` fan-out). Here you **triage** captures into results.
- **Pipeline** — the **action-results** (to-dos + questions), pulled off the Inbox onto a **kanban** (this-first-design: **To work → Working → Done**), where the sensemaking/work happens (each result → a work chat). This is the "general sensemaking pipeline."

The flow, one line: **flag → Inbox (cluster) → triage (by hand / AI chat) → results → action-results flow to the Pipeline → work with AI.**

---

## 4. Decisions log (what's settled, with reasoning)

1. **Horizontal, not Readwise-owned.** The pipeline is a shared capability; sources are feeders. *Why:* value = processing discipline (source-agnostic); DXOS one-graph thesis; cheaper (reuse). *Alt rejected:* Readwise owns it (siloed; every connector reimplements).
2. **Flag by user action; two origins, one flag.** *Why:* Steve flags everything (Readwise: all activity; Bluesky: external bookmark or in-Composer; notes: in-Composer).
3. **Capture = copy-on-write envelope + per-source adapters.** *Why:* don't mutate connector-owned sources; defer source knowledge; one uniform pipeline unit; absorbs bare thoughts. *Alt considered:* tag-on-source (rejected — mutation), relation-only (F2, viable if no per-flag metadata).
4. **Referents first-class + normalized; cluster by referent.** *Why:* makes it a graph not a list; emergent cross-source clustering = half of connect-to-work; generalizes shipped `Highlight.source→Bookmark`.
5. **Conservative URL identity + learned aliases.** *Why:* never corrupt (wrong-merge is silent/corrupting; missed cluster is visible); manual merges compound into auto-resolution.
6. **Actions × scope; connect is a result type, not a stage; AI triage is per-capture only; work happens on the Pipeline.**
7. **AI triage = a seeded chat with a learning loop; work = a per-result chat pulling context through traceability.**
8. **Two surfaces: Inbox + Pipeline (3-stage: To work/Working/Done for now).**

---

## 5. Open forks (not yet decided)

- **Naming.** Working names: **Capture** (unit) · **Workbench**/**Inbox** (surface) · **Referent** · **Pipeline** · result types **to-do / question / connect**. Naming is its own stance exercise (à la plugin-bramble's three-stance naming).
- **Plugin ownership / boundary.** Is there a new horizontal `plugin-workbench` (or -inbox / -desk / -sensemaking) that owns Flag + Capture + the surfaces, with Readwise/Bluesky/inbox/notes as feeders? What exactly does Readwise shrink to (ingest + adapter only)?
- **Per-source flag mechanics.** Exactly how each connector translates its "I acted on this" signal into a flag (Readwise: all highlights? only annotated? Bluesky: which action = a flag?).
- **Sensemaking-pipeline stages.** Kept as To work / Working / Done for the first design; may become named sensemaking stages later.
- **Does a flag pick a destination?** Earlier leaning: one Inbox, but flagging can *also* drop a Capture straight into a project (collapsing flag + connect). Left as a toolbar affordance in the mockup; not locked.
- **Connect target types.** Project · topic · "something else" — what's the set, and is "topic" a first-class object?

---

## 6. Grounding precedents (from the plugin research)

- **Inbox/toolbar/AI:** plugin-inbox — a self-rendered `Menu.Toolbar` (not graph-`disposition:'toolbar'`, which only renders if the Article opts in); the **extractor menu** (`group('extract',{variant:'dropdownMenu'})` over registered `ObjectExtractor` capabilities, each dispatching an op) is the AI-action template; `ExtractMessage` vs `ExtractMailbox` = one/all scope; the `Initialize`/`InitializeAction` + `Callout`(`Message valence='warning'`) empty-state.
- **Companion chat (work + triage chats):** plugin-assistant — `EnsureCompanionChat` op + `companionChat` surface + `CompanionChatCache`; object bound as a **DXN/typename stub**, content fetched by the model via tools (not inlined). `LanguageModel.generateObject({schema})` + `AiService.model(...)` is the structured-output op template. **No existing "confirm-before-persist" precedent** — the triage-chat learning loop + confirm is new territory (closest idiom: persist-as-draft then gate the irreversible step).
- **Browse/cluster + board:** plugin-space `CollectionArticle`/`RelatedArticle` + `CardContent` fan-out (heterogeneous cards for free); plugin-kanban board (columns from a pivot single-select field's `options`, via `ViewModel.makeFromDatabase`) — the Pipeline board precedent; **no shared table↔kanban view-switcher** (each layout is its own wrapper object).
- **Navtree structure:** `AppNode.makeGroup` (dense header; groups are a closed enum in `app-toolkit/Paths.ts` — a new "Reading/Workbench" group edits a shared file → needs approval; else nest under the space) + `AppNode.makeSection` + a graph-builder listing connector (plugin-inbox Mailboxes is the exemplar for section → per-instance nested children).

---

## 7. Relation to plugin-readwise (shipped) and the roadmap

- **Inc-1 was the first slice.** "Browse highlights grouped by source" = "cluster captures by referent" with a single source type. `Highlight.source→Bookmark` → `Capture --references--> Referent`; `buildSourceGroups` → `clusterByReferent`; upsert-Bookmark-by-foreign-key → upsert-referent-by-canonical-URL. Nothing shipped is wasted.
- **What changes for "Inc 2+":** they become *Workbench* increments, not Readwise ones. Readwise contributes: sync (done), a **Highlight adapter** to the common shape, an **origin** field (Readwise reader URL), and its flag-translation (highlighting = flag). The triage/AI/work/connect layers live in the horizontal plugin.
- **Do NOT let this block landing Inc-1.** Inc-1 ships as a Readwise browse plugin; the Workbench is the *next* design cycle (its own spec → plan when it starts).

---

## 8. How to resume

Next design step is **not** to implement — it's to (a) pick the **plugin-ownership** boundary (§5), (b) run the **naming** stance exercise, then (c) write a proper spec for the first Workbench increment (likely: Inbox + manual triage into to-do/question/connect with traceability, over ≥2 sources), and only then a plan. Keep the mockup (§intro) as the shared reference.
