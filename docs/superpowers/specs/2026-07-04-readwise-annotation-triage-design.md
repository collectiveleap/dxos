# Readwise Annotation Triage — Design (Increment 1)

- **Date:** 2026-07-04
- **Status:** Draft for review
- **Scope of this doc:** Increment 1 only, with the broader arc sketched for context.

> Type/file references below are drawn from a codebase snapshot during design and
> must be re-verified against `main` at implementation time (line numbers drift).

---

## 1. Motivation — the user's workflow and the problem

Steve saves articles (web pages, PDFs, videos — anything Readwise supports) to
Readwise/Reader, and highlights passages, attaching notes. Two problems recur:

1. **Saved artifacts drift away from the work they're relevant to.** An article
   saved today is usually relevant to some research inquiry, project, or interest —
   but nothing connects them, so the relevance is lost by the time he returns.
2. **Notes on highlights carry latent intent that never gets actioned.** A note
   may pose a question (sometimes with candidate answers), state a to-do ("write a
   post on this"), or just be a comment worth keeping as context — but there is no
   lifecycle that turns that intent into tracked, workable items.

Today the "work" these should connect to is scattered: Tana supertags (formal
research inquiries and some projects), GitHub repo docs (some projects), Apple
Notes and loose notes (informal projects and interests). Composer cannot yet
formally represent research/projects — but the intent is for that work to migrate
into Composer over time.

## 2. Vision and increment boundaries

The full arc: *every saved artifact and every annotation gets matched to the work
it's relevant to; the system suggests connections, Steve reviews/revises/approves,
and the system learns his criteria over time.* Both directions pay off — from the
work you see relevant artifacts; from an artifact, new activity is interpreted in
the work's context.

This is decomposed into increments, each **useful on its own** and each producing
**results useful to later increments without depending on them**:

- **Increment 1 (this doc) — Annotation triage.** Pull annotations into Composer,
  decompose each into confirmed intent-items, land them as first-class objects on
  a human-gated board, and persist the triage decisions. No connection to scattered
  external work; everything lands in Composer, carrying enough context to support
  (a) Steve's *in-head* manual binding as he reads, and (b) *future formal* binding
  once work lives in Composer.
- **Increment 2+ (future) — Work the items.** A separate work board whose cards are
  the actionable results (Questions/ToDos), with an AI-assisted lifecycle; formal
  Work objects in Composer and binding of results to them; a learner that improves
  suggestions from the persisted decisions.

**Explicitly out of scope for all early increments:** reaching into or syncing with
Tana, GitHub, or Apple Notes. The direction is migration *into* Composer; we set
conditions now, we do not build external bridges.

## 3. Why not the Readwise MCP (transport decision)

The connected Readwise **MCP** endpoint cannot be used from Composer:

1. **No CORS.** `https://mcp2.readwise.io/mcp` returns no `Access-Control-Allow-Origin`
   and its `OPTIONS` preflight returns `405`. Composer runs in a browser (Safari),
   which blocks the cross-origin request before it is sent ("Load failed").
2. **OAuth-only auth.** Probed server-side, the endpoint returns `401` with
   `WWW-Authenticate: Bearer … resource_metadata=…/oauth-protected-resource/mcp` — it
   requires the full OAuth flow (dynamic client registration + token issuance).
   DXOS's `McpToolkit` only sends a static `Authorization: Bearer <key>` and
   implements no OAuth flow, so it cannot authenticate even server-side.

**Decision:** use the **Readwise REST API** instead —
`readwise.io/api/v2` (highlights export/list) and `/api/v3` (Reader) — which
authenticates with a static token header (`Authorization: Token <token>`, no OAuth) —
routed through DXOS's **EDGE CORS proxy** to bypass the browser CORS wall. See §7.

## 4. Entity model

Design principle (hard constraint): **do not modify shared `@dxos` types.** Reuse
`Task`, `Message`, `Bookmark`, `Tag`, `AnchoredTo`, `Cursor`, `Connection`,
`AccessToken`, `Kanban`, `Chat` as-is; compose via relations and tags. **This design
introduces no new ECHO types** — even the AI's triage suggestion reuses `Message` (§4.3).

### 4.1 Layers and types

| Layer | Concept | Type | Notes |
|---|---|---|---|
| Capture | Source document (article/PDF/video) | `Bookmark` (`plugin-bookmarks`) | title, url, excerpt, image, favicon = provenance; one per Readwise document |
| Capture | Annotation (a highlight *or* a document note) | `Message` (`@dxos/types`) | `blocks` = highlighted passage + Steve's note; `properties` = `readwiseId`, `location`, `color`, source `tags`; `AnchoredTo` → its `Bookmark`; **kept pristine as the source-of-record mirror** |
| Triage | Triage card (one per annotation) | `Task` (`@dxos/types`) | the board citizen with a Done-state; discriminator `Tag` (e.g. `readwise/triage`); `AnchoredTo` → the annotation `Message`; companion `Chat` for AI-augmented review; **not** tagged with any single intent |
| Triage | Persisted suggestion + resolution | **first `Message` in the card's companion `Chat`** | the AI's proposed decomposition (human-readable text + structured `properties.suggestedItems`); Steve's review/edits continue in the same Chat; the "lightly persist" store and the learning-signal dataset (see §4.3) — **no new type** |
| Result | Comment | `Message` + `Tag` `comment` | passage + note; `AnchoredTo` → document; future-work hook |
| Result | Question | `Task` + `Tag` `Question` | passage + note; `Task.project` = future-work hook |
| Result | ToDo | `Task` + `Tag` `ToDo` | passage + note; `Task.project` = future-work hook |
| Result | *(future kinds)* | *whatever fits* | the result-kind → representation mapping is itself an extensible registry |

**Link topology (per the user's requirement):** `result → triage card → annotation → document`.
Results *also* carry their own link to the document and their own future-work hook, so
they are **portable into later increments without depending on the triage card**.

### 4.2 Intent taxonomy is data, not code

The result-kind set (`comment`, `Question`, `ToDo`, …) is **open-ended** and expected
to drift. It is modeled as `Tag`s (stored in `Obj.getMeta(obj).tags`), so adding or
renaming a kind is data, not a schema change. A small in-code **registry** maps each
kind to its representation (`comment → Message`, `Question → Task`, `ToDo → Task`);
new kinds extend the registry.

A single annotation may yield **0+ items across multiple kinds and multiple instances**
(e.g. two Questions + one Comment). This is why intent lives on each *result*, never on
the triage card.

### 4.3 The suggestion as the card's first companion message (no new type)

Per-triage, the AI proposes a decomposition; Steve (augmented by the card's companion
AI) confirms, edits, adds, or rejects each proposed item. Rather than a dedicated type,
the AI's proposal is **the first `Message` in the triage card's companion `Chat`**
(`Chat.CompanionTo` binds a `Chat` to any ECHO object — here, the card). That message is
human-readable *and* carries the structured proposal in `Message.properties`:

- `properties.suggestedItems`: `[{ suggestedKind, text, note }]`
- as items are resolved, `properties.resolution`: per item `accepted | edited(finalKind) |
  rejected`, plus the created result's ref.

This **lightly persists** both proposal and resolution (a clean single-axis labeled
dataset: features = passage/note, label = confirmed kind) with **zero new types**, and
the same companion Chat doubles as the ad-hoc co-work surface (Q3). Steve's review/edits
happen as further messages in the same Chat.

*Carrier considered and rejected:* Composer's **comments** feature (`Thread` +
`AnchoredTo`) is wired to markdown **text ranges** (CodeMirror), so a card-level
(rangeless) comment thread would need extra work; and its resolution lifecycle is
unnecessary because the card's Done state comes from the **Kanban column move**, not
thread resolution. The companion `Chat` binds to arbitrary objects by design, so it is
the better-supported carrier.

## 5. The triage process

1. **Receive an annotation** — sync (§7) upserts the source `Message` (and its
   `Bookmark`) and creates a triage `Task` card in the **Needs Review** column.
2. **Persist pre-confirmation suggestions** — an AI step proposes a decomposition into
   candidate items, written as the **first `Message` in the card's companion `Chat`**
   (structured in `properties.suggestedItems`).
3. **Steve + AI review & confirm** — in that same companion `Chat` (scoped to the card,
   so context = the annotation + suggestions), Steve confirms / edits / rejects / adds
   items. Each confirmed item materializes as a result (Comment `Message`, or
   Question/ToDo `Task`) with its intent `Tag`, populated with the passage + note,
   linked to the document and to the card. The resolution is recorded in
   `properties.resolution`.
4. **Triage done** — the card moves to **Done**; its results are confirmed, tagged, and
   linked — "available to use." Actually *working* the Question/ToDo results is
   Increment 2.

## 6. Workflow board

- **Board type:** `Kanban` (`plugin-kanban`), rendered via the shared
  `Board.Root` (`@dxos/react-ui-mosaic`).
- **Membership / subsetting:** Composer carves purpose-specific subsets of the shared
  object pool by *querying* it — not by moving objects into buckets. The triage board
  is a **view-variant Kanban** backed by a `View` whose query filters `Task` by the
  discriminator tag: `Query.select(Filter.type(Task)).select(Filter.tag('readwise/triage'))`.
  Other Tasks in the space never leak in. (The static alternative — an items-variant
  Kanban owning an explicit ref list, "used by externally-synced kanbans" — is a
  fallback if we want sync to own membership directly.)
- **Columns / lifecycle (human-gated):** every card move is Steve's action. A Kanban
  view-variant pivots on a field (`pivotField`). Because `Task.status` is fixed to
  `todo | in-progress | done` and cannot be extended (shared type), Increment 1 maps
  the triage lifecycle onto it: **Needs Review (`todo`) → In Triage (`in-progress`) →
  Done (`done`)**. "Rejected/Parked" are represented by a tag or archive, not a fourth
  status column. (See §9 for the tradeoff.)
- **Per-card AI:** binding an assistant chat to a card is a first-class primitive — the
  `Chat.CompanionTo` relation links a `Chat` to any ECHO object, and the `assistant-chat`
  companion surface renders a sidebar chat scoped to the focused object
  (`EnsureCompanionChat` finds/creates it). This same companion `Chat` carries the AI's
  triage suggestion as its first message (§4.3), so one surface serves both the
  suggestion/review and ad-hoc co-work. Increment 1 **wires this binding only** so Steve
  can have ad-hoc AI conversations with the card as context; bespoke "work this Question"
  skills are Increment 2. AI-produced objects link back via refs/relations.

## 7. Sync / transport architecture

**Pattern to copy:** `plugin-bluesky` (authenticated HTTP to an external REST API,
CORS-safe) + `plugin-linear` (Cursor-based idempotent sync operation) +
`plugin-connector` (`Connection` / `AccessToken` / `SyncBinding`).

- **Credentials:** the Readwise token is stored as an ECHO `AccessToken`
  (`source: 'readwise.io'`, `token: <token>`), referenced by a `Connection`. A
  credentials service (Effect `Context.Tag`, copy `BlueskyApi` credentials) loads it and
  threads it into requests. The token stays in ECHO's encryption boundary until the
  request is made.
- **CORS bypass (no deploy required):** in the browser, requests go through the DXOS
  **EDGE CORS proxy** — a **shared, already-hosted open proxy**
  (`https://cors-proxy.dxos.workers.dev`, `cors-proxy.ts:9`) that the client simply calls
  via `proxyFetchLegacy(new URL('https://readwise.io/api/...'))`, remapping
  `Authorization` → `X-Cors-Proxy-Authorization`. **Nothing is deployed to use it.** (If
  Readwise's REST API turns out to send permissive CORS headers, a direct fetch is
  possible — but default to the proxy, as `plugin-ibkr` does.)
- **Injectable transport:** the HTTP transport is an Effect dependency — a fetch strategy
  of `direct | vite-proxy | edge-proxy` — defaulting to the EDGE proxy in the production
  browser but overridable, so unit tests, Node integration, and local dev never touch
  production EDGE (§7.1). This is a first-class design requirement, not an afterthought.
- **Idempotent sync:** a `Cursor` object (`value`, `lastRunAt`, `lastError`) stored on a
  `SyncBinding` tracks the high-water mark (Readwise `updated_gt` / last highlight id).
  Each run reads `cursor.value`, fetches highlights updated since, **upserts** annotation
  `Message`s + triage `Task` cards keyed by `readwiseId` (re-sync updates, never
  duplicates), and calls `Cursor.advance` on success.
- **Runtime-agnostic:** the sync is an Effect-based `Operation`. **Increment 1 runs it
  in-browser, on demand** (a "Sync" operation Steve triggers) — this needs **no EDGE
  deploy access**. Running the same operation on a scheduled EDGE Function is optional and
  **deferred** (it is the only path that would need deploy access).

### 7.1 Running and testing without production EDGE

None of these require EDGE deploy access or the production proxy:

1. **Unit tests (primary):** provide a mock `HttpClient` Effect layer returning canned
   Readwise JSON. No network, no proxy, no EDGE. Covers cursor idempotency, `readwiseId`
   upsert/dedup, and the decomposition step purely offline (repo norm: no network in tests).
2. **Local integration against real Readwise, no CORS:** run the sync `Operation` in
   **Node** (a script or e2e test). CORS is a browser-only restriction, so Node fetches
   `readwise.io` **directly** with the real token — no proxy — proving the live API shape.
3. **Local browser dev:** a **Vite dev-server proxy** (`server.proxy`) forwarding
   `/readwise/*` → `https://readwise.io`, so the browser calls same-origin and Vite
   proxies server-side. No production EDGE involved.

The injectable transport (above) is what makes all three possible from one codebase.

## 8. Increment 1 scope

**In:**
- A new `plugin-readwise` package (`"private": true`).
- REST sync (highlights + document notes) run **in-browser on demand** via the shared
  EDGE CORS proxy (no deploy) + `AccessToken` + `Cursor`, idempotent and keyed by
  `readwiseId`; **injectable transport** for offline/Node/dev testing (§7.1).
- Capture: `Bookmark` per document, `Message` per annotation, `AnchoredTo` links.
- AI decomposition step → suggestion persisted as the card's **first companion-Chat
  message** (structured in `properties`).
- Human-gated triage `Kanban` (view-variant, tag-scoped, 3 status columns).
- Confirmation flow producing heterogeneous results (Comment/Question/ToDo) with intent
  `Tag`s, text+note, document link, and the unbound future-work hook.
- Companion AI chat wired to triage cards (carries the suggestion + ad-hoc co-work).

**Conditions set for later (not built now):**
- `Task.project` future-work hook left unbound.
- Intent taxonomy as `Tag`s + a result-kind registry (extensible).
- Triage decisions persisted in the companion-Chat message `properties` as the learning
  dataset.
- Full source provenance retained on every result.

**Out:**
- Tana / GitHub / Apple Notes bridges; formal Work objects.
- Working the Question/ToDo results (their own lifecycle) — Increment 2.
- The learner itself — Increment 2+.
- Two-way write-back to Readwise.
- Scheduled/background sync as an EDGE Function (needs deploy access) — deferred;
  Increment 1 syncs on demand in-browser.

## 9. Decisions and risks

**Resolved (reviewed):**

1. **No new type for the suggestion.** The AI's proposal is the first `Message` in the
   card's companion `Chat`, with structured data in `properties` (§4.3). `TriageSuggestion`
   dropped — zero new ECHO types.
2. **3-column triage board via `Task.status`.** `Needs Review (todo) → In Triage
   (in-progress) → Done (done)`; Rejected/Parked as tags. Accepts that `Task` gains no
   custom status field.
3. **Object count per annotation accepted.** Bookmark (shared) + annotation Message +
   triage Task + N results (one fewer than before, now that the suggestion has no
   dedicated object).
4. **Document notes treated the same as highlights.** The Reader document-level note is
   triaged identically to a highlight.
5. **No EDGE deploy dependency.** Sync runs in-browser via the shared hosted CORS proxy;
   transport is injectable for testing (§7, §7.1).

**To verify during implementation:**

- **Readwise REST CORS behavior** — confirm against the live API whether the proxy is
  required (assume yes; low risk — the proxy always works, and Node/tests bypass CORS
  entirely).
- **Readwise REST endpoints & shapes** — confirm the v2 highlights export/list and v3
  Reader endpoints, the `Token` auth header, pagination, and the `updated_gt`/cursor
  parameter for incremental pulls.
- **Companion-Chat first-message wiring** — confirm `EnsureCompanionChat` +
  `Chat.CompanionTo` allow seeding a first message with custom `properties` on a
  `Task`-typed companion object.

## 10. Testing and success criteria

**Approach (per repo BDD/TDD norms):** the plugin lands with a smoke test modeled on
`plugin-chess`'s `createComposerTestApp` harness (schema-module activation), and each
feature lands with ≥1 test mapping onto a spec block below. Sync logic (cursor
idempotency, `readwiseId` upsert/dedup) is unit-tested against a mocked Readwise
response; avoid network in tests.

**Acceptance criteria (user-behavior altitude):**

- Given a Readwise account with highlights, when sync runs, then each highlight appears
  once as a triage card in **Needs Review**, carrying its passage, note, and a link to
  its source document — and re-running sync creates no duplicates.
- Given a triage card, when Steve opens it, then the AI has proposed a decomposition
  into candidate items, and Steve can confirm, edit, add, or reject each.
- Given a confirmed decomposition, when Steve finishes, then each item exists as the
  correct kind of object (Comment / Question / ToDo), tagged with its intent, populated
  with the passage + note, linked to the document, and the card is in **Done**.
- Given a triage card, when Steve opens the companion assistant, then he can hold an
  ad-hoc AI conversation scoped to that card.
- Given a completed triage, when inspected later, then the original suggestion and
  Steve's resolution are recoverable (the learning signal persisted).

## 11. Future increments (context only)

- **Increment 2 — Work board:** promote Question/ToDo results onto a work `Kanban` with
  an AI-assisted lifecycle (Backlog → Working-with-AI → Done); AI produces results
  attached to the card.
- **Increment 3 — Work binding:** formal Work objects (research inquiries / projects /
  interests) in Composer; bind results via `Task.project` (and analogues); suggested
  matches Steve reviews.
- **Increment 4 — Learner:** feed the persisted suggestion/resolution records (the
  companion-Chat message `properties`) back as few-shot examples or a small classifier so
  suggestions improve over time.
