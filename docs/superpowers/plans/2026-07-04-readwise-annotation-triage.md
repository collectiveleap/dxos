# Readwise Annotation Triage — Implementation Plan (Increment 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `plugin-readwise` that syncs Readwise highlights/document-notes into Composer, decomposes each into confirmed intent-items on a human-gated triage board, and is structured to be extracted to its own repo and loaded by Composer at runtime.

**Architecture:** A leaf Composer plugin. In-browser, on-demand REST sync (Readwise REST API v2/v3, static `Token` auth) routed through the shared hosted EDGE CORS proxy, with an **injectable transport** so tests/Node/dev never touch production EDGE. Idempotent capture (keyed by `readwiseId`) via a `Cursor`, producing `Bookmark` + annotation `Message` + a triage `Task` card. An AI step proposes a decomposition persisted as the card's first companion-`Chat` message; Steve confirms, producing heterogeneous results (`comment`→`Message`, `Question`/`ToDo`→`Task`, open-ended) on a view-variant `Kanban`. Reuses existing `@dxos` types only — zero new ECHO types.

**Tech Stack:** TypeScript, Effect-TS, `@dxos/echo` (ECHO schema/query), `@dxos/app-framework` + `@dxos/app-toolkit` (plugin/capability/operation system), `@dxos/edge-client` (CORS proxy), `@dxos/plugin-kanban` / `@dxos/plugin-assistant` / `@dxos/types` / `@dxos/plugin-bookmarks` (reused types), `@dxos/plugin-testing` harness, Vitest, `composerPlugin` Vite plugin (for the external build).

**Spec:** `docs/superpowers/specs/2026-07-04-readwise-annotation-triage-design.md`. Reference plugins to copy patterns from: `plugin-chess` (scaffold + test harness), `plugin-linear` (Cursor sync operation), `plugin-bluesky` (authed external HTTP + credentials service), `plugin-connector` (`Connection`/`AccessToken`/`SyncBinding`), `plugin-kanban` (board), `plugin-assistant` (companion `Chat`), `plugin-ibkr` (`proxyFetchLegacy`).

## Global Constraints

Every task's requirements implicitly include this section.

- **New package MUST be `"private": true`** (removed only once a trusted publisher is configured). Do not add `publishConfig.access: public`.
- **`@dxos/*` deps are `workspace:*`** in-tree; external (non-workspace) deps come from the pnpm catalog (`pnpm add --filter @dxos/plugin-readwise --save-catalog <pkg>`).
- **Do NOT modify shared `@dxos` types** (`Task`, `Message`, `Bookmark`, `Tag`, `AnchoredTo`, `Cursor`, `Connection`, `AccessToken`, `Kanban`, `Chat`). Compose via relations + tags. Zero new ECHO types.
- **No `as` casts to satisfy the type checker** (`as const` is fine). Fix types at the source. Audit diff before each commit: `git diff origin/main | grep -nE '\bas (any|unknown|[A-Z])|as unknown as'`.
- **Effect-TS error handling:** define domain errors with `BaseError.extend` (`@dxos/errors`) or `Data.TaggedClass`; never put untyped `Error` in an Effect error channel.
- **Injectable transport:** the HTTP transport is an Effect dependency (`direct | vite-proxy | edge-proxy`); production browser defaults to `edge-proxy`; tests/Node use `direct`/mock. Never hard-wire `proxyFetchLegacy` into sync logic.
- **External-consumability (leaf + public API only):** this plugin must be extractable to its own repo (see Task 13). Therefore: (a) **nothing else in the monorepo may depend on `plugin-readwise`** — it is a leaf; (b) import only from package **public entrypoints** (barrels), never deep internal paths; (c) keep the `@dxos/*` dependency list **minimal** and note each one — every dep must be host-provided at runtime (verified in Task 13); (d) ship `dx.config.ts` from day one.
- **BDD/TDD:** every task lands test-first; the plugin's first test is the `plugin-chess` smoke pattern (`createComposerTestApp`). No network in unit tests — use the captured fixture from Task 1.
- **Single quotes, arrow functions, barrel imports, comments end with a period, no default exports.**
- **Test a package's public surface** (exported operations/capabilities), not private internals. Use `describe`/`test('x', ({ expect }) => …)`, tests as `module.test.ts` beside modules, prefer one cohesive suite.

---

## File Structure

