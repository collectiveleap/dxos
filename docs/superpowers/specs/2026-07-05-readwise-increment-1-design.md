# Readwise — Increment 1: Ingest & Browse (design)

- **Date:** 2026-07-05
- **Status:** Draft for review
- **Roadmap:** `2026-07-05-readwise-roadmap.md` (shared foundation, data model, conventions, ladder). Read it first.
- **One-line value:** *Connect a Readwise account and your highlights are in Composer — browsable, grouped by source, openable.*

> References are from a design-time snapshot; re-verify against `main` at build time. Acceptance criteria are written at **user-observable altitude** on purpose.

---

## 1. The user journey (the walking slice)

This is the definition of done — a journey a person completes in the running app, not a set of objects.

1. **Create.** Steve clicks **"+ Add"** in a space and picks **"Readwise"** from the create menu. A `Readwise` object is created and opens.
2. **Connect.** The open `Readwise` is empty, so it shows a **"Connect Readwise"** affordance (the framework's connect UI in an empty state). He clicks it and **enters his Readwise API token** (a simple credential form — no OAuth).
3. **Sync.** On connect, the **first sync runs** (and a **"Sync"** action is available in the toolbar for re-syncs). A default window is used (e.g. recent highlights).
4. **Browse.** The `Readwise` now shows his **highlights grouped by source, most-recently-active source first**. Each card shows the passage, the source (with a link), his note if present, and tags. Opening a card shows the full passage + note + source link.
5. **Re-sync.** Clicking **Sync** again pulls new/changed highlights; a source that gains a highlight **jumps to the top**; nothing duplicates.

## 2. Acceptance criteria (user-observable)

- **Creatable:** given a space, when Steve opens "+ Add", then **"Readwise" is offered**; creating one opens it.
- **Empty-state connect:** given a `Readwise` with no connection, when opened, then it shows a **"Connect Readwise" affordance** (not a blank pane).
- **Token connect:** given Steve enters a **valid Readwise token**, when he connects, then a connection is established **without OAuth** and the **first sync begins**.
- **Grouped, recency-sorted browse:** given a connected `Readwise` with highlights, when sync completes, then his highlights appear **grouped under their source document, with the most-recently-active source first**, each card showing **passage + source (linked) + note (only if present) + tags**.
- **Recency bump:** given a re-sync in which an existing source gains a new highlight, then that **source moves to the top** of the list.
- **Idempotent:** given sync runs twice, then **no duplicate** highlights or sources appear.
- **Openable highlight:** given a highlight card, when opened, then the **full passage + note + a link to the source document**.
- **Reserved (inert) hooks visible:** each card renders — non-functional — the **processing-state dot** and a **"→ where it's processed" forward affordance**, so Inc 2 fills them without redesign.
- **Green in the app:** the plugin loads in composer-app with no console errors; `build` + `test` + `lint` all pass.

## 3. Scope

**In:**
- `Readwise` container type + **creatable** from "+ Add" (`CreateObjectEntry`).
- A **`Connector` entry** for Readwise: a **credential form** (token entry, no OAuth), `materializeTarget` (yields the `Readwise` container), a `sync` op, `onTokenCreated`.
- The **empty-state connect** UI in the container's `Article` surface (framework `ConnectorAuth`), mirroring `plugin-inbox`'s `InitializeMailbox`.
- **Sync** (reuse the transport; rework capture to create `Bookmark` sources + `Highlight`s; idempotent; default window via cursor).
- **Browse view:** the `Readwise` `Article` surface renders highlights **grouped by source, recency-sorted**; a `CardContent` surface renders a highlight card; a highlight opens to a detail.
- **Sync toolbar action** via **`app-graph-builder`** (always reachable — not trapped in a view).
- Reserved-but-inert: `processingState` + forward-ref fields on `Highlight`; the card's state-dot + forward affordance rendered inert.

**Reserved (fields/structure present, no behavior):** multi-account (works structurally — per-account container), sync-criteria field (default only).

**Out (later increments):** triage/split into items (Inc 2), AI (Inc 3), work-with-AI (Inc 4), Reader articles-without-highlights, the sync-criteria picker + adjustable re-sync UI, connect-to-work.

## 4. Design

### 4.1 Types (see roadmap §4)
- **`Readwise`** (new, small) — the per-account container / sync target. Minimal (name; it anchors the connection + holds highlights via query).
- **`Highlight`** (new, small) — `text`, `note`, `tags`, `readwiseId`, `updated`, `source: Ref<Bookmark>`, and **reserved** `processingState?` + a forward-ref (unused in Inc 1).
- **`Bookmark`** (reused, `@dxos/plugin-bookmarks`) — the source document; **first-class, may have 0 highlights** (roadmap §6).

### 4.2 Onboarding (grounded in `plugin-inbox`/Gmail; token path mirrors `plugin-inbox` JMAP)
- Contribute a **`Connector` entry** (capability) with: a **`credentialForm`** collecting the Readwise token (validated against the live API, e.g. `GET /api/v2/auth/`), `materializeTarget` that creates/returns the `Readwise` container, a `sync` operation, and `onTokenCreated` (store the account label). No OAuth. (Precedent: `plugin-inbox/src/capabilities/connector.ts` + `jmap-credential-form.ts`.)
- The container's `Article` surface renders an **empty state** with the `ConnectorAuth` connect affordance when no connection is bound (precedent: `plugin-inbox` `InitializeMailbox`/`InitializeMailboxAction`).
- Connecting creates `Connection` + `AccessToken` + `SyncBinding` (binding the connection to the `Readwise` container as target).

### 4.3 Sync
- **Reuse** `readwise-api.ts` (injectable transport via the EDGE CORS proxy; the `nextPageCursor` fix). Read the binding's cursor (`updatedAfter`); default window on first run.
- **Rework capture:** upsert a `Bookmark` per source document (dedup by a stable source key) and a `Highlight` per highlight (dedup by `readwiseId`), relate `Highlight → Bookmark`, and associate highlights with the `Readwise` container. **No `Task` cards, no Kanban** in Inc 1.
- Idempotent; a changed note updates the existing `Highlight`.
- **Sync entry point:** a graph-builder action (`disposition: 'toolbar'`) on the `Readwise` node invoking the sync operation — always reachable, independent of any board.

### 4.4 Browse view
- **`Article` surface** for `Readwise` → renders a **grouped-by-source, recency-sorted** list (query highlights in the container, group by `source` Bookmark, order sources by max child `updated`).
- **`CardContent` surface** for `Highlight` → the card (passage + source line + note + tags + inert state-dot + inert forward affordance).
- Opening a `Highlight` → a detail (`Article`/`Section`) with full passage, note, and a source link.

## 5. Reuse / rework of current branch code

| Current | Action for Inc 1 |
|---|---|
| `services/readwise-api.ts`, `services/credentials.ts` | **Reuse** (transport + token). |
| `operations/capture.ts` | **Rework** → create `Bookmark` + `Highlight` (not `Message`/`Task`), associate to container. |
| `operations/sync.ts` | **Reuse/retarget** onto the Connector `sync` op + container binding. |
| `decompose.ts`, `confirm.ts`, `ensure-board.ts`, `TriageCard/`, `TriageBoard/`, triage `Task` cards, the `Kanban` | **Defer** to Inc 2/3 (the writing-plans step decides: keep dormant vs. remove-and-reintroduce). |
| *(none)* | **Add:** `Readwise` + `Highlight` types; `Connector` entry + credential form; `CreateObjectEntry` + `addCreateObjectModule`; `app-graph-builder` (Sync action); `Article` + `CardContent` surfaces + the grouped-source container. |

## 6. Testing (outside-in — the correction from last time)

- **Headline acceptance = a walking-skeleton run in the real app, EARLY, not last:** in composer-app, create a `Readwise` → connect with a token → Sync → see highlights grouped by source. Driven via the preview tools; this is the acceptance gate for the increment, and it runs while the internals are still thin.
- **Unit (Vitest, no network):** capture idempotency (`Highlight` dedup by `readwiseId`, `Bookmark` dedup, `Highlight→Bookmark` relation), transport parse (reuse), the recency-sort/grouping logic, the `Connector`-entry + `CreateObjectEntry` wiring (smoke via `createComposerTestApp`).
- **Gates:** `moon run plugin-readwise:build` (typecheck 0), `:test`, `:lint` — all green (the `:build` gate is mandatory; `:test`/`:lint` do not typecheck).
- **PLUGIN.mdl:** `req`/`test` blocks mapping to §2, at user-behavior altitude.

## 7. Risks / to verify during implementation

- **Token-only (no-OAuth) connector** — confirm the Connector framework supports a pure `credentialForm` connector (the `plugin-inbox` **JMAP** manual-token path is the precedent; verify Readwise fits it).
- **`materializeTarget` + empty-state connect** — confirm our `Readwise` `Article` surface can render the `ConnectorAuth` affordance the way `MailboxArticle`/`InitializeMailbox` does.
- **Grouping/recency query** — confirm an efficient query for "highlights in this container grouped by source, sources ordered by latest child `updated`."
- **Readwise REST** — CORS via proxy (verified live), `/export/?updatedAfter=` shape (verified live), `nextPageCursor` numeric (fixed).
- **Old-doc cleanup** — the `2026-07-04-*` spec/plan are superseded; a follow-up should retire them from in-scope per the canon-partition rule (flag, don't silently delete).
