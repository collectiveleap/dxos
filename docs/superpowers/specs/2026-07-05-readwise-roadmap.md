# Readwise in Composer — Roadmap & Shared Foundation

- **Date:** 2026-07-05
- **Status:** Draft for review
- **Supersedes:** `2026-07-04-readwise-annotation-triage-design.md` and its plan (which produced a correct-but-**unusable** internals-first result — see "Why we replanned").
- **Purpose:** the durable connective tissue every increment builds on — vision, shared data model, onboarding, the cross-increment principles, and the increment ladder. Each increment gets its **own** detailed design spec when it starts; this doc holds the arc and the shared foundation so no increment re-derives it, and so far-future increments are sketched (not over-specified).

> Type/API/precedent references are from a codebase snapshot during design; re-verify against `main` at implementation time.

---

## 1. Vision

Steve saves reading to Readwise — articles, PDFs, videos, books — and highlights passages, sometimes with a note. The end state: **his saved reading lives in Composer, browsable, and connectable to the work he's doing.** From a piece of work he sees relevant reading; from a highlight, its meaning (a question, a to-do, a comment) becomes actionable and traceable back to its source.

## 2. The standard this roadmap is built to (and the correction it encodes)

**Every increment must create user value on its own, and each subsequent increment adds more.** Internals, on their own, are not value.

The first attempt violated this: it built a correct internal pipeline (sync → capture → triage cards → Kanban → AI decompose → confirm) with **no usable end** — no way to connect an account, no way to trigger a sync, a board that rendered blank. This roadmap re-slices the work **vertically**: each rung is a thin, runnable, user-visible slice, and the shared foundation below is designed so later rungs slot in without rework.

## 3. What already exists (reuse vs. rework)

The first attempt is on this branch. Its **internals are largely sound and reused**; what was wrong was the *shell* (no onboarding, no entry points, no legible home). Disposition:

| Built | Disposition |
|---|---|
| REST client + injectable transport (EDGE CORS proxy), `readwise-api.ts` | **Reuse** — includes the live-caught `nextPageCursor` (number) fix. |
| Idempotent capture of documents → `Bookmark` | **Reuse** (documents/sources). |
| Idempotent capture of highlights → `Message` | **Rework** — highlights become a purpose-fit `Highlight` type (§4). |
| Cursor-based sync operation | **Reuse** (retarget onto the Connector framework). |
| Triage `Task` cards, tag-scoped `Kanban` board | **Defer** to Inc 2+ (triage), and rebuild the board correctly (pivot-with-options, §7). |
| AI decomposition → companion-chat suggestion | **Defer** to Inc 3. |
| Confirmation into typed results | **Defer** to Inc 2 (manual) / Inc 3 (AI). |

## 4. Shared data model (purpose-fit types — the convention, not the exception)

`plugin-inbox` is the governing precedent: a **`Mailbox`** container holds items and maps to an external source. We mirror it. **This supersedes the earlier "zero new ECHO types, discriminate by a tag" decision** — that fought the UX and produced illegible objects.

- **`Readwise` container** — a small anchor type (analog of `Mailbox`): what a user creates from "+ Add", connects, syncs into, and opens to browse. **Per-account** (a 2nd instance connects a 2nd account — §6).
- **`Bookmark`** (reused, `@dxos/plugin-bookmarks`) — a **source** (article / book / video / PDF): title, url, author, cover image, category. **First-class and independent of highlights** (a source may have zero highlights — §6).
- **`Highlight`** (new, small) — a **highlighted passage**: text, note, tags, `readwiseId`, `updated`, a ref to its source `Bookmark`, and **reserved (unimplemented) fields** for `processingState` and a forward-ref (§6).
- **Triage results** (Inc 2+) — comment / question / to-do. Questions/to-dos are `Task`s; comments are lightweight. Each carries a **traceability relation back to its `Highlight`** (§5).

Relations form a connected graph, not loose tagged objects:

```
result (to-do / question / comment)  ──▶  Highlight  ──▶  Bookmark (source)  ◀── Readwise (container)
```

## 5. Cross-increment principle: traceability

**A triage result always relates back to the `Highlight` it came from** (`result → highlight`). With `highlight → source`, this yields a full provenance chain **result → highlight → source document**.

- The **forward-link** on the highlight card (highlight → its results) and the **result's back-reference** are the *same relation from two sides* — designing the hook in Inc 1 and building the relation in Inc 2 are one commitment, no rework.
- **Inc 3+ consume this relation, never re-derive it:** AI triage creates results *with* it; working an item with AI pulls the highlight's passage + note + source *through* it; navigation works both directions.

## 6. Anticipated hooks (design conditions — reserved now, built later)

Each is a condition the foundation must not preclude; none is implemented before the increment that owns it.