```
packages/plugins/plugin-readwise/
  package.json                      # private:true; workspace @dxos deps; catalog external
  dx.config.ts                      # plugin identity (key org.dxos.plugin.readwise) + publish block
  vite.config.ts                    # composerPlugin() — external/lib build + dev server
  moon.yml                          # library; ts-build/ts-test; compile entryPoints
  vitest.config.ts
  PLUGIN.mdl                        # spec blocks (given/when/then) mapped to tests
  README.md
  src/
    index.ts                        # barrel
    meta.ts                         # Plugin.getMetaFromConfig(config)
    ReadwisePlugin.tsx              # default plugin (browser)
    ReadwisePlugin.node.ts          # headless variant (for tests/Node sync)
    ReadwisePlugin.test.ts          # smoke test (chess pattern) + operation invokes
    plugin.ts                       # Plugin.lazy(meta, () => import('#plugin'))
    translations.ts
    constants.ts                    # tag labels, DXNs, endpoints
    errors.ts                       # ReadwiseError domain errors
    types/
      index.ts
      intent.ts                     # IntentKind union + result-kind registry (kind -> representation)
      intent.test.ts
    services/
      index.ts
      readwise-api.ts               # REST client + injectable Transport (Context.Tag)
      readwise-api.test.ts
      credentials.ts                # ReadwiseCredentials.fromConnection (AccessToken loader)
      credentials.test.ts
    operations/
      index.ts
      sync.ts                       # Cursor-based idempotent sync operation
      sync.test.ts
      capture.ts                    # upsert Bookmark + annotation Message + triage Task card
      capture.test.ts
      decompose.ts                  # AI decomposition -> companion-Chat first message
      decompose.test.ts
      confirm.ts                    # materialize confirmed results; card -> Done
      confirm.test.ts
    capabilities/
      index.ts
      operation-handler.ts          # ReadwiseOperationHandlerSet
      react-surface.tsx             # board / card / sync-action surfaces
    containers/
      TriageBoard/                  # view-variant Kanban surface
      TriageCard/
    test/
      fixtures/highlights.sample.json   # captured real Readwise response (Task 1)
      test-layer.ts                     # unified TestLayer (mock Transport + in-memory space)
```

---

### Task 1: Verification spike — pin the unknown APIs

Resolves the spec's "verify during implementation" list before any dependent code. Deliverable: a captured fixture + a short findings note appended to this plan's Task-1 block (edit the checklist items into prose). No production code yet.

**Files:**
- Create: `packages/plugins/plugin-readwise/test/fixtures/highlights.sample.json`
- Create: `scratch/readwise-probe.mjs` (throwaway Node script; not committed to the package)

**Interfaces:**
- Produces: `highlights.sample.json` — an array of real Readwise highlight objects with fields `id, text, note, location, location_type, url, color, updated, highlighted_at, book_id, tags` + book detail (`book_title, book_author, book_category, book_source, book_source_url, book_cover_image_url, book_document_note`). Later tasks parse exactly this shape.

- [ ] **Step 1: Probe the Readwise REST API from Node (no CORS).** Write `scratch/readwise-probe.mjs` that reads `READWISE_TOKEN` from env and `fetch`es `https://readwise.io/api/v2/export/?updatedAfter=<iso>` (and `/api/v2/highlights/`) with header `Authorization: Token ${token}`. Print the JSON. Run: `READWISE_TOKEN=<token> node scratch/readwise-probe.mjs`. Confirm: exact endpoint(s) for incremental pull, the pagination shape (`nextPageCursor`/`count`/`results`), and the field names for text/note/tags/book. (Steve supplies the token — see "Human dependencies" at the end.)
- [ ] **Step 2: Save a representative response** (10–20 highlights spanning: a highlight with a note, one without, one with tags, and a document-level note) to `test/fixtures/highlights.sample.json`. Redact nothing structural; this is the offline test corpus.
- [ ] **Step 3: Confirm the incremental cursor parameter.** Note which parameter drives "changed since last sync" (`updatedAfter` for `/export`, or `updated__gt` for `/highlights`) and what value to store in `Cursor.value`. Record the decision in prose in this task block.
- [ ] **Step 4: Confirm companion-Chat seeding.** Read `packages/plugins/plugin-assistant/src/operations/ensure-companion-chat.ts` and `packages/core/compute/assistant-toolkit/src/types/Chat.ts`. Confirm how to (a) ensure a `Chat` companion for a given `Task` object via `Chat.CompanionTo`, and (b) append a first `Message` to the Chat's `feed` with custom `properties`. Record the exact function names/signatures in prose here.
- [ ] **Step 5: Confirm Kanban view-variant creation.** Read `packages/plugins/plugin-kanban/src/types/Kanban.ts` (`makeView`) and how a `View` with a `Query`/pivot is constructed. Confirm how to build a `View` whose query is `Query.select(Filter.type(Task)).select(Filter.tag(<triageTag>))` and pivots on `status`. Record the exact factory calls in prose here.
- [ ] **Step 6: Commit** (fixture only; `scratch/` is gitignored).

```bash
git add packages/plugins/plugin-readwise/test/fixtures/highlights.sample.json docs/superpowers/plans/2026-07-04-readwise-annotation-triage.md
git commit -m "test(plugin-readwise): capture Readwise API fixture + spike findings"
```

---

### Task 2: Scaffold the plugin package + smoke test

**Files:**
- Create: `package.json`, `dx.config.ts`, `vite.config.ts`, `moon.yml`, `vitest.config.ts`, `src/meta.ts`, `src/plugin.ts`, `src/ReadwisePlugin.tsx`, `src/ReadwisePlugin.node.ts`, `src/index.ts`, `src/translations.ts`, `src/constants.ts`, `src/errors.ts`, `src/capabilities/index.ts`
- Test: `src/ReadwisePlugin.test.ts`

**Interfaces:**
- Produces: `ReadwisePlugin` (zero-arg plugin factory); `meta` with `profile.key = 'org.dxos.plugin.readwise'`; `constants.ts` exports `TRIAGE_TAG = 'org.dxos.plugin.readwise/triage'`, `READWISE_API_BASE`, DXN strings.

- [ ] **Step 1: Create `package.json`** (copy `plugin-chess/package.json` structure; strip chess-specific deps). Set `"name": "@dxos/plugin-readwise"`, `"version": "0.0.1"`, **`"private": true`**, `"type": "module"`, `"sideEffects": true`. Deps (`workspace:*`): `@dxos/app-framework`, `@dxos/app-toolkit`, `@dxos/echo`, `@dxos/echo-react`, `@dxos/edge-client`, `@dxos/errors`, `@dxos/invariant`, `@dxos/log`, `@dxos/plugin-client`, `@dxos/react-client`, `@dxos/react-ui`, `@dxos/react-ui-mosaic`, `@dxos/types`, `@dxos/plugin-bookmarks`, `@dxos/plugin-kanban`, `@dxos/plugin-assistant`, `@dxos/util`. External (catalog): `effect`, `@effect-atom/atom-react`. Dev: `@dxos/plugin-testing`, `@dxos/storybook-utils`, `vite`, `@types/react`. Do NOT include `publishConfig`.
- [ ] **Step 2: Create `dx.config.ts`** declaring the plugin identity (validated against `@dxos/protocols` `Config2`):

```ts
import { defineConfig } from '@dxos/app-framework';

export default defineConfig({
  plugin: {
    key: 'org.dxos.plugin.readwise',
    name: 'Readwise',
    description: 'Triage Readwise highlights and notes into Composer.',
    icon: 'ph--highlighter--regular',
    tags: ['labs'],
  },
  // publish block added in Task 13 (buildCommand/outputDirectory) for external release.
});
```
(Verify the exact `defineConfig`/export shape against an existing `packages/plugins/*/dx.config.ts`; match it verbatim.)
- [ ] **Step 3: Create `src/meta.ts` and `src/plugin.ts`** verbatim-analogous to chess:

```ts
// meta.ts
import { Plugin } from '@dxos/app-framework';
import config from '../dx.config';
export const meta = Plugin.getMetaFromConfig(config);
```
```ts
// plugin.ts
import { Plugin } from '@dxos/app-framework';
import { meta } from './meta';
export const ReadwisePlugin = Plugin.lazy(meta, () => import('#plugin'));
export { ReadwiseOperationHandlerSet } from './operations';
```
- [ ] **Step 4: Create `src/ReadwisePlugin.tsx` and `.node.ts`** — a plugin definition that contributes only a **schema module** for now (no types yet beyond reused ones; register the reused types used in queries per the chess `#plugin` pattern). Contribute the `OperationHandler` module lazily. Adapt from `plugin-chess/src/ChessPlugin.tsx`. Add `src/capabilities/index.ts` (empty barrel for now) and `src/errors.ts` (`ReadwiseError extends BaseError.extend(...)`), `src/constants.ts`.
- [ ] **Step 5: Write the failing smoke test** `src/ReadwisePlugin.test.ts` (chess pattern):

```ts
import { describe, test } from 'vitest';
import { ClientPlugin } from '@dxos/plugin-client/plugin';
import { createComposerTestApp } from '@dxos/plugin-testing/harness';
import { ReadwisePlugin } from '#plugin';
import { meta } from './meta';

const moduleId = (name: string) => `${meta.profile.key}.module.${name}`;

describe('ReadwisePlugin', () => {
  test('schema module activates on startup', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()] });
    expect(harness.manager.getActive()).toEqual(expect.arrayContaining([moduleId('schema')]));
  });
});
```
- [ ] **Step 6: Add the workspace + run the test.** `pnpm install` (with `CI=true`). Run: `moon run plugin-readwise:test -- src/ReadwisePlugin.test.ts`. Expected: PASS (module id present). Fix `#plugin`/`#meta` import aliases in `package.json` `imports` until green.
- [ ] **Step 7: Commit.**

```bash
git add packages/plugins/plugin-readwise pnpm-lock.yaml
git commit -m "feat(plugin-readwise): scaffold package + activation smoke test"
```