| Hook | Design condition |
|---|---|
| **Multi-account** | The `Readwise` container is **per-account** (its own `Connection`/`AccessToken`/`SyncBinding`); a 2nd instance connects a 2nd account. Never a singleton. |
| **Sync criteria at connect** (last day / 14 days / …) | The pull window is a field on the `Connection`/binding (`updatedAfter`). Inc 1 ships a default; a picker is later UI over an existing field. |
| **Re-sync with wider criteria** (pull older & older) | Same field, re-settable. Only the "adjust & re-pull" UI is deferred. |
| **Articles with no highlights** | **Sources (`Bookmark`) are first-class, independent of highlights** — a source can have 0 highlights and still appear. Eventually pulled from **Reader** (`/api/v3`, read-later docs), not just the highlights export. |
| **Processing state** | A `processingState` (none / partial / complete) reserved on `Highlight`; the card renders a left-rail dot. |
| **Forward-link** | The `result → highlight` relation (§5), viewed from the highlight; the card renders a "→ where it's processed" affordance. |

## 7. Composer UX conventions we will follow (the precedents the first attempt skipped)

These are the concrete conventions whose absence caused the unusable result. Every increment adheres to them.

- **Onboarding via the Connector framework** (`plugin-connector`, exemplified by `plugin-inbox`/Gmail): a plugin contributes a **`Connector` entry** (the capability) declaring a **credential form** for manual token entry (our Readwise token), `materializeTarget` (creates the container), a `sync` op, and an `onTokenCreated` hook. The **connect UI is provided by the framework** (the `ConnectorAuth` surface), rendered in the container's **empty state** — the plugin does not hand-build connect UI. (`plugin-inbox/src/capabilities/connector.ts`; `plugin-connector` `ConnectorAuthButton`.)
- **Creatable objects**: register the container type via **`SpaceCapabilities.CreateObjectEntry` + `AppPlugin.addCreateObjectModule`** so it appears in the navtree **"+ Add"** menu; create via **`SpaceOperation.AddObject`** so it's routed into the navtree. (`plugin-kanban`/`plugin-table` create-object.ts.)
- **Actions & companions via `app-graph-builder`**: a plugin's primary actions (e.g. **Sync**) live on the space/root or object node via a graph-builder extension (`disposition: 'toolbar' | 'menu'`), and companion panels via `AppNode.makeCompanion`. The first attempt had **no** `app-graph-builder` capability — the single largest omission. (`plugin-sample`/`plugin-space` app-graph-builder.)
- **Surfaces**: the container renders via an **`Article`** surface; a highlight card renders via a **`CardContent`** surface; a true companion uses `AppSurface.companion(...)` + a `companionTo` guard (not a bare `Article` filter). (`app-surface.ts`; `plugin-assistant`/`plugin-space` react-surface.)
- **Kanban that renders** (for Inc 2+): a `Kanban` shows columns only when its **pivot field is a single-select field carrying `options`** (the enum values *are* the columns; the `arrangement` only orders them). Build the view via `ViewModel.makeFromDatabase({ typename, pivotFieldName })`, and the pivot field must have `options`. (`plugin-kanban` `useKanbanBoardModel`, `arrangement.ts`.)

## 8. The increment ladder

Each rung is usable on its own; each adds visible value. **Inc 1 is detailed here and in its own spec; Inc 2+ are sketched and get their own spec when they start.**

### Inc 1 — Ingest & browse *(detailed; see `2026-07-05-readwise-increment-1-design.md`)*
Create a `Readwise` from "+ Add" → connect an account (token) → **Sync** → browse your highlights **grouped by source, recency-sorted**.
**Value:** your Readwise reading is in Composer, browsable and openable.
**Reserves:** processing-state + forward-link on the card; multi-account; sync-criteria field.

### Inc 2 — Triage (manual, with traceability)
Open a highlight → split it into comment / question / to-do items → they become real objects, each **related back to the highlight** (§5); the **processing-state dot** and **forward-link** go live; a triage board (correctly rendered, §7) appears.
**Value:** highlights become an actionable list you can work.

### Inc 3 — AI-assisted triage
The AI proposes the split (using the highlight's passage + note + source); you confirm/edit. Results carry the traceability relation.
**Value:** triage becomes fast.

### Inc 4 — Work it with AI
A per-card companion chat, scoped to a highlight/result, to actually work a question or to-do and produce results in context (pulled *through* the traceability relation).
**Value:** you do the work, with AI, in context.

### Inc 5+ — Connect to your work (the original matching vision) & the reserved extras
Match reading to your projects/inquiries/interests; pull **Reader articles-without-highlights**; the **sync-criteria picker** and **re-sync**; multi-account polish; a "learn my triage criteria" pass over accumulated decisions.
**Value:** your reading is woven into your work.

## 9. Why we replanned (lessons that shaped this doc)

- **Define "done" as a user-completable journey, not object states.** Inc 1's acceptance test is "Steve connects and browses his highlights in the running app," not "N objects created."
- **Vertical slices, walking skeleton first.** Build the thin end-to-end path (including onboarding + an entry point) and run it in the real app early — not after all internals.
- **Ground UX in precedents before building.** The Connector framework, `CreateObjectEntry`, `app-graph-builder`, and Kanban-pivot-with-options are conventions, not options; skipping them is what made the first result "internals."
- **Purpose-fit types over reuse-everything.** Legibility and a natural UI beat a minimal type count.