---

### Task 3: Intent taxonomy + result-kind registry

**Files:**
- Create: `src/types/intent.ts`, `src/types/index.ts`
- Test: `src/types/intent.test.ts`

**Interfaces:**
- Produces:
  - `type IntentKind = 'comment' | 'question' | 'todo'` (string-widened for extensibility; the runtime set lives in `INTENT_KINDS`).
  - `const INTENT_KINDS: readonly IntentKind[]`.
  - `type Representation = 'message' | 'task'`.
  - `const resultKindRegistry: Record<IntentKind, { tag: string; representation: Representation }>` mapping `comment → {tag:'…/comment', representation:'message'}`, `question → {…, 'task'}`, `todo → {…, 'task'}`.
  - `const representationFor: (kind: IntentKind) => Representation`.

- [ ] **Step 1: Write the failing test** `src/types/intent.test.ts`:

```ts
import { describe, test } from 'vitest';
import { representationFor, resultKindRegistry, INTENT_KINDS } from './intent';

describe('intent registry', () => {
  test('comment maps to a message, question and todo map to tasks', ({ expect }) => {
    expect(representationFor('comment')).toBe('message');
    expect(representationFor('question')).toBe('task');
    expect(representationFor('todo')).toBe('task');
  });
  test('every intent kind has a registry entry with a tag', ({ expect }) => {
    for (const kind of INTENT_KINDS) {
      expect(resultKindRegistry[kind].tag).toMatch(/^org\.dxos\.plugin\.readwise\//);
    }
  });
});
```
- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module './intent'`). `moon run plugin-readwise:test -- src/types/intent.test.ts`.
- [ ] **Step 3: Implement `src/types/intent.ts`** with the union, `INTENT_KINDS`, `resultKindRegistry`, and `representationFor = (kind) => resultKindRegistry[kind].representation`. Export from `src/types/index.ts`.
- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): intent taxonomy + result-kind registry"`

---

### Task 4: Readwise REST client with injectable transport

**Files:**
- Create: `src/services/readwise-api.ts`, `src/services/index.ts`, `src/test/test-layer.ts`
- Test: `src/services/readwise-api.test.ts`

**Interfaces:**
- Produces:
  - `class Transport extends Context.Tag('…/Transport')<Transport, { readonly fetch: (url: string, init?: RequestInit) => Effect.Effect<Response, ReadwiseError> }>` — the injectable seam.
  - `const TransportLive.edgeProxy` / `.direct` layers (edgeProxy wraps `proxyFetchLegacy` from `@dxos/edge-client/cors-proxy`; direct wraps global `fetch`).
  - `class ReadwiseApi extends Context.Tag(...)<ReadwiseApi, { readonly listHighlightsSince: (cursor?: string) => Effect.Effect<{ highlights: Highlight[]; nextCursor?: string }, ReadwiseError, Transport> }>`.
  - `interface Highlight` — the parsed shape (id, text, note, tags, location, url, sourceTitle, sourceAuthor, sourceUrl, updated, readwiseId).

- [ ] **Step 1: Write the failing test** using the Task 1 fixture and a mock `Transport` (returns the fixture as a `Response`). Assert `listHighlightsSince()` parses N highlights, maps `book_title→sourceTitle`, preserves `note` and `tags`, and threads the cursor param into the request URL. (Model the layer/mocking on `plugin-linear/src/operations/sync.test.ts` and `plugin-bluesky` service tests.)

```ts
import { describe, test } from 'vitest';
import { Effect, Layer } from 'effect';
import { ReadwiseApi, Transport } from './readwise-api';
import fixture from '../test/fixtures/highlights.sample.json';

const MockTransport = Layer.succeed(Transport, {
  fetch: (url) => Effect.succeed(new Response(JSON.stringify({ results: fixture, nextPageCursor: null }), { status: 200 })),
});

describe('ReadwiseApi.listHighlightsSince', () => {
  test('parses highlights and maps source metadata', async ({ expect }) => {
    const { highlights } = await Effect.runPromise(
      ReadwiseApi.pipe(Effect.flatMap((api) => api.listHighlightsSince('2026-01-01T00:00:00Z')))
        .pipe(Effect.provide(ReadwiseApi.Default), Effect.provide(MockTransport)),
    );
    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights[0].sourceTitle).toBeTypeOf('string');
    expect(highlights[0].readwiseId).toBeTypeOf('string');
  });
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `readwise-api.ts`** — the `Transport` tag + two layers, and `ReadwiseApi` whose `listHighlightsSince` builds the URL (endpoint + cursor param confirmed in Task 1), calls `Transport.fetch`, decodes JSON with an Effect `Schema` (fail into `ReadwiseError`), and maps to `Highlight`. Use `@effect/platform` HttpClient conventions from `plugin-bluesky` only if already a dep; otherwise a thin `Transport.fetch` is sufficient. Add `src/test/test-layer.ts` exporting `MockTransport` + a `TestLayer(opts?)` that composes mock transport with an in-memory ECHO space (copy the space-setup from `plugin-linear` tests).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Add a pagination test** (fixture split across two pages via `nextPageCursor`), implement the follow-page loop, verify all highlights returned. 
- [ ] **Step 6: Commit.** `git commit -m "feat(plugin-readwise): Readwise REST client with injectable transport"`

---

### Task 5: Credentials service (AccessToken via Connection)

**Files:**
- Create: `src/services/credentials.ts`
- Test: `src/services/credentials.test.ts`

**Interfaces:**
- Produces: `class ReadwiseCredentials extends Context.Tag(...)<ReadwiseCredentials, { readonly token: string }>` and `ReadwiseCredentials.fromConnection: (connection: Connection) => Layer<ReadwiseCredentials, ReadwiseError, DatabaseService>` — loads the `AccessToken` referenced by the `Connection` and yields its `token`. `TransportLive.edgeProxy` reads this tag to set the `Authorization: Token <token>` header.

- [ ] **Step 1: Write the failing test** — build an in-memory space, create an `AccessToken` (`source:'readwise.io'`, `token:'test-tok'`) and a `Connection` referencing it, then assert `fromConnection(connection)` yields `{ token: 'test-tok' }`. (Copy `AccessToken`/`Connection` construction from `plugin-connector` tests; adapt the credentials loader from `plugin-bluesky/src/services/BlueskyApi.ts:338-369` and `plugin-linear/src/services/linear-api.ts:109-122`.)
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `credentials.ts`** — `fromConnection` dereferences the `AccessToken` via the Database service and constructs the layer. Wire `Authorization: Token` (Readwise uses `Token`, not `Bearer`) into the request builder in `readwise-api.ts`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): Readwise credentials from AccessToken/Connection"`

---

### Task 6: Idempotent capture — Bookmark + annotation Message

**Files:**
- Create: `src/operations/capture.ts`, `src/operations/index.ts`
- Test: `src/operations/capture.test.ts`

**Interfaces:**
- Produces: `const captureHighlights: (space, highlights: Highlight[]) => Effect<{ created: number; updated: number }>` — for each highlight: upsert a `Bookmark` (dedup by `sourceUrl`), upsert an annotation `Message` (dedup by `readwiseId` stored in `Message.properties.readwiseId`), and `AnchoredTo`-relate the Message to the Bookmark. Re-running with the same input must create no duplicates.

- [ ] **Step 1: Write the failing idempotency test:**

```ts
import { describe, test } from 'vitest';
import { Message } from '@dxos/types';
import { Filter } from '@dxos/echo';
import { captureHighlights } from './capture';
import { TestLayer } from '../test/test-layer';
import fixture from '../test/fixtures/highlights.sample.json';

describe('captureHighlights', () => {
  test('is idempotent — running twice creates no duplicate annotations', async ({ expect }) => {
    const { space, run, highlights } = await TestLayer({ fixture });
    await run(captureHighlights(space, highlights));
    await run(captureHighlights(space, highlights));
    const messages = await space.db.query(Filter.type(Message.Message)).run();
    expect(messages.objects.length).toBe(highlights.length);
  });
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `capture.ts`** — query existing annotation Messages by `properties.readwiseId`; create-or-update. `Message.make({ sender:{role:'user'}, blocks:[{_tag:'text', text: passage}, ...(note?[{_tag:'text',text:note}]:[])], properties:{ readwiseId, location, color, sourceTags } })`. Create `Bookmark` via its factory. Use `AnchoredTo` (no `anchor` string). Reuse types via barrels (`@dxos/types`, `@dxos/plugin-bookmarks`).
- [ ] **Step 4: Run — expect PASS.** Add a second test asserting re-sync with a changed `note` updates the existing Message (not a new one).
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): idempotent capture of highlights as Bookmark + Message"`

---

### Task 7: Triage card creation

**Files:**
- Modify: `src/operations/capture.ts` (extend to also create the card)
- Test: `src/operations/capture.test.ts` (add cases)

**Interfaces:**
- Produces: for each newly-captured annotation, a `Task` card: `title` = a short snippet of the passage, `status: 'todo'` (= Needs Review), tagged `TRIAGE_TAG` (via `Obj.getMeta(task).tags`), `AnchoredTo` the annotation `Message`. Dedup: one card per annotation (keyed by the AnchoredTo target). `captureHighlights` return extended with `{ cards: number }`.

- [ ] **Step 1: Write the failing test** — after `captureHighlights`, query `Task` filtered by `Filter.tag(TRIAGE_TAG)`; assert one card per annotation, each `status:'todo'`, each anchored to its Message; re-running creates no extra cards.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** — extend capture to create/find the triage `Task` (reuse `Task` from `@dxos/types`; apply the tag via ECHO meta), anchored to the Message. Keep card creation idempotent (skip if an anchored triage Task already exists).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): create human-gated triage Task cards on capture"`

---

### Task 8: Sync operation (wires client + credentials + capture + cursor)

**Files:**
- Create: `src/operations/sync.ts`, `src/types/ReadwiseOperation.ts`, `src/capabilities/operation-handler.ts`
- Modify: `src/ReadwisePlugin.tsx`/`.node.ts` (contribute the handler), `src/operations/index.ts`
- Test: `src/operations/sync.test.ts`

**Interfaces:**
- Produces: `ReadwiseOperation.Sync` (input `{ connection: Ref<Connection> }`, output `{ created; updated; cards }`); `ReadwiseOperationHandlerSet`. The handler: loads the `SyncBinding.cursor`, runs `ReadwiseApi.listHighlightsSince(cursor.value)`, `captureHighlights(...)`, then `Cursor.advance(cursor, newHighWater)`. Transport provided at the handler boundary (default `edge-proxy`; overridable in tests).

- [ ] **Step 1: Write the failing test** via the harness (chess `harness.invoke` pattern), providing the **mock Transport** so no network is hit:

```ts
test('Sync captures highlights idempotently and advances the cursor', async ({ expect }) => {
  await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()], layers: [MockTransport] });
  const { connection } = await seedConnection(harness); // helper creates AccessToken+Connection+SyncBinding
  const first = await harness.invoke(ReadwiseOperation.Sync, { connection });
  const second = await harness.invoke(ReadwiseOperation.Sync, { connection });
  expect(first.created).toBeGreaterThan(0);
  expect(second.created).toBe(0); // cursor advanced → nothing new
});
```
(If `createComposerTestApp` cannot inject an Effect layer, provide the mock Transport inside the operation handler via a test-only capability — confirm the harness's layer-injection mechanism against `plugin-linear`/`plugin-inbox` operation tests and match it.)
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** — define `ReadwiseOperation.Sync` (copy the Operation definition shape from `plugin-chess/src/types/ChessOperation.ts` and `plugin-linear/src/operations/sync.ts:443-613`), the handler (`OperationHandlerSet`), and contribute it in the plugin (copy chess `operation-handler` capability wiring). Advance the `Cursor` (`Cursor.advance`) on success; write `lastError` on failure.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): cursor-based idempotent Sync operation"`

---

### Task 9: Triage Kanban board (view-variant, tag-scoped, 3 columns)

**Files:**
- Create: `src/operations/ensure-board.ts`, `src/containers/TriageBoard/TriageBoard.tsx` (+ `index.ts`, `.stories.tsx`)
- Modify: `src/operations/sync.ts` (ensure the board exists on first sync), `src/capabilities/react-surface.tsx`
- Test: `src/operations/ensure-board.test.ts`

**Interfaces:**
- Produces: `const ensureTriageBoard: (space) => Effect<Kanban>` — finds-or-creates one view-variant `Kanban` whose `View` query is `Query.select(Filter.type(Task)).select(Filter.tag(TRIAGE_TAG))`, pivoting on `status` so columns render **Needs Review (`todo`) / In Triage (`in-progress`) / Done (`done`)`. Idempotent (one board per space).

- [ ] **Step 1: Write the failing test** — call `ensureTriageBoard(space)` twice; assert exactly one `Kanban` exists, its View query filters `Task` by `TRIAGE_TAG`, and its pivot field is `status`. Seed a triage `Task` + a non-triage `Task`; assert the board's query returns only the triage one.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `ensure-board.ts`** — build the `View` + `Kanban` using the factory calls confirmed in Task 1 Step 5 (`plugin-kanban` `makeView`/View construction). Wire `ensureTriageBoard` into the sync operation (call once, find-or-create). Add `TriageBoard` container reusing `Board.Root` from `@dxos/react-ui-mosaic` (copy `plugin-kanban/src/components/KanbanBoard`). Register a `react-surface` for it.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): tag-scoped triage Kanban board"`

---

### Task 10: AI decomposition → companion-Chat first message

**Files:**
- Create: `src/operations/decompose.ts`
- Test: `src/operations/decompose.test.ts` (memoized LLM)

**Interfaces:**
- Produces: `const decomposeAnnotation: (space, card: Task) => Effect<Chat>` — ensures the card's companion `Chat` (via `Chat.CompanionTo`, using `EnsureCompanionChat` from Task 1 Step 4), asks the model to decompose the annotation into candidate items, and writes the AI's proposal as the **first `Message`** in the Chat feed with `properties.suggestedItems: Array<{ suggestedKind: IntentKind; text: string; note?: string }>` (plus human-readable text). Idempotent: if a suggestion message already exists, do not re-generate.

- [ ] **Step 1: Write the failing test** using the memoized-LLM fixture pattern (see `.agents/skills` / `regenerate-memoized-llm` and `testing-assistant-conversations`). Given a fixture annotation whose note contains a question and a to-do, assert the companion Chat's first message `properties.suggestedItems` contains a `question` and a `todo` entry, each carrying the passage text.
- [ ] **Step 2: Run — expect FAIL** (no memoized conversation / function missing).
- [ ] **Step 3: Implement `decompose.ts`** — ensure companion chat; build the decomposition prompt (system: "Split this highlight+note into 0+ items each tagged comment/question/todo; preserve exact text"); parse the structured output into `suggestedItems`; append the first feed `Message`. Reuse `AiSession`/assistant-toolkit patterns from `plugin-assistant`. Generate the memoized fixture via the repo's regenerate-memoized-llm skill.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): AI decomposition into companion-chat suggestion"`

---

### Task 11: Confirmation → materialize results; card → Done

**Files:**
- Create: `src/operations/confirm.ts`, `src/containers/TriageCard/TriageCard.tsx` (+ index, stories)
- Modify: `src/capabilities/react-surface.tsx`, `src/capabilities/operation-handler.ts`
- Test: `src/operations/confirm.test.ts`

**Interfaces:**
- Produces: `const confirmItems: (space, card: Task, decisions: Array<{ suggestedKind: IntentKind; finalKind: IntentKind; text: string; note?: string; accept: boolean }>) => Effect<{ results: Obj[] }>` — for each accepted decision, materialize a result via the registry: `comment → Message` (tagged `…/comment`), `question|todo → Task` (tagged accordingly, `status:'todo'`, `project` left unset). Each result is populated with passage+note, `AnchoredTo` the source document `Bookmark`, and linked back to the card. Record `properties.resolution` on the companion-chat suggestion message. Set the card `status:'done'`.

- [ ] **Step 1: Write the failing test** — given a decomposition with one accepted `question`, one accepted `comment`, and one rejected item, call `confirmItems`; assert exactly one `Task` tagged `question` and one `Message` tagged `comment` exist (rejected produced nothing), both anchored to the document and linked to the card, the resolution is recorded, and the card `status` is `done`.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `confirm.ts`** using `representationFor(finalKind)` from Task 3 to choose Message vs Task; apply the intent tag; anchor to the `Bookmark`; link to the card; update the suggestion message `properties.resolution`; set card `status`. Add the `TriageCard` container (renders passage/note + the suggested items with accept/edit/reject controls, and an "open assistant" affordance). Register surfaces + an operation handler for `confirmItems`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): confirm decomposition into typed results; card -> Done"`

---

### Task 12: UI surfaces + companion-chat wiring + PLUGIN.mdl

**Files:**
- Modify: `src/capabilities/react-surface.tsx`, `src/ReadwisePlugin.tsx`, `src/translations.ts`
- Create: `PLUGIN.mdl`, `README.md`
- Test: `src/ReadwisePlugin.test.ts` (extend: sync-action + companion surface)

**Interfaces:**
- Produces: a "Sync Readwise" action (invokes `ReadwiseOperation.Sync`) surfaced in the UI; the triage board and card surfaces registered; the `assistant-chat` companion surface confirmed to resolve for a triage `Task` card (so Steve can hold ad-hoc AI conversations scoped to the card).

- [ ] **Step 1: Write the failing test** — assert (a) invoking the sync action capability triggers `ReadwiseOperation.Sync`, and (b) `EnsureCompanionChat` resolves a `Chat` for a triage `Task` card (companion binding works). Extend the smoke suite; use the mock Transport.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** — register surfaces (board / card / sync action) copying `plugin-chess/src/capabilities/react-surface.tsx`; ensure the `assistant-chat` companion surface applies to the triage `Task` (verify against `plugin-assistant` react-surface filter). Author `PLUGIN.mdl` with `given/when/then` blocks mapping to the tests in Tasks 6–11 (one `req`/`test` per acceptance criterion in the spec §10). Fill `translations.ts` and `README.md`.
- [ ] **Step 4: Run all tests + lint.** `moon run plugin-readwise:test` and `moon run plugin-readwise:lint -- --fix`. Expected: all green.
- [ ] **Step 5: Commit.** `git commit -m "feat(plugin-readwise): UI surfaces, companion chat, PLUGIN.mdl specs"`

---

### Task 13: Milestone — prepare for extraction to an external repo + runtime loading

The plugin ships **inside** the monorepo first (Tasks 2–12), then is extracted to its own repo and loaded by Composer **at runtime**. This task makes it extractable and proves runtime loading locally; it does not require the external repo to exist yet.

**Files:**
- Modify: `vite.config.ts` (add `composerPlugin()`), `dx.config.ts` (add `publish` block)
- Create: `docs/superpowers/EXTRACTION.md` (the runbook)

**Interfaces:**
- Produces: a buildable external-plugin bundle (`dist/index.mjs` + `dist/manifest.json` + assets) and a documented, verified runtime-load path via the Composer dev-plugin loader (`devPluginUrl`).

- [ ] **Step 1: Audit dependencies for host availability.** For each `@dxos/*` dep in `package.json`, confirm it is provided by the Composer host at runtime (it externalizes all `@dxos/*` via import map — see `packages/sdk/app-framework/src/vite-plugin/composer/index.ts:63-64`). Flag any dep NOT bundled by the host Composer app; if a reused type's package (e.g. `@dxos/plugin-kanban`, `@dxos/plugin-assistant`) is not host-provided, record it as a runtime-load risk in `EXTRACTION.md` and decide (depend on host plugin vs vendor the small piece). No code change unless a risk is found.
- [ ] **Step 2: Add `composerPlugin()` to `vite.config.ts`** (lib-mode ESM, externalize `@dxos/*`/`react`/`effect`, emit `manifest.json`). Copy from `packages/plugins/plugin-template/vite.config.ts` if present; else from the `composerPlugin` docs at `packages/sdk/app-framework/src/vite-plugin/composer/index.ts`.
- [ ] **Step 3: Build the bundle.** Run the composer build (`moon run plugin-readwise:build` or the vite lib build). Expected: `dist/index.mjs` + `dist/manifest.json` (with `assets[]` + resolved `dependencies`). Verify the manifest `key` = `org.dxos.plugin.readwise`.
- [ ] **Step 4: Verify runtime loading locally (the testable deliverable).** Start the plugin's Vite dev server (`moon run plugin-readwise:serve` / `vite` — binds a local port serving `manifest.json`). In a locally-running Composer: Plugin Registry settings → set `devPluginUrl` to `http://localhost:<port>/manifest.json` and enable `devPluginEnabled`. Confirm the plugin loads at runtime (its schema module activates; the Sync action appears). Capture a screenshot. This proves the extraction path without publishing.
- [ ] **Step 5: Write `EXTRACTION.md`** — the concrete runbook to move to an external repo: copy `src/`, `package.json`, `dx.config.ts`, `vite.config.ts`; rewrite `@dxos/*` `workspace:*` → npm semver (matching the host's SDK version from the built manifest's `dependencies`); keep `dx.config.ts` verbatim; build; test via `devPluginUrl`; publish via `dx registry publish --handle <bsky> --app-password <pw>` (writes `plugin.profile` + `plugin.release` ATProto records, uploads the bundle); install in Composer via the registry UI. Record the dependency-audit findings from Step 1.
- [ ] **Step 6: Add the `publish` block to `dx.config.ts`** (`buildCommand`, `outputDirectory: 'dist'`).
- [ ] **Step 7: Commit.** `git commit -m "chore(plugin-readwise): external-build (composerPlugin) + runtime-load verification + extraction runbook"`

---

## Human dependencies (front-loaded — batch for one go-ahead)

Gather these before/at Task 1 so execution runs uninterrupted:

1. **Readwise API token** — for Task 1 (probe + fixture) and manual end-to-end verification. From `readwise.io/access_token`. Provide as `READWISE_TOKEN` env; do not commit it.
2. **A locally-running Composer** — for Task 13 Step 4 runtime-load verification (Steve runs `moon run composer-app:serve`).
3. **Bluesky handle + app password** — only for the *eventual* `dx registry publish` (Task 13 Step 5 / real extraction); not needed for in-tree work or local dev-plugin loading.

Everything else (scaffolding, types, sync, board, decomposition, confirmation, UI, local build) is buildable autonomously.

## Self-review notes

- **Spec coverage:** §3 transport→Tasks 4/5/8/13; §4 entity model→Tasks 3/6/7/10/11; §5 process→Tasks 6–11; §6 board+per-card AI→Tasks 9/10/12; §7 sync/EDGE/no-deploy→Tasks 4/8/13; §7.1 test-without-EDGE→Tasks 1/4/8 (mock/Node/dev-proxy); §8 scope→Tasks 2–12; §9 verify-items→Task 1; §10 acceptance→Task 12 PLUGIN.mdl; external-consumability (new requirement)→Global Constraints + Task 13.
- **Types consistent:** `Highlight`, `Transport`, `ReadwiseApi`, `ReadwiseCredentials`, `captureHighlights`, `ensureTriageBoard`, `decomposeAnnotation`, `confirmItems`, `TRIAGE_TAG`, `representationFor` are defined once and reused with the same names downstream.
- **Known adapt-from-reference points** (not placeholders — exact source + interface + test given): Operation definition/handler wiring (Task 8), Kanban view creation (Task 9), companion-chat seeding (Task 10), harness layer injection (Task 8). Task 1 pins these before they're needed.
