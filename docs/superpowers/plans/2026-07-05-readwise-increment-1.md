# Readwise Increment 1 — Ingest & Browse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a usable vertical slice: a person creates a `Readwise` from "+ Add", connects a Readwise account with an API token, syncs, and browses their highlights grouped by source (most-recently-active source first) in the running Composer app.

**Architecture:** A Composer plugin (`plugin-readwise`) contributes: two purpose-fit ECHO types (`Readwise` container + `Highlight`), reusing `Bookmark` (`@dxos/plugin-bookmarks`) as the source document; onboarding through the **Connector framework** (`@dxos/plugin-connector`, exemplar `plugin-inbox`) — a `Connector` entry with a token credential form, a `materializeTarget` op, and a `sync` op; a `SpaceCapabilities.CreateObjectEntry` making the container creatable; an `app-graph-builder` extension adding an always-reachable **Sync** toolbar action; and `Article`/`CardContent` surfaces rendering the empty-state connect affordance, the grouped-by-source browse list, the highlight card, and the highlight detail. Sync reuses the existing EDGE-CORS-proxy transport and reworks capture to upsert `Bookmark` + `Highlight` idempotently.

**Tech Stack:** TypeScript (single quotes), Effect-TS, `@dxos/echo` (ECHO objects/relations/refs), `@dxos/app-framework` + `@dxos/app-toolkit` (plugin/capability/surface framework), `@dxos/plugin-connector` (Connection/AccessToken/SyncBinding/Cursor + ConnectorAuth UI), `@dxos/compute` (Operation), Vitest, moon.

## Global Constraints

Every task's requirements implicitly include these. Copy exact values verbatim.

- **Purpose-fit types (this REVERSES the earlier "zero new ECHO types" decision).** New plugin-local ECHO types `Readwise` (`org.dxos.type.readwise` v`0.1.0`) and `Highlight` (`org.dxos.type.highlight` v`0.1.0`) are correct. Reuse `Bookmark` (`org.dxos.type.bookmark`) as the source.
- **No ECHO-core changes.** This plugin is a strict layer above `@dxos/echo`/`@dxos/types`. Never edit core schemas, annotations, or helpers. Adding plugin-local types is fine.
- **No casts to silence types.** No `as any`, `as unknown as T`, `as T`, non-null `!`, or widened `any`. `as const` is allowed. Fix types at the source. Before each commit run `git diff origin/main | grep -nE '\bas (any|unknown|[A-Z])|as unknown as'` and justify/remove each. Casts only at genuine untyped-data boundaries, with a comment.
- **The Readwise token is a live secret.** It is supplied at runtime via the credential form / environment only. NEVER write a token into a source file, test fixture, commit, or log. Test token used during the live run: provided by the user out-of-band.
- **Fixtures are SYNTHETIC.** Any test fixture data is invented (public-repo-safe); never real personal Readwise content.
- **`:build` is the mandatory gate.** `moon run plugin-readwise:build` typechecks (0 errors); `:test` and `:lint` do NOT typecheck. Every task ends green on `moon run plugin-readwise:build`, `moon run plugin-readwise:test`, and `moon run plugin-readwise:lint`.
- **Commit authorship.** Commit as `Steve Sanderson <296+Steve@users.noreply.github.com>`; keep the `Co-Authored-By: Claude` trailer. Do NOT push or open a PR unless the user asks.
- **Do not modify files outside `packages/plugins/plugin-readwise/` except Task 11's composer-app registration** (its own `chore(composer-app):` commit). If another out-of-package edit appears necessary, STOP and ask.
- **Superseded content lives in git history only** (canon-partition): when Task 2 deletes the triage code and Task 14 retires the old docs, no in-scope file may keep a summary of the deleted content.

## User-observable acceptance criteria (the definition of done — from the spec §2)

The plan is complete when, in the running composer-app:
1. "+ Add" offers **"Readwise"**; creating one opens it.
2. An unconnected `Readwise` shows a **"Connect Readwise"** affordance (not a blank pane).
3. Entering a **valid token** connects **without OAuth** and begins the first sync.
4. Highlights appear **grouped under their source, most-recently-active source first**; each card shows **passage + source (linked) + note (only if present) + tags**.
5. A re-sync that adds a highlight to a source **bumps that source to the top**; **nothing duplicates**.
6. A highlight card **opens** to full passage + note + source link.
7. Each card renders the **inert processing dot + inert "→ where it's processed" affordance**.
8. `build` + `test` + `lint` pass and the plugin loads with **no console errors**.

## File structure

```
packages/plugins/plugin-readwise/src/
  types/
    Readwise.ts              CREATE  container ECHO type (@import-as-namespace)
    Highlight.ts             CREATE  highlight ECHO type (@import-as-namespace)
    ReadwiseOperation.ts     MODIFY  keep Sync; add MaterializeTarget; drop Decompose/Confirm
    index.ts                 MODIFY  export Readwise, Highlight; drop intent
    intent.ts                DELETE  (+ intent.test.ts) — triage-only
  operations/
    capture.ts               REWORK  Bookmark + Highlight (drop Message/Task/AnchoredTo)
    capture.test.ts          REWORK
    sync.ts                  MODIFY  drop board; capture into the binding's target container
    sync.test.ts             MODIFY
    materialize-target.ts    CREATE  materializeTarget handler
    browse-query.ts          CREATE  pure grouping + recency sort
    browse-query.test.ts     CREATE
    index.ts                 MODIFY  handler set: sync + materialize-target
    decompose*.ts confirm*.ts ensure-board*.ts   DELETE (+ their tests)
  capabilities/
    connector.ts             CREATE  Connector entry
    readwise-credential-form.ts  CREATE  token form
    create-object.ts         CREATE  CreateObjectEntry
    app-graph-builder.ts     CREATE  Sync toolbar action
    react-surface.tsx        REWORK  container + card + detail surfaces
    index.ts                 MODIFY  add lazy Connector/CreateObject/AppGraphBuilder
    operation-handler.ts     (unchanged — still contributes ReadwiseOperationHandlerSet)
  containers/
    ReadwiseContainer/       CREATE  Article: empty-state connect + grouped browse
    HighlightCard/           CREATE  CardContent: one highlight card
    HighlightDetail/         CREATE  Article: highlight detail
    TriageBoard/ TriageCard/ DELETE
    index.ts                 MODIFY
  hooks/
    useReadwiseSyncBinding.ts  REWORK  find binding by target === container
    index.ts                 (unchanged)
  ReadwisePlugin.tsx         MODIFY  schema + module wiring
  constants.ts               MODIFY  add READWISE_CONNECTOR_ID; drop TRIAGE_TAG
  translations.ts            MODIFY  connect/sync/empty-state strings
  dev-seed.ts                DELETE  (untracked temp)
  services/readwise-api.ts   MODIFY  add validateToken(); commit nextPageCursor fix
PLUGIN.mdl                   MODIFY  req/test blocks (Task 13)
EXTRACTION.md                MODIFY  refresh dep surface (Task 14)
docs/superpowers/specs/2026-07-04-*  DELETE (Task 14)
packages/apps/composer-app/… MODIFY  register plugin (Task 11, own commit)
```

Precedent files an implementer should open when a step cites them (all under the repo root):
- Connector entry / form / materialize / sync: `packages/plugins/plugin-inbox/src/capabilities/connector.ts`, `.../jmap-credential-form.ts`, `.../operations/jmap/mail/materialize-target.ts`, `.../operations/jmap/mail/sync.ts`, `packages/plugins/plugin-connector/src/types/connector.ts`.
- Empty-state connect: `packages/plugins/plugin-inbox/src/components/Initialize/InitializeAction.tsx`.
- CreateObjectEntry: `packages/plugins/plugin-kanban/src/capabilities/create-object.ts`, `.../KanbanPlugin.tsx`.
- Graph builder: `packages/plugins/plugin-comments/src/capabilities/app-graph-builder.ts`, `packages/plugins/plugin-assistant/src/capabilities/app-graph-builder.ts`.
- Surfaces / type / plugin wiring: `packages/plugins/plugin-bookmarks/src/capabilities/react-surface.tsx`, `.../types/Bookmark.ts`, `.../BookmarksPlugin.tsx`, `packages/plugins/plugin-inbox/src/InboxPlugin.tsx`.

---

### Task 1: Reconcile the uncommitted testing-session changes

**Files:**
- Modify (commit as-is): `packages/plugins/plugin-readwise/src/services/readwise-api.ts` (the `nextPageCursor` numeric fix — already in the working tree).
- Delete: `packages/plugins/plugin-readwise/src/dev-seed.ts`.
- Modify: `packages/plugins/plugin-readwise/src/ReadwisePlugin.tsx` (remove the `import './dev-seed';` side-effect import + its comment, lines 19-20).
- Revert (working-tree edits from manual testing): `packages/apps/composer-app/src/plugin-defs.tsx`, `packages/apps/composer-app/package.json`, `packages/apps/composer-app/tsconfig.json`, `pnpm-lock.yaml`, and the uncommitted navtree hack in `packages/plugins/plugin-readwise/src/operations/ensure-board.ts` (that file is deleted in Task 2; revert its working-tree change here so the deletion diff is clean).

**Interfaces:**
- Produces: a clean working tree whose only committed delta vs `origin/main` on the plugin is the `nextPageCursor` fix; composer-app untouched (re-added properly in Task 11).

- [ ] **Step 1: Inspect the working tree**

Run: `git -C packages/plugins/plugin-readwise status && git status --short`
Expected: shows modified `services/readwise-api.ts`, `operations/ensure-board.ts`, `ReadwisePlugin.tsx`, untracked `dev-seed.ts`, and modified composer-app files + `pnpm-lock.yaml`.

- [ ] **Step 2: Confirm the readwise-api fix is exactly the cursor change**

Run: `git diff packages/plugins/plugin-readwise/src/services/readwise-api.ts`
Expected: only the schema widening `nextPageCursor: Schema.NullOr(Schema.String)` → `Schema.NullOr(Schema.Union(Schema.Number, Schema.String))` and the pagination coercion `pageCursor = page.nextPageCursor != null ? String(page.nextPageCursor) : undefined`. If anything else appears, stop and report.

- [ ] **Step 3: Remove the dev-seed side-effect import from ReadwisePlugin.tsx**

Delete these two lines (currently lines 19-20):

```tsx
// TEMPORARY (uncommitted): exposes globalThis.__seedReadwiseConnection for manual testing.
import './dev-seed';
```

- [ ] **Step 4: Delete the temp seed file**

Run: `git rm -f --quiet packages/plugins/plugin-readwise/src/dev-seed.ts 2>/dev/null || rm -f packages/plugins/plugin-readwise/src/dev-seed.ts`
Expected: file gone.

- [ ] **Step 5: Revert the composer-app + lockfile + ensure-board working-tree edits**

Run: `git checkout -- packages/apps/composer-app/src/plugin-defs.tsx packages/apps/composer-app/package.json packages/apps/composer-app/tsconfig.json pnpm-lock.yaml packages/plugins/plugin-readwise/src/operations/ensure-board.ts`
Expected: those files return to their committed state. `git status --short` now shows only `M services/readwise-api.ts` and `M ReadwisePlugin.tsx`.

- [ ] **Step 6: Build + test to prove the base is green**

Run: `moon run plugin-readwise:build && moon run plugin-readwise:test`
Expected: build 0 errors; tests pass (the existing suites still reference triage code — that is removed in Task 2, so they must still pass here).

- [ ] **Step 7: Cast audit + commit**

Run: `git add -A packages/plugins/plugin-readwise && git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'`
Expected: `no casts`.

```bash
git commit -m "fix(plugin-readwise): decode numeric Readwise nextPageCursor; drop dev-seed scaffolding

The Readwise export API returns nextPageCursor as a number; the schema
expected a string, so every real sync failed to decode. Widen the schema
and coerce to string for the pagination loop. Remove the temporary
manual-test seed helper.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Carve the Inc-2/3 triage scaffolding out to git history

Rationale: the vertical re-slice supersedes the triage pipeline (decompose → confirm → board). Per canon-partition it leaves the working tree entirely (it stays recoverable in git history) and is rebuilt correctly in Inc 2 (including the pivot-field-with-`options` board fix). The reused parts — `readwise-api.ts`, `credentials.ts`, `capture.ts` (reworked in Task 4), `sync.ts` (reworked in Task 5) — stay.

**Files:**
- Delete: `operations/decompose.ts`, `operations/decompose.test.ts`, `operations/decompose-handler.ts`, `operations/confirm.ts`, `operations/confirm.test.ts`, `operations/confirm-handler.ts`, `operations/ensure-board.ts`, `operations/ensure-board.test.ts`, `containers/TriageBoard/` (dir), `containers/TriageCard/` (dir), `types/intent.ts`, `types/intent.test.ts`.
- Modify: `operations/index.ts`, `operations/sync.ts`, `operations/sync.test.ts`, `types/index.ts`, `types/ReadwiseOperation.ts`, `capabilities/react-surface.tsx`, `containers/index.ts`, `ReadwisePlugin.tsx`.

**Interfaces:**
- Produces: `operations/index.ts` exports only `capture` + `ReadwiseOperationHandlerSet` (sync only for now); `ReadwiseOperation` exposes only `Sync`; `react-surface.tsx` contributes an empty surface list (surfaces rebuilt in Task 9); `sync.ts` no longer calls `ensureTriageBoard`.

- [ ] **Step 1: Delete the triage files**

```bash
cd packages/plugins/plugin-readwise/src
git rm operations/decompose.ts operations/decompose.test.ts operations/decompose-handler.ts \
       operations/confirm.ts operations/confirm.test.ts operations/confirm-handler.ts \
       operations/ensure-board.ts operations/ensure-board.test.ts \
       types/intent.ts types/intent.test.ts
git rm -r containers/TriageBoard containers/TriageCard
cd -
```

- [ ] **Step 2: Trim `operations/index.ts`**

Replace the whole file with:

```ts
//
// Copyright 2026 DXOS.org
//

import { OperationHandlerSet } from '@dxos/compute';

export * from './capture';

/**
 * Lazily-loaded handler set contributed to `Capabilities.OperationHandler` (see
 * `capabilities/operation-handler.ts`).
 */
export const ReadwiseOperationHandlerSet = OperationHandlerSet.lazy(
  () => import('./sync'),
);
```

(Task 6 adds `materialize-target` to this set.)

- [ ] **Step 3: Trim `types/ReadwiseOperation.ts` to `Sync` only**

Replace the whole file with:

```ts
//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Operation } from '@dxos/compute';
import { DXN, Ref } from '@dxos/echo';
import { SyncBinding } from '@dxos/plugin-connector';

import { meta } from '#meta';

const makeKey = (name: string) => DXN.make(`${meta.profile.key}.operation.${name}`);

/**
 * Reconcile Readwise highlights for one {@link SyncBinding}. The binding's source is the Connection
 * that authenticates the pull; its `cursor` is the durable high-water mark (an ISO `updatedAfter`
 * timestamp) advanced on success. Pull-only and idempotent. Matches the `Connector.sync` contract
 * (`SyncInput`/`SyncOutput` in `@dxos/plugin-connector`) so it is wired as a `ConnectorEntry.sync`.
 */
export const Sync = Operation.make({
  meta: {
    key: makeKey('sync'),
    name: 'Sync Readwise Highlights',
    description: 'Pull new/updated Readwise highlights for one connection binding and capture them into ECHO.',
    icon: 'ph--arrows-clockwise--regular',
  },
  input: Schema.Struct({
    binding: Ref.Ref(SyncBinding.SyncBinding),
  }),
  output: Schema.Struct({
    created: Schema.Number,
    updated: Schema.Number,
  }),
}).pipe(Operation.visible);
```

Note: the `output` drops the `cards` field (no triage Task cards). Task 4 changes `CaptureResult` to match `{ created, updated }`.

- [ ] **Step 4: Trim `types/index.ts`**

Replace the whole file with:

```ts
//
// Copyright 2026 DXOS.org
//

export * as ReadwiseOperation from './ReadwiseOperation';
```

(Task 3 adds `Readwise` and `Highlight` exports here.)

- [ ] **Step 5: Drop the board call from `operations/sync.ts`**

Remove the import line `import { ensureTriageBoard } from './ensure-board';` and remove these lines from the `Effect.gen` body:

```ts
        // Find-or-create the triage board once per sync so it exists after the first run;
        // idempotent, so re-running never creates a duplicate board.
        yield* ensureTriageBoard({ db });
```

(Task 5 reworks the rest of `sync.ts`.)

- [ ] **Step 6: Empty the surfaces (rebuilt in Task 9) and containers barrel**

Replace `capabilities/react-surface.tsx` with:

```tsx
//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capabilities, Capability } from '@dxos/app-framework';

// Surfaces are contributed in Task 9 (ReadwiseContainer, HighlightCard, HighlightDetail).
export default Capability.makeModule(() => Effect.succeed(Capability.contributes(Capabilities.ReactSurface, [])));
```

Replace `containers/index.ts` with:

```ts
//
// Copyright 2026 DXOS.org
//

// Containers are contributed in Task 9.
export {};
```

- [ ] **Step 7: Drop `Kanban`/`View`/`Task`/`Message` from the plugin schema (only what's still used remains)**

In `ReadwisePlugin.tsx`, replace the schema module line

```tsx
  AppPlugin.addSchemaModule({ schema: [Task.Task, Message.Message, Bookmark.Bookmark, View.View, Kanban.Kanban] }),
```

with

```tsx
  AppPlugin.addSchemaModule({ schema: [Bookmark.Bookmark] }),
```

and remove the now-unused imports `View` (`@dxos/echo`), `Kanban` (`@dxos/plugin-kanban`), `Message, Task` (`@dxos/types`). Keep `Bookmark`. Update the JSDoc block above the plugin to describe only the reused `Bookmark` (Task 3 adds the new types back to this list + doc).

- [ ] **Step 8: Fix the sync test to not expect a board**

In `operations/sync.test.ts`, remove any assertion that a triage board / Kanban was created and any `cards` expectation from the sync result. Keep the assertions that highlights were captured (those are reworked in Task 5). If the test imports `ensureTriageBoard` or `Kanban`, remove those imports.

- [ ] **Step 9: Build + test**

Run: `moon run plugin-readwise:build && moon run plugin-readwise:test`
Expected: build 0 errors; remaining tests pass (`capture.test`, `sync.test`, `readwise-api.test`, `credentials.test`, `ReadwisePlugin.test`, `test-layer.test`). `capture.test` still asserts the OLD Message/Task capture — that is reworked in Task 4; it must still pass here.

- [ ] **Step 10: Lint + cast audit + commit**

```bash
moon run plugin-readwise:lint
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'
git commit -m "refactor(plugin-readwise): carve triage pipeline for the Inc-1 re-slice

Remove decompose/confirm/board/triage-card scaffolding (recoverable in git
history; rebuilt correctly in Inc 2). Inc 1 is a connect -> sync -> browse
vertical slice; the triage board is superseded.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Define the `Readwise` and `Highlight` ECHO types

**Files:**
- Create: `types/Readwise.ts`, `types/Highlight.ts`, `types/Readwise.test.ts`.
- Modify: `types/index.ts`, `ReadwisePlugin.tsx`.

**Interfaces:**
- Produces:
  - `Readwise.Readwise` (class), `Readwise.make(props?: Obj.MakeProps<typeof Readwise>): Readwise`, `Readwise.instanceOf(v): v is Readwise`. Fields: `name?: string`. DXN `org.dxos.type.readwise` v`0.1.0`.
  - `Highlight.Highlight` (class), `Highlight.make(props): Highlight`, `Highlight.instanceOf(v): v is Highlight`. Fields: `text: string`, `note?: string`, `tags: readonly string[]`, `readwiseId: string`, `updated: string` (ISO), `source: Ref<Bookmark>`, `container: Ref<Readwise>`, `processingState?: 'none' | 'partial' | 'complete'` (reserved). DXN `org.dxos.type.highlight` v`0.1.0`.
- Consumes: `Bookmark.Bookmark` from `@dxos/plugin-bookmarks`.

- [ ] **Step 1: Write the failing type test**

Create `types/Readwise.test.ts`:

```ts
//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Obj, Ref } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';

import { Highlight } from './Highlight';
import { Readwise } from './Readwise';

describe('Readwise types', () => {
  test('constructs a Readwise container', ({ expect }) => {
    const readwise = Readwise.make({ name: 'My Reading' });
    expect(Readwise.instanceOf(readwise)).toBe(true);
    expect(readwise.name).toBe('My Reading');
  });

  test('constructs a Highlight referencing a source and container', ({ expect }) => {
    const readwise = Readwise.make({ name: 'My Reading' });
    const bookmark = Bookmark.make({ title: 'An Article', url: 'https://example.com/a' });
    const highlight = Highlight.make({
      text: 'a highlighted passage',
      tags: ['genai'],
      readwiseId: 'rw-1',
      updated: '2026-07-01T00:00:00.000Z',
      source: Ref.make(bookmark),
      container: Ref.make(readwise),
    });
    expect(Highlight.instanceOf(highlight)).toBe(true);
    expect(highlight.text).toBe('a highlighted passage');
    expect(highlight.source.target?.title).toBe('An Article');
    expect(highlight.container.target?.name).toBe('My Reading');
    expect(highlight.note).toBeUndefined();
    expect(Obj.instanceOf(Highlight.Highlight, highlight)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `moon run plugin-readwise:test -- types/Readwise.test.ts`
Expected: FAIL — `Cannot find module './Highlight'` / `'./Readwise'`.

- [ ] **Step 3: Create `types/Readwise.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Type } from '@dxos/echo';
import { LabelAnnotation } from '@dxos/echo/Annotation';

/**
 * A connected Readwise account: what a user creates from "+ Add", connects, syncs into, and opens to
 * browse. Per-account (a second instance connects a second account). Minimal — it anchors the
 * connection and holds highlights via `Highlight.container`.
 */
export class Readwise extends Type.makeObject<Readwise>(DXN.make('org.dxos.type.readwise', '0.1.0'))(
  Schema.Struct({
    name: Schema.optional(Schema.String.pipe(Schema.annotations({ title: 'Name' }))),
  }).pipe(
    LabelAnnotation.set(['name']),
    Annotation.IconAnnotation.set({ icon: 'ph--book-open--regular', hue: 'indigo' }),
  ),
) {}

export const make = (props: Obj.MakeProps<typeof Readwise> = {}): Readwise => Obj.make(Readwise, props);
export const instanceOf = (value: unknown): value is Readwise => Obj.instanceOf(Readwise, value);
```

- [ ] **Step 4: Create `types/Highlight.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Ref, Type } from '@dxos/echo';
import { FormInputAnnotation, LabelAnnotation } from '@dxos/echo/Annotation';
import { Bookmark } from '@dxos/plugin-bookmarks';

import * as Readwise from './Readwise';

/**
 * One highlighted passage synced from Readwise. `source` is the document it was highlighted in (a
 * reused `Bookmark`); `container` is the `Readwise` account it belongs to (so browse is per-account).
 * `processingState` is RESERVED (Inc 2 drives the card's left-rail dot from it) and inert in Inc 1.
 * There is no forward-ref field: the Inc-2 `result -> highlight` relation is reverse-queried from the
 * highlight, so the card's "-> where it's processed" affordance needs no field here.
 */
export class Highlight extends Type.makeObject<Highlight>(DXN.make('org.dxos.type.highlight', '0.1.0'))(
  Schema.Struct({
    text: Schema.String.pipe(Schema.annotations({ title: 'Passage' })),
    note: Schema.optional(Schema.String.pipe(Schema.annotations({ title: 'Note' }))),
    tags: Schema.Array(Schema.String),
    readwiseId: Schema.String.pipe(FormInputAnnotation.set(false)),
    // ISO 8601 timestamp of the highlight's last update in Readwise (dates are stored as ISO strings).
    updated: Schema.String.pipe(FormInputAnnotation.set(false)),
    source: Ref.Ref(Bookmark.Bookmark).pipe(FormInputAnnotation.set(false)),
    container: Ref.Ref(Readwise.Readwise).pipe(FormInputAnnotation.set(false)),
    processingState: Schema.optional(Schema.Literal('none', 'partial', 'complete')).pipe(FormInputAnnotation.set(false)),
  }).pipe(
    LabelAnnotation.set(['text']),
    Annotation.IconAnnotation.set({ icon: 'ph--quotes--regular', hue: 'amber' }),
  ),
) {}

export const make = (props: Obj.MakeProps<typeof Highlight>): Highlight => Obj.make(Highlight, props);
export const instanceOf = (value: unknown): value is Highlight => Obj.instanceOf(Highlight, value);
```

Note on imports: `LabelAnnotation`/`FormInputAnnotation` come from `@dxos/echo/Annotation`, `Annotation` (for `IconAnnotation`) from `@dxos/echo` — mirror `packages/plugins/plugin-bookmarks/src/types/Bookmark.ts:5-13`. If an import path differs, match Bookmark.ts exactly.

- [ ] **Step 5: Export the types from `types/index.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

export * as Highlight from './Highlight';
export * as Readwise from './Readwise';
export * as ReadwiseOperation from './ReadwiseOperation';
```

- [ ] **Step 6: Register the schema in the plugin**

In `ReadwisePlugin.tsx`, add `import { Highlight, Readwise } from '#types';` (or from `./types` — match the existing subpath-import style; the package uses `#capabilities`/`#meta`, so add a `#types` mapping if one exists, else `./types`). Change the schema module to:

```tsx
  AppPlugin.addSchemaModule({ schema: [Readwise.Readwise, Highlight.Highlight, Bookmark.Bookmark] }),
```

Update the JSDoc above the plugin to: "Registers the plugin's own `Readwise` and `Highlight` ECHO types plus the reused `Bookmark` (source documents)."

- [ ] **Step 7: Run the test to verify it passes**

Run: `moon run plugin-readwise:test -- types/Readwise.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Build, lint, cast audit, commit**

```bash
moon run plugin-readwise:build && moon run plugin-readwise:lint
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'
git commit -m "feat(plugin-readwise): add Readwise container + Highlight ECHO types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Rework capture — upsert `Bookmark` + `Highlight`

**Files:**
- Rework: `operations/capture.ts`, `operations/capture.test.ts`.

**Interfaces:**
- Consumes: `Highlight` (wire type) from `../services` (`services/readwise-api.ts` — fields `readwiseId`, `text`, `note`, `tags`, `updated`, `location`, `sourceId`, `sourceTitle`, `sourceUrl`, `sourceUniqueUrl`, `sourceImage`); `Readwise.Readwise`, `Highlight.Highlight` (ECHO types); `Bookmark.Bookmark`.
- Produces: `captureHighlights(space: CaptureSpace, highlights: readonly Highlight[]): Effect<CaptureResult, ReadwiseError>` where `CaptureSpace = { db: Database.Database; container: Readwise.Readwise }` and `CaptureResult = { created: number; updated: number }`. `created` counts new Bookmarks + new Highlights; `updated` counts Highlights whose note/tags changed. Idempotent (dedup Bookmark by `sourceId`, Highlight by `readwiseId`, both via ECHO foreign keys `{ source: READWISE_SOURCE, id }`).

- [ ] **Step 1: Rewrite the capture test**

Replace `operations/capture.test.ts` with:

```ts
//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Filter, Query } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';

import { Highlight as HighlightType, Readwise } from '../types';
import { captureHighlights } from './capture';
import { type Highlight } from '../services';
import { TestLayer } from '../test/test-layer';
import { Effect } from 'effect';

// Two synthetic highlights sharing one source document, plus a second source.
const wire = (over: Partial<Highlight>): Highlight => ({
  readwiseId: 'rw-1',
  text: 'a highlighted passage',
  note: undefined,
  tags: [],
  updated: '2026-07-01T00:00:00.000Z',
  location: 1,
  sourceId: 'src-1',
  sourceTitle: 'An Article',
  sourceUrl: 'https://example.com/a',
  sourceUniqueUrl: undefined,
  sourceImage: undefined,
  ...over,
});

describe('captureHighlights', () => {
  test('creates one Bookmark per source and one Highlight per highlight', ({ expect }) =>
    Effect.gen(function* () {
      const { db } = yield* TestLayer.make();
      const container = db.add(Readwise.make({ name: 'Test' }));
      const highlights = [
        wire({ readwiseId: 'rw-1', sourceId: 'src-1' }),
        wire({ readwiseId: 'rw-2', sourceId: 'src-1', text: 'second passage' }),
        wire({ readwiseId: 'rw-3', sourceId: 'src-2', sourceTitle: 'Other', text: 'third' }),
      ];

      const result = yield* captureHighlights({ db, container }, highlights);
      expect(result.created).toBe(5); // 2 bookmarks + 3 highlights

      const bookmarks = yield* Effect.promise(() => db.query(Query.select(Filter.type(Bookmark.Bookmark))).run());
      const stored = yield* Effect.promise(() => db.query(Query.select(Filter.type(HighlightType.Highlight))).run());
      expect(bookmarks.length).toBe(2);
      expect(stored.length).toBe(3);
      const first = stored.find((h) => h.readwiseId === 'rw-1')!;
      expect(first.source.target?.title).toBe('An Article');
      expect(first.container.target?.id).toBe(container.id);
    }).pipe(Effect.runPromise));

  test('is idempotent: a second identical run creates nothing', ({ expect }) =>
    Effect.gen(function* () {
      const { db } = yield* TestLayer.make();
      const container = db.add(Readwise.make({ name: 'Test' }));
      const highlights = [wire({ readwiseId: 'rw-1', sourceId: 'src-1' })];

      yield* captureHighlights({ db, container }, highlights);
      const second = yield* captureHighlights({ db, container }, highlights);
      expect(second.created).toBe(0);
      expect(second.updated).toBe(0);

      const stored = yield* Effect.promise(() => db.query(Query.select(Filter.type(HighlightType.Highlight))).run());
      expect(stored.length).toBe(1);
    }).pipe(Effect.runPromise));

  test('updates an existing Highlight when its note changed', ({ expect }) =>
    Effect.gen(function* () {
      const { db } = yield* TestLayer.make();
      const container = db.add(Readwise.make({ name: 'Test' }));

      yield* captureHighlights({ db, container }, [wire({ readwiseId: 'rw-1', note: undefined })]);
      const result = yield* captureHighlights({ db, container }, [wire({ readwiseId: 'rw-1', note: 'a new note' })]);
      expect(result.updated).toBe(1);

      const stored = yield* Effect.promise(() => db.query(Query.select(Filter.type(HighlightType.Highlight))).run());
      expect(stored.length).toBe(1);
      expect(stored[0].note).toBe('a new note');
    }).pipe(Effect.runPromise));
});
```

Note: match the actual `TestLayer` helper shape in `src/test/test-layer.ts` — if it exposes the space/db differently, adapt the `yield* TestLayer.make()` destructuring accordingly (read that file first). Fixtures are synthetic per Global Constraints.

- [ ] **Step 2: Run it to verify it fails**

Run: `moon run plugin-readwise:test -- operations/capture.test.ts`
Expected: FAIL — `captureHighlights` still has the old `CaptureSpace`/`CaptureResult` shape (no `container`, has `cards`), and creates Messages/Tasks not Highlights.

- [ ] **Step 3: Rewrite `operations/capture.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { type Database, Filter, Obj, Query, Ref } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';

import { READWISE_SOURCE } from '../constants';
import { ReadwiseError } from '../errors';
import { type Highlight as WireHighlight } from '../services';
import { Highlight, type Readwise } from '../types';

/** The subset of state capture needs: the space db and the account container highlights belong to. */
export interface CaptureSpace {
  readonly db: Database.Database;
  readonly container: Readwise.Readwise;
}

/** Result of one {@link captureHighlights} pass. `created` = new Bookmarks + new Highlights. */
export interface CaptureResult {
  readonly created: number;
  readonly updated: number;
}

const fkFor = (id: string) => ({ source: READWISE_SOURCE, id });

/**
 * Finds an existing object of `schema` carrying the Readwise foreign key `id`, if any. `T` is
 * forwarded untyped from `Filter.foreignKeys`'s result; the caller supplies the concrete result type.
 */
const findByForeignId = <T>(db: Database.Database, schema: Parameters<typeof Filter.foreignKeys>[0], id: string) =>
  Effect.tryPromise({
    try: () => db.query(Query.select(Filter.foreignKeys(schema, [fkFor(id)]))).run(),
    catch: (cause) => new ReadwiseError({ message: 'Failed to query captured Readwise objects.', cause }),
  }).pipe(Effect.map((results) => results[0] as T | undefined));

/**
 * Upserts the document-level `Bookmark` for one highlight's source document, deduped by `sourceId`.
 * Returns whether a new Bookmark was created.
 */
const upsertBookmark = (
  db: Database.Database,
  highlight: WireHighlight,
): Effect.Effect<{ bookmark: Bookmark.Bookmark; created: boolean }, ReadwiseError> =>
  Effect.gen(function* () {
    const existing = yield* findByForeignId<Bookmark.Bookmark>(db, Bookmark.Bookmark, highlight.sourceId);
    if (existing) {
      return { bookmark: existing, created: false };
    }
    const created = db.add(
      Bookmark.make({
        [Obj.Meta]: { keys: [fkFor(highlight.sourceId)] },
        title: highlight.sourceTitle,
        url: highlight.sourceUrl ?? highlight.sourceUniqueUrl ?? '',
        image: highlight.sourceImage,
        excerpt: highlight.text || undefined,
      }),
    );
    return { bookmark: created, created: true };
  });

/** True when a highlight's mutable content (note, tags) differs from what is stored. */
const contentChanged = (stored: Highlight.Highlight, next: WireHighlight): boolean =>
  (stored.note ?? undefined) !== (next.note || undefined) ||
  JSON.stringify([...stored.tags]) !== JSON.stringify(next.tags);

/**
 * Upserts the `Highlight` for one wire highlight, deduped by `readwiseId` (stored as an ECHO foreign
 * key). An existing Highlight whose note/tags changed is updated in place. Returns creation/update flags.
 */
const upsertHighlight = (
  db: Database.Database,
  container: Readwise.Readwise,
  bookmark: Bookmark.Bookmark,
  highlight: WireHighlight,
): Effect.Effect<{ created: boolean; updated: boolean }, ReadwiseError> =>
  Effect.gen(function* () {
    const existing = yield* findByForeignId<Highlight.Highlight>(db, Highlight.Highlight, highlight.readwiseId);
    if (existing) {
      const changed = contentChanged(existing, highlight);
      if (changed) {
        Obj.update(existing, (draft) => {
          draft.note = highlight.note || undefined;
          draft.tags = [...highlight.tags];
        });
      }
      return { created: false, updated: changed };
    }
    db.add(
      Highlight.make({
        [Obj.Meta]: { keys: [fkFor(highlight.readwiseId)] },
        text: highlight.text,
        note: highlight.note || undefined,
        tags: [...highlight.tags],
        readwiseId: highlight.readwiseId,
        updated: highlight.updated,
        source: Ref.make(bookmark),
        container: Ref.make(container),
      }),
    );
    return { created: true, updated: false };
  });

/**
 * Idempotently captures a batch of Readwise wire highlights as ECHO objects: one `Bookmark` per
 * distinct source document and one `Highlight` per highlight, each related to its source Bookmark and
 * to the `Readwise` account container. Re-running with the same (or a superset of) highlights creates
 * no duplicates; a highlight whose note/tags changed updates the existing Highlight in place.
 */
export const captureHighlights = (
  space: CaptureSpace,
  highlights: readonly WireHighlight[],
): Effect.Effect<CaptureResult, ReadwiseError> =>
  Effect.gen(function* () {
    const { db, container } = space;
    let created = 0;
    let updated = 0;

    const bookmarksBySourceId = new Map<string, Bookmark.Bookmark>();
    for (const highlight of highlights) {
      let bookmark = bookmarksBySourceId.get(highlight.sourceId);
      if (!bookmark) {
        const result = yield* upsertBookmark(db, highlight);
        bookmark = result.bookmark;
        bookmarksBySourceId.set(highlight.sourceId, bookmark);
        if (result.created) {
          created++;
        }
      }
      const highlightResult = yield* upsertHighlight(db, container, bookmark, highlight);
      if (highlightResult.created) {
        created++;
      }
      if (highlightResult.updated) {
        updated++;
      }
    }

    return { created, updated };
  });
```

Note the single boundary cast `results[0] as T | undefined` is carried over from the prior code (untyped `Filter.foreignKeys` result); it is commented and is the only permitted cast here. Verify no others crept in.

- [ ] **Step 4: Run the test to verify it passes**

Run: `moon run plugin-readwise:test -- operations/capture.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Build, lint, cast audit, commit**

```bash
moon run plugin-readwise:build && moon run plugin-readwise:lint
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as'
```
Expected: only the single commented `results[0] as T | undefined` boundary line. Justify it (untyped foreign-key query result) or stop.

```bash
git commit -m "feat(plugin-readwise): capture highlights as Bookmark + Highlight objects

Idempotent upsert: one Bookmark per source document, one Highlight per
highlight, each related to its source and its Readwise account container.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Retarget sync into the binding's container (headless walking skeleton)

This task produces the first end-to-end proof — a Vitest run of the sync operation against a mock transport that lands `Bookmark` + `Highlight` objects and is idempotent. This is the thin end-to-end path, proven before the UI exists (outside-in).

**Files:**
- Modify: `operations/sync.ts`, `operations/sync.test.ts`.

**Interfaces:**
- Consumes: `captureHighlights({ db, container }, highlights)` (Task 4); `ReadwiseOperation.Sync`; `Readwise.instanceOf`; the binding's target is a `Readwise` container (`Relation.getTarget(binding)`).
- Produces: `makeHandler(transportLayer?)` unchanged in signature; the handler now resolves the container from the binding target, captures into it, and returns `{ created, updated }`.

- [ ] **Step 1: Update the sync test to assert Bookmark + Highlight + idempotency**

In `operations/sync.test.ts`, ensure the test: builds a Connection/AccessToken/SyncBinding whose **target is a `Readwise` container**; runs `makeHandler(mockTransport)`'s handler with the preloaded binding ref; asserts `Bookmark` and `Highlight` objects exist afterward and that a second run creates nothing. Model the binding/connection setup on `plugin-inbox`'s sync test and the deleted dev-seed helper. The mock transport returns two synthetic wire highlights sharing one source. Add, at minimum:

```ts
// after first sync:
expect(first.created).toBeGreaterThan(0);
const highlights = await db.query(Query.select(Filter.type(Highlight.Highlight))).run();
expect(highlights.length).toBe(2);
// after second identical sync:
expect(second.created).toBe(0);
```

(Read the current `sync.test.ts` and adapt its existing scaffolding rather than rewriting wholesale.)

- [ ] **Step 2: Run it to verify it fails**

Run: `moon run plugin-readwise:test -- operations/sync.test.ts`
Expected: FAIL — the handler still calls `captureHighlights({ db }, …)` (no container) and asserts on the old capture shape.

- [ ] **Step 3: Rework the capture call in `operations/sync.ts`**

Add imports: `Relation` is already imported from `@dxos/echo`; add `import { Readwise } from '../types';`. Inside the handler, after loading `binding`, resolve and validate the container, and pass it to capture. Replace the success `Effect.gen` block body:

```ts
        const connection = Relation.getSource(binding);
        const container = Relation.getTarget(binding);
        if (!Readwise.instanceOf(container)) {
          return yield* Effect.dieMessage('Sync binding target is not a Readwise container.');
        }

        const outcome = yield* Effect.either(
          Effect.gen(function* () {
            const { highlights } = yield* ReadwiseApi.pipe(
              Effect.flatMap((api) => api.listHighlightsSince(cursor.value)),
            );
            return yield* captureHighlights({ db, container }, highlights);
          }).pipe(
            Effect.provide(dbLayer),
            Effect.provide(ReadwiseCredentials.fromConnection(connection)),
            Effect.provide(ReadwiseApiLayer),
            Effect.provide(transportLayer),
          ),
        );
```

(The `const connection = Relation.getSource(binding);` line already exists; move/keep it here and add the `container` lines. The `ensureTriageBoard` call was removed in Task 2.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `moon run plugin-readwise:test -- operations/sync.test.ts`
Expected: PASS. **This is the headless walking skeleton: connect-config → sync → Bookmark + Highlight, idempotent.**

- [ ] **Step 5: Build, lint, cast audit, commit**

```bash
moon run plugin-readwise:build && moon run plugin-readwise:test && moon run plugin-readwise:lint
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'
git commit -m "feat(plugin-readwise): sync captures into the bound Readwise container

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Connector entry + token credential form + materializeTarget

**Files:**
- Create: `capabilities/connector.ts`, `capabilities/readwise-credential-form.ts`, `operations/materialize-target.ts`.
- Modify: `types/ReadwiseOperation.ts` (add `MaterializeTarget`), `operations/index.ts` (add handler), `capabilities/index.ts` (lazy `Connector`), `services/readwise-api.ts` (add `validateToken`), `constants.ts` (add `READWISE_CONNECTOR_ID`), `ReadwisePlugin.tsx` (wire the Connector module).
- Create test: `capabilities/readwise-credential-form.test.ts`.

**Interfaces:**
- Consumes: `Connector`, `type CredentialForm`, `Connection`, `MaterializeTargetInput`, `MaterializeTargetOutput` from `@dxos/plugin-connector`; `AccessToken` from `@dxos/types`; `proxyFetchLegacy` (via existing `services/readwise-api.ts`).
- Produces:
  - `ReadwiseOperation.MaterializeTarget` (Operation) — input `{ connection: Ref<Connection>, remoteTarget? }`, output `{ target: Ref<Obj.Unknown> }`.
  - `readwiseCredentialForm: CredentialForm<{ token: string }>`.
  - `validateToken(token: string): Effect<void, ReadwiseError>` in `../services`.
  - `READWISE_CONNECTOR_ID = 'readwise'`.
  - Default export of `capabilities/connector.ts`: a `Capability.makeModule` contributing the Readwise `Connector` entry.

- [ ] **Step 1: Add `READWISE_CONNECTOR_ID` and drop `TRIAGE_TAG` from constants**

Replace `constants.ts`:

```ts
//
// Copyright 2026 DXOS.org
//

/** `ConnectorEntry.id` for Readwise; stored as `Connection.connectorId` and used to route sync. */
export const READWISE_CONNECTOR_ID = 'readwise';

/** Base URL for the Readwise REST API. */
export const READWISE_API_BASE = 'https://readwise.io/api/v2';

/** `AccessToken.source` value for Readwise credentials (must be a valid hostname). */
export const READWISE_SOURCE = 'readwise.io';
```

(`TRIAGE_TAG` had one remaining reference in the deleted triage code; confirm `grep -rn TRIAGE_TAG packages/plugins/plugin-readwise/src` returns nothing before removing it.)

- [ ] **Step 2: Add `validateToken` to `services/readwise-api.ts`**

Add an exported function that hits `GET https://readwise.io/api/v2/auth/` through the EDGE CORS proxy (`proxyFetchLegacy`, already imported in this file for `TransportLive.edgeProxy`) with header `Authorization: Token <token>`, failing with a readable `ReadwiseError` on non-2xx. Place it near the other exports:

```ts
/**
 * Validates a Readwise token against `GET /auth/` through the EDGE CORS proxy (Readwise sends no CORS
 * headers, so a direct browser fetch is blocked). Succeeds on 204/200; fails with a readable message
 * on 401 so the credential form can surface it inline.
 */
export const validateToken = (token: string): Effect.Effect<void, ReadwiseError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await proxyFetchLegacy(`${READWISE_API_BASE}/auth/`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Invalid Readwise token.' : `Readwise auth check failed (${response.status}).`);
      }
    },
    catch: (cause) => new ReadwiseError({ message: 'Could not validate the Readwise token.', cause }),
  });
```

Ensure `READWISE_API_BASE` and `proxyFetchLegacy` and `ReadwiseError` are imported in this file (proxyFetchLegacy already is; add the others if missing). Re-export `validateToken` from `services/index.ts`.

- [ ] **Step 3: Write the credential-form test**

Create `capabilities/readwise-credential-form.test.ts`:

```ts
//
// Copyright 2026 DXOS.org
//

import { Effect } from 'effect';
import { describe, test } from 'vitest';

import { Connection } from '@dxos/plugin-connector';

import { readwiseCredentialForm } from './readwise-credential-form';
import { READWISE_CONNECTOR_ID, READWISE_SOURCE } from '../constants';

const connector = { id: READWISE_CONNECTOR_ID, source: READWISE_SOURCE, label: 'Readwise' } as const;

describe('readwiseCredentialForm', () => {
  test('rejects an empty token', ({ expect }) =>
    Effect.gen(function* () {
      const result = yield* Effect.either(readwiseCredentialForm.onValidate!({ values: { token: '   ' }, connector }));
      expect(result._tag).toBe('Left');
    }).pipe(Effect.runPromise));

  test('onSubmit builds an AccessToken + Connection for a Readwise connection', ({ expect }) =>
    Effect.gen(function* () {
      const result = yield* readwiseCredentialForm.onSubmit({ values: { token: 'tok' }, connector, db: undefined as never });
      expect(result.kind).toBe('complete');
      if (result.kind !== 'complete') return;
      expect(result.accessToken.source).toBe(READWISE_SOURCE);
      expect(result.accessToken.token).toBe('tok');
      expect(Connection.instanceOf?.(result.connection) ?? true).toBe(true);
      expect(result.connection.connectorId).toBe(READWISE_CONNECTOR_ID);
    }).pipe(Effect.runPromise));
});
```

Note: `onSubmit` here does not touch `db` (the token/connection are built in memory), so passing `undefined as never` for `db` is a test-only boundary; if `Connection.instanceOf` does not exist, drop that assertion. `onValidate` is NOT exercised here (it performs a network call); the live run (Task 12) covers it.

- [ ] **Step 4: Run it to verify it fails**

Run: `moon run plugin-readwise:test -- capabilities/readwise-credential-form.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Create `capabilities/readwise-credential-form.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { Obj, Ref } from '@dxos/echo';
import { Connection, type CredentialForm } from '@dxos/plugin-connector';
import { AccessToken } from '@dxos/types';

import { READWISE_SOURCE } from '../constants';
import { validateToken } from '../services';

const ReadwiseCredentialFormSchema = Schema.Struct({
  token: Schema.String.annotations({
    title: 'API token',
    description: 'Your Readwise access token (from readwise.io/access_token).',
  }),
});

type ReadwiseCredentialFormValues = Schema.Schema.Type<typeof ReadwiseCredentialFormSchema>;

/**
 * Manual-token connector form for Readwise (no OAuth). Mirrors `plugin-inbox`'s JMAP form: a single
 * secret field, a live validation against `GET /auth/`, and an `onSubmit` that builds the durable
 * `AccessToken` + `Connection`. The connect UI and dialog are provided by the Connector framework.
 */
export const readwiseCredentialForm: CredentialForm<ReadwiseCredentialFormValues> = {
  schema: ReadwiseCredentialFormSchema,
  defaultValues: { token: '' },
  onValidate: ({ values }) =>
    Effect.gen(function* () {
      const token = values.token.trim();
      if (token.length === 0) {
        return yield* Effect.fail(new Error('API token is required.'));
      }
      yield* validateToken(token).pipe(Effect.mapError((error) => new Error(error.message)));
    }),
  onSubmit: ({ values, connector }) =>
    Effect.gen(function* () {
      const token = values.token.trim();
      const accessToken = Obj.make(AccessToken.AccessToken, { source: READWISE_SOURCE, token });
      const connection = Connection.make({
        name: connector.label ?? 'Readwise',
        connectorId: connector.id,
        accessToken: Ref.make(accessToken),
      });
      return { kind: 'complete' as const, accessToken, connection };
    }),
};
```

- [ ] **Step 6: Add `MaterializeTarget` to `types/ReadwiseOperation.ts`**

Add imports `import { MaterializeTargetInput, MaterializeTargetOutput } from '@dxos/plugin-connector';` and append:

```ts
/**
 * Creates the `Readwise` container for a new connection (the Connector framework calls this when
 * connecting without an existing target). Mirrors `plugin-inbox`'s `MaterializeJmapTarget`.
 */
export const MaterializeTarget = Operation.make({
  meta: {
    key: makeKey('materializeTarget'),
    name: 'Create Readwise',
    description: 'Create the Readwise account container for a new connection.',
    icon: 'ph--book-open--regular',
  },
  input: MaterializeTargetInput,
  output: MaterializeTargetOutput,
});
```

- [ ] **Step 7: Create `operations/materialize-target.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Operation } from '@dxos/compute';
import { Database, Obj, Ref } from '@dxos/echo';

import { Readwise, ReadwiseOperation } from '../types';

const handler: Operation.WithHandler<typeof ReadwiseOperation.MaterializeTarget> =
  ReadwiseOperation.MaterializeTarget.pipe(
    Operation.withHandler(
      Effect.fnUntraced(function* ({ connection }) {
        const connectionObj = connection.target;
        const db = connectionObj ? Obj.getDatabase(connectionObj) : undefined;
        if (!connectionObj || !db) {
          return yield* Effect.dieMessage('Connection ref must be preloaded by caller (relation not resolved).');
        }
        return yield* Effect.gen(function* () {
          const created = yield* Database.add(Readwise.make({ name: 'Readwise' }));
          return { target: Ref.make(created) };
        }).pipe(Effect.provide(Database.layer(db)));
      }),
    ),
  );

export default handler;
```

Verify `Database.add` returns an `Effect` here (as in `plugin-inbox`'s materialize-target); if the local `Database` API uses `db.add(...)` synchronously instead, mirror `plugin-inbox/src/operations/jmap/mail/materialize-target.ts:19-39` exactly.

- [ ] **Step 8: Register the materialize handler in the set**

In `operations/index.ts`, extend the handler set:

```ts
export const ReadwiseOperationHandlerSet = OperationHandlerSet.lazy(
  () => import('./sync'),
  () => import('./materialize-target'),
);
```

- [ ] **Step 9: Create `capabilities/connector.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capability } from '@dxos/app-framework';
import { Connector } from '@dxos/plugin-connector';

import { readwiseCredentialForm } from './readwise-credential-form';
import { READWISE_CONNECTOR_ID, READWISE_SOURCE } from '../constants';
import { ReadwiseOperation } from '../types';

/**
 * Contributes the Readwise `Connector` entry: a token credential form (no OAuth), a `materializeTarget`
 * op that creates the `Readwise` container, and the `sync` op. Registered on `SetupConnectors`.
 */
export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    return Capability.contributes(Connector, [
      {
        id: READWISE_CONNECTOR_ID,
        source: READWISE_SOURCE,
        label: 'Readwise',
        credentialForm: readwiseCredentialForm,
        materializeTarget: ReadwiseOperation.MaterializeTarget,
        sync: ReadwiseOperation.Sync,
      },
    ]);
  }),
);
```

- [ ] **Step 10: Add the lazy `Connector` capability handle**

In `capabilities/index.ts` append:

```ts
export const Connector = Capability.lazy('Connector', () => import('./connector'));
```

- [ ] **Step 11: Wire the Connector module in `ReadwisePlugin.tsx`**

Mirror `plugin-inbox/src/InboxPlugin.tsx` (open it for the exact import sources of `Plugin.addModule` and `AppActivationEvents`). Add `Connector` to the `#capabilities` import, then add this module to the `.pipe(...)`:

```tsx
  Plugin.addModule({ activatesOn: AppActivationEvents.SetupConnectors, activate: Connector }),
```

`AppActivationEvents` is imported from the same place `plugin-inbox` imports it (verify: `@dxos/app-framework` or `@dxos/app-toolkit`).

- [ ] **Step 12: Run the credential-form test + build + lint**

Run: `moon run plugin-readwise:test -- capabilities/readwise-credential-form.test.ts && moon run plugin-readwise:build && moon run plugin-readwise:lint`
Expected: test PASS; build 0 errors; lint clean.

- [ ] **Step 13: Cast audit + commit**

```bash
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'
```
Expected: only the test's commented `undefined as never` (test-only boundary). If it appears in non-test source, stop.

```bash
git commit -m "feat(plugin-readwise): connector entry with token credential form + materializeTarget

Onboard via the Connector framework (no OAuth): a single-token credential
form validated against Readwise /auth/, a materializeTarget that creates the
Readwise container, and the sync op wired as the connector's sync.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Make `Readwise` creatable from "+ Add"

**Files:**
- Create: `capabilities/create-object.ts`.
- Modify: `capabilities/index.ts` (lazy `CreateObject`), `ReadwisePlugin.tsx` (wire `addCreateObjectModule`).

**Interfaces:**
- Consumes: `SpaceCapabilities.CreateObjectEntry`, `SpaceOperation.AddObject` from `@dxos/plugin-space`; `Type.getTypename`/`Type.getSchema`; `Readwise.make`.
- Produces: a `CreateObjectEntry` for `Readwise` (id = its typename), wired via `AppPlugin.addCreateObjectModule`.

- [ ] **Step 1: Create `capabilities/create-object.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { Capability } from '@dxos/app-framework';
import { Operation } from '@dxos/compute';
import { Type } from '@dxos/echo';
import { SpaceCapabilities, SpaceOperation } from '@dxos/plugin-space';

import { Readwise } from '../types';

const CreateReadwiseSchema = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.annotations({ title: 'Name' }))),
});

/**
 * Registers `Readwise` as creatable from the navtree "+ Add" menu. Mirrors `plugin-kanban`'s
 * create-object: build the object, then route it into the navtree via `SpaceOperation.AddObject`.
 */
export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    return Capability.contributes(SpaceCapabilities.CreateObjectEntry, {
      id: Type.getTypename(Readwise.Readwise),
      inputSchema: CreateReadwiseSchema,
      createObject: (props: Schema.Schema.Type<typeof CreateReadwiseSchema>, options) =>
        Effect.gen(function* () {
          const object = Readwise.make({ name: props.name });
          return yield* Operation.invoke(SpaceOperation.AddObject, {
            object,
            target: options.target,
            targetNodeId: options.targetNodeId,
          });
        }),
    });
  }),
);
```

Verify the `createObject` callback signature against `plugin-kanban/src/capabilities/create-object.ts` (the `options` type is `{ db, target, targetNodeId? }`); if `props` typing needs the entry's declared generic, match Kanban exactly.

- [ ] **Step 2: Add the lazy `CreateObject` handle**

In `capabilities/index.ts` append:

```ts
export const CreateObject = Capability.lazy('CreateObject', () => import('./create-object'));
```

- [ ] **Step 3: Wire the module in `ReadwisePlugin.tsx`**

Add `CreateObject` to the `#capabilities` import and add to the `.pipe(...)` (mirror `plugin-kanban/src/KanbanPlugin.tsx:18`):

```tsx
  AppPlugin.addCreateObjectModule({ activate: CreateObject }),
```

- [ ] **Step 4: Build + lint + smoke test**

Run: `moon run plugin-readwise:build && moon run plugin-readwise:lint && moon run plugin-readwise:test -- ReadwisePlugin.test.ts`
Expected: build 0 errors; lint clean; the existing plugin smoke test still passes (it activates the plugin; confirm no activation error from the new module).

- [ ] **Step 5: Cast audit + commit**

```bash
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'
git commit -m "feat(plugin-readwise): make Readwise creatable from the + Add menu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Always-reachable Sync toolbar action (app-graph-builder)

**Files:**
- Create: `capabilities/app-graph-builder.ts`.
- Rework: `hooks/useReadwiseSyncBinding.ts` (add a plain selector usable off-React).
- Modify: `capabilities/index.ts` (lazy `AppGraphBuilder`), `translations.ts` (sync label), `ReadwisePlugin.tsx` (wire `addAppGraphModule`).

**Interfaces:**
- Consumes: `AppCapabilities.AppGraphBuilder` (`@dxos/app-toolkit`); `GraphBuilder`, `Node` (`@dxos/plugin-graph`); `SyncBinding` (`@dxos/plugin-connector`); `ReadwiseOperation.Sync`; `Readwise.Readwise`.
- Produces:
  - `selectBindingForTarget(bindings: readonly SyncBinding.SyncBinding[], containerId: string): SyncBinding.SyncBinding | undefined` (exported from `hooks/useReadwiseSyncBinding.ts`).
  - `useReadwiseSyncBinding(db, container): SyncBinding.SyncBinding | undefined` (reworked to select by target === container).
  - Default export of `capabilities/app-graph-builder.ts`: an `app-graph-builder` extension adding a `disposition: 'toolbar'` Sync action to `Readwise` nodes.

- [ ] **Step 1: Rework `hooks/useReadwiseSyncBinding.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

import { useMemo } from 'react';

import { type Database, Filter, Relation } from '@dxos/echo';
import { SyncBinding } from '@dxos/plugin-connector';
import { useQuery } from '@dxos/react-client/echo';

import { type Readwise } from '../types';

/** Selects the `SyncBinding` whose target is the given container, if one exists. */
export const selectBindingForTarget = (
  bindings: readonly SyncBinding.SyncBinding[],
  containerId: string,
): SyncBinding.SyncBinding | undefined =>
  bindings.find((binding) => Relation.getTarget(binding).id === containerId);

/** React hook: the `SyncBinding` bound to `container` in `db`, or undefined when not yet connected. */
export const useReadwiseSyncBinding = (
  db: Database.Database | undefined,
  container: Readwise.Readwise | undefined,
): SyncBinding.SyncBinding | undefined => {
  const bindings = useQuery(db, Filter.type(SyncBinding.SyncBinding));
  return useMemo(
    () => (container ? selectBindingForTarget(bindings, container.id) : undefined),
    [bindings, container?.id],
  );
};
```

- [ ] **Step 2: Add the sync-label translation**

In `translations.ts`, add under the plugin's namespace object a key `'sync.label': 'Sync'` (and `'connect.label': 'Connect Readwise'`, `'empty.message': 'Connect a Readwise account to see your highlights.'` used in Task 9). Match the existing translations structure in the file.

- [ ] **Step 3: Create `capabilities/app-graph-builder.ts`**

```tsx
//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capability } from '@dxos/app-framework';
import { AppCapabilities } from '@dxos/app-toolkit';
import { Operation } from '@dxos/compute';
import { Filter, Obj, Query, Ref } from '@dxos/echo';
import { invariant } from '@dxos/invariant';
import { SyncBinding } from '@dxos/plugin-connector';
import { GraphBuilder, Node } from '@dxos/plugin-graph';

import { selectBindingForTarget } from '../hooks';
import { meta } from '#meta';
import { Readwise, ReadwiseOperation } from '../types';

/**
 * Adds an always-reachable "Sync" toolbar action to every `Readwise` node — independent of any open
 * view. When the account is connected (a `SyncBinding` targets it), the action invokes `Sync`;
 * otherwise it is a no-op (the empty-state connect affordance handles first connection).
 */
export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    const extension = yield* GraphBuilder.createTypeExtension({
      id: 'readwiseSync',
      type: Readwise.Readwise,
      actions: (readwise: Readwise.Readwise) =>
        Effect.succeed([
          Node.makeAction({
            id: `${meta.profile.key}/sync`,
            data: () =>
              Effect.gen(function* () {
                const db = Obj.getDatabase(readwise);
                invariant(db, 'Readwise container has no database.');
                const bindings = yield* Effect.tryPromise(() =>
                  db.query(Query.select(Filter.type(SyncBinding.SyncBinding))).run(),
                );
                const binding = selectBindingForTarget(bindings, readwise.id);
                if (!binding) {
                  return; // not connected yet
                }
                yield* Operation.invoke(ReadwiseOperation.Sync, { binding: Ref.make(binding) }, { spaceId: db.spaceId });
              }),
            properties: {
              label: ['sync.label', { ns: meta.profile.key }],
              icon: 'ph--arrows-clockwise--regular',
              disposition: 'toolbar',
            },
          }),
        ]),
    });
    return Capability.contributes(AppCapabilities.AppGraphBuilder, [extension]);
  }),
);
```

Verify `GraphBuilder.createTypeExtension`'s `actions` callback signature and `Node.makeAction`'s shape against `plugin-assistant/src/capabilities/app-graph-builder.ts:66-88`. Confirm `selectBindingForTarget` is re-exported from `hooks/index.ts` (add it if the barrel only exports the hook).

- [ ] **Step 4: Add the lazy `AppGraphBuilder` handle**

In `capabilities/index.ts` append:

```ts
export const AppGraphBuilder = Capability.lazy('AppGraphBuilder', () => import('./app-graph-builder'));
```

- [ ] **Step 5: Wire the module in `ReadwisePlugin.tsx`**

Mirror `plugin-inbox/src/InboxPlugin.tsx:30-33` for the exact `activatesOn` symbols (`allOf`, `SetupAppGraph`, `AttentionReady`) and their import sources. Add `AppGraphBuilder` to the `#capabilities` import and add:

```tsx
  AppPlugin.addAppGraphModule({ activatesOn: allOf(SetupAppGraph, AttentionReady), activate: AppGraphBuilder }),
```

- [ ] **Step 6: Build + lint**

Run: `moon run plugin-readwise:build && moon run plugin-readwise:lint && moon run plugin-readwise:test`
Expected: build 0 errors; lint clean; tests pass.

- [ ] **Step 7: Cast audit + commit**

```bash
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'
git commit -m "feat(plugin-readwise): always-reachable Sync toolbar action via app-graph-builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Browse view — grouping logic + container/card/detail surfaces

**Files:**
- Create: `operations/browse-query.ts`, `operations/browse-query.test.ts`.
- Create: `containers/ReadwiseContainer/{ReadwiseContainer.tsx,index.ts}`, `containers/HighlightCard/{HighlightCard.tsx,index.ts}`, `containers/HighlightDetail/{HighlightDetail.tsx,index.ts}`.
- Modify: `containers/index.ts`, `capabilities/react-surface.tsx`.

**Interfaces:**
- Consumes: `Highlight.Highlight`, `Readwise.Readwise`, `Bookmark.Bookmark`; `AppSurface.object`, `AppSurface.Article`, `AppSurface.CardContent` (`@dxos/app-toolkit/ui`); `Surface.create`, `Surface.Surface` (`@dxos/app-framework/ui`); `ConnectorAuth` (`@dxos/plugin-connector`); `useReadwiseSyncBinding` (Task 8).
- Produces:
  - `latestUpdated(updated: readonly string[]): string` and `orderGroups<T extends { latestUpdated: string }>(groups: readonly T[]): T[]` in `browse-query.ts`.
  - `buildSourceGroups(highlights: readonly Highlight.Highlight[]): SourceGroup[]` where `SourceGroup = { source: Bookmark.Bookmark; highlights: readonly Highlight.Highlight[]; latestUpdated: string }`, groups ordered most-recent-source-first, highlights within a group ordered `updated` desc.
  - Three surfaces: `readwiseContainer` (Article/`Readwise`), `highlightCard` (CardContent/`Highlight`), `highlightDetail` (Article/`Highlight`).

- [ ] **Step 1: Write the browse-query test**

Create `operations/browse-query.test.ts`:

```ts
//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { latestUpdated, orderGroups } from './browse-query';

describe('browse-query ordering', () => {
  test('latestUpdated returns the max ISO string', ({ expect }) => {
    expect(latestUpdated(['2026-07-01T00:00:00Z', '2026-07-03T00:00:00Z', '2026-06-01T00:00:00Z'])).toBe('2026-07-03T00:00:00Z');
    expect(latestUpdated([])).toBe('');
  });

  test('orderGroups sorts most-recent-first', ({ expect }) => {
    const groups = [
      { id: 'a', latestUpdated: '2026-07-01T00:00:00Z' },
      { id: 'b', latestUpdated: '2026-07-05T00:00:00Z' },
      { id: 'c', latestUpdated: '2026-07-03T00:00:00Z' },
    ];
    expect(orderGroups(groups).map((g) => g.id)).toEqual(['b', 'c', 'a']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `moon run plugin-readwise:test -- operations/browse-query.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `operations/browse-query.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

import { type Bookmark } from '@dxos/plugin-bookmarks';

import { type Highlight } from '../types';

export interface SourceGroup {
  readonly source: Bookmark.Bookmark;
  readonly highlights: readonly Highlight.Highlight[];
  readonly latestUpdated: string;
}

/** The maximum (most recent) ISO timestamp in `updated`, or '' when empty. */
export const latestUpdated = (updated: readonly string[]): string =>
  updated.reduce((max, value) => (value > max ? value : max), '');

/** Orders items by `latestUpdated`, most recent first. Stable, non-mutating. */
export const orderGroups = <T extends { latestUpdated: string }>(groups: readonly T[]): T[] =>
  [...groups].sort((a, b) => (a.latestUpdated < b.latestUpdated ? 1 : a.latestUpdated > b.latestUpdated ? -1 : 0));

/**
 * Groups highlights under their source `Bookmark`, ordering sources most-recently-active first and
 * highlights within a source `updated`-descending. Highlights whose `source` ref is unresolved are
 * skipped (they render once the ref hydrates).
 */
export const buildSourceGroups = (highlights: readonly Highlight.Highlight[]): SourceGroup[] => {
  const bySource = new Map<string, { source: Bookmark.Bookmark; highlights: Highlight.Highlight[] }>();
  for (const highlight of highlights) {
    const source = highlight.source.target;
    if (!source) {
      continue;
    }
    const entry = bySource.get(source.id) ?? { source, highlights: [] };
    entry.highlights.push(highlight);
    bySource.set(source.id, entry);
  }
  const groups = [...bySource.values()].map(({ source, highlights: hs }) => ({
    source,
    highlights: orderGroups(hs.map((h) => ({ ...h, latestUpdated: h.updated }))).map((h) => h as unknown as Highlight.Highlight),
    latestUpdated: latestUpdated(hs.map((h) => h.updated)),
  }));
  return orderGroups(groups);
};
```

Note: the inner `orderGroups(hs.map(...))` spread creates throwaway sort keys; if that introduces a cast, prefer sorting the highlights directly with a small comparator instead:

```ts
    highlights: [...hs].sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0)),
```

Use that comparator form (no cast) rather than the `as unknown as` shown above — the `as unknown as` line is a deliberately-flagged anti-example; **do not ship it**. The final file must contain the comparator form and zero casts.

- [ ] **Step 4: Run the test to verify it passes**

Run: `moon run plugin-readwise:test -- operations/browse-query.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `containers/HighlightCard/HighlightCard.tsx`**

A card matching the approved mock (`highlights-grouped-v2.html`): passage with a left highlight rule, note (only if present), tag chips, an inert processing-state dot, and an inert "→ where it's processed" affordance.

```tsx
//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { type Highlight } from '../../types';

export type HighlightCardProps = {
  readonly subject: Highlight.Highlight;
  readonly role?: string;
};

/**
 * One highlight card: passage + source-agnostic content (the source header is rendered by the
 * container). The processing-state dot and the forward affordance are INERT in Inc 1 — reserved
 * placeholders that Inc 2 activates.
 */
export const HighlightCard = ({ subject }: HighlightCardProps) => {
  const state = subject.processingState ?? 'none';
  return (
    <div className='grid grid-cols-[20px_1fr] gap-2 items-start rounded border border-neutral-200 dark:border-neutral-700 p-2 mbe-2'>
      {/* Reserved (Inc 2): processing-state dot. Inert. */}
      <div
        aria-hidden
        data-processing-state={state}
        className='is-3 bs-3 mbs-1 rounded-full border border-dashed border-violet-400'
      />
      <div className='min-is-0'>
        <p className='border-is-2 border-amber-400 pis-2 text-sm'>{subject.text}</p>
        {subject.note && (
          <p className='mlb-1 rounded bg-amber-50 dark:bg-amber-950 px-2 py-1 text-xs text-amber-900 dark:text-amber-200'>
            {subject.note}
          </p>
        )}
        <div className='flex items-center gap-2 flex-wrap mbs-1'>
          {subject.tags.map((tag) => (
            <span key={tag} className='rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 text-xs'>
              #{tag}
            </span>
          ))}
          {/* Reserved (Inc 2): forward link to where the highlight is processed. Inert. */}
          <span aria-hidden className='mis-auto rounded-full border border-dashed border-violet-400 px-2 text-xs text-violet-500'>
            → not yet processed
          </span>
        </div>
      </div>
    </div>
  );
};
```

Create `containers/HighlightCard/index.ts`:

```ts
//
// Copyright 2026 DXOS.org
//

export * from './HighlightCard';
```

Note on styles: use the project's Tailwind logical-property utilities (`is-`, `bs-`, `mbe-`, `pis-`, `mis-auto`) consistent with other plugins; if a class name differs from the local convention, match a sibling plugin's card component. This card is verified visually in Task 12, not by a unit test.

- [ ] **Step 6: Create `containers/HighlightDetail/HighlightDetail.tsx`**

```tsx
//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { type Highlight } from '../../types';

export type HighlightDetailProps = {
  readonly subject: Highlight.Highlight;
  readonly role?: string;
  readonly attendableId?: string;
};

/** Full detail for one highlight: passage, note, tags, and a link to the source document. */
export const HighlightDetail = ({ subject }: HighlightDetailProps) => {
  const source = subject.source.target;
  return (
    <div className='p-4 max-is-[60rem] mli-auto'>
      <p className='border-is-2 border-amber-400 pis-3 text-base'>{subject.text}</p>
      {subject.note && <p className='mlb-3 rounded bg-amber-50 dark:bg-amber-950 p-3 text-sm'>{subject.note}</p>}
      <div className='flex items-center gap-2 flex-wrap mbs-3'>
        {subject.tags.map((tag) => (
          <span key={tag} className='rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 text-xs'>
            #{tag}
          </span>
        ))}
      </div>
      {source && (
        <a href={source.url} target='_blank' rel='noreferrer' className='inline-block mbs-4 text-sm text-primary-500 underline'>
          {source.title || source.url}
        </a>
      )}
    </div>
  );
};
```

Create `containers/HighlightDetail/index.ts` re-exporting it (same shape as Step 5's index).

- [ ] **Step 7: Create `containers/ReadwiseContainer/ReadwiseContainer.tsx`**

Renders the empty-state connect affordance when not connected, else the grouped-by-source browse list.

```tsx
//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Surface } from '@dxos/app-framework/ui';
import { Filter, Obj, Ref } from '@dxos/echo';
import { ConnectorAuth } from '@dxos/plugin-connector';
import { useQuery } from '@dxos/react-client/echo';
import { useTranslation } from '@dxos/react-ui';

import { HighlightCard } from '../HighlightCard';
import { buildSourceGroups } from '../../operations/browse-query';
import { meta } from '#meta';
import { READWISE_CONNECTOR_ID } from '../../constants';
import { useReadwiseSyncBinding } from '../../hooks';
import { Highlight, type Readwise } from '../../types';

export type ReadwiseContainerProps = {
  readonly subject: Readwise.Readwise;
  readonly role?: string;
  readonly attendableId?: string;
};

export const ReadwiseContainer = ({ subject }: ReadwiseContainerProps) => {
  const { t } = useTranslation(meta.profile.key);
  const db = Obj.getDatabase(subject);
  const binding = useReadwiseSyncBinding(db, subject);
  const allHighlights = useQuery(db, Filter.type(Highlight.Highlight));
  const highlights = allHighlights.filter((highlight) => highlight.container.target?.id === subject.id);

  if (!binding) {
    return (
      <div className='flex flex-col items-center justify-center bs-full gap-3 p-8 text-center'>
        <p className='text-sm text-neutral-500'>{t('empty.message')}</p>
        <Surface.Surface
          type={ConnectorAuth}
          data={{ connectorIds: [READWISE_CONNECTOR_ID], existingTarget: Ref.make(subject) }}
          limit={1}
        />
      </div>
    );
  }

  const groups = buildSourceGroups(highlights);
  return (
    <div className='p-3 max-is-[60rem] mli-auto'>
      {groups.map((group) => (
        <section key={group.source.id} className='mbe-4'>
          <header className='flex items-center gap-2 pbe-1 mbe-2 border-be border-neutral-200 dark:border-neutral-700 text-sm font-medium'>
            <span>{group.source.title || group.source.url}</span>
            <span className='text-xs text-neutral-500'>· {group.highlights.length}</span>
          </header>
          <div className='pis-4'>
            {group.highlights.map((highlight) => (
              <HighlightCard key={highlight.id} subject={highlight} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
```

Create `containers/ReadwiseContainer/index.ts` re-exporting it.

Verify: `useTranslation` from `@dxos/react-ui` (match a sibling plugin's import), and `Surface.Surface` usage for `ConnectorAuth` against `plugin-inbox/src/components/Initialize/InitializeAction.tsx:46,61-63`. `Obj.getDatabase(subject)` returns the space db for `useQuery`.

- [ ] **Step 8: Update `containers/index.ts`**

```ts
//
// Copyright 2026 DXOS.org
//

export * from './HighlightCard';
export * from './HighlightDetail';
export * from './ReadwiseContainer';
```

- [ ] **Step 9: Register the three surfaces in `capabilities/react-surface.tsx`**

```tsx
//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import React from 'react';

import { Capabilities, Capability } from '@dxos/app-framework';
import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';

import { HighlightCard, HighlightDetail, ReadwiseContainer } from '#containers';
import { Highlight, Readwise } from '../types';

export default Capability.makeModule(() =>
  Effect.succeed(
    Capability.contributes(Capabilities.ReactSurface, [
      Surface.create({
        id: 'readwiseContainer',
        filter: AppSurface.object(AppSurface.Article, Readwise.Readwise),
        component: ({ data, role }) => (
          <ReadwiseContainer role={role} subject={data.subject} attendableId={data.attendableId} />
        ),
      }),
      Surface.create({
        id: 'highlightDetail',
        filter: AppSurface.object(AppSurface.Article, Highlight.Highlight),
        component: ({ data, role }) => (
          <HighlightDetail role={role} subject={data.subject} attendableId={data.attendableId} />
        ),
      }),
      Surface.create({
        id: 'highlightCard',
        filter: AppSurface.object(AppSurface.CardContent, Highlight.Highlight),
        component: ({ data, role }) => <HighlightCard role={role} subject={data.subject} />,
      }),
    ]),
  ),
);
```

Match the `Surface.create` shape to `plugin-bookmarks/src/capabilities/react-surface.tsx:15-32`.

- [ ] **Step 10: Build + lint + test**

Run: `moon run plugin-readwise:build && moon run plugin-readwise:lint && moon run plugin-readwise:test`
Expected: build 0 errors; lint clean; all tests pass.

- [ ] **Step 11: Cast audit + commit**

```bash
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'
```
Expected: `no casts` (the `as unknown as` anti-example from Step 3 must NOT be present).

```bash
git commit -m "feat(plugin-readwise): browse highlights grouped by source + card/detail surfaces

Article surface renders the empty-state connect affordance when unconnected,
else highlights grouped under their source (most-recently-active first).
CardContent renders a highlight card with inert processing dot + forward hook.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Plugin-wiring verification pass

A consolidation gate — no new behavior, just confirm every module is wired and the plugin activates cleanly.

**Files:**
- Verify (and fix if needed): `ReadwisePlugin.tsx`, `capabilities/index.ts`.

**Interfaces:**
- Consumes: all capabilities wired in Tasks 6–9.

- [ ] **Step 1: Confirm the full module list**

Read `ReadwisePlugin.tsx`. Confirm the `.pipe(...)` contains, in a sensible order: `addSchemaModule({ schema: [Readwise.Readwise, Highlight.Highlight, Bookmark.Bookmark] })`, `addOperationHandlerModule`, `addCreateObjectModule`, `addAppGraphModule`, `Plugin.addModule({ activatesOn: AppActivationEvents.SetupConnectors, activate: Connector })`, `addSurfaceModule`, `addPluginAssetModule`, `addTranslationsModule`, `Plugin.make`. If any is missing, add it (mirroring the precedent already used in its task).

- [ ] **Step 2: Extend the plugin smoke test**

In `ReadwisePlugin.test.ts`, add an assertion that the plugin activates without error and that the `Readwise` and `Highlight` schemas are registered (mirror the existing schema-activation assertion pattern in the file — it already checks schema activation for the reused types; update it to the new types).

- [ ] **Step 3: Build + test + lint**

Run: `moon run plugin-readwise:build && moon run plugin-readwise:test && moon run plugin-readwise:lint`
Expected: all green.

- [ ] **Step 4: Commit (if any wiring changed)**

```bash
git add -A packages/plugins/plugin-readwise
git diff --cached | grep -nE '\bas (any|unknown|[A-Z])|as unknown as' || echo 'no casts'
git commit -m "chore(plugin-readwise): verify Inc-1 module wiring + smoke test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(If nothing changed, skip the commit and note it.)

---

### Task 11: Register plugin-readwise in composer-app

Out-of-package, so it gets its own `chore(composer-app):` commit (per Global Constraints and the user's scope rule — approved for this increment).

**Files:**
- Modify: `packages/apps/composer-app/src/plugin-defs.tsx` (import + register `ReadwisePlugin`), `packages/apps/composer-app/package.json` (add `@dxos/plugin-readwise` as `workspace:*`), `packages/apps/composer-app/tsconfig.json` (add the project reference if the file lists per-package references), `pnpm-lock.yaml` (regenerated).

**Interfaces:**
- Consumes: `ReadwisePlugin` from `@dxos/plugin-readwise`.

- [ ] **Step 1: Add the workspace dependency**

Run: `pnpm add --filter @dxos/composer-app @dxos/plugin-readwise@workspace:*`
Expected: `package.json` gains `"@dxos/plugin-readwise": "workspace:*"`; `pnpm-lock.yaml` updates. (Confirm the composer-app package name with `grep '"name"' packages/apps/composer-app/package.json` — use it in the `--filter`.)

- [ ] **Step 2: Register the plugin in `plugin-defs.tsx`**

Add an import alongside the other plugin imports and register `ReadwisePlugin` in the same place the manual-test edit did (the earlier reverted edit added it at the import list, the plugin id map, and the instantiation list). Follow the exact pattern of a neighboring plugin (e.g. `plugin-bookmarks` or `plugin-inbox`) in that file — import, add to the keyed record, and instantiate in the plugins array.

- [ ] **Step 3: Add the tsconfig project reference (if applicable)**

If `packages/apps/composer-app/tsconfig.json` lists explicit `references`, add `{ "path": "../../plugins/plugin-readwise" }` in sorted position. If it uses a glob / solution style with no per-package references, leave it.

- [ ] **Step 4: Build composer-app**

Run: `moon run composer-app:build`
Expected: builds with plugin-readwise included (0 errors). If the build reveals a missing export or type mismatch at the integration boundary, fix it in the plugin (not by casting).

- [ ] **Step 5: Commit**

```bash
git add packages/apps/composer-app/package.json packages/apps/composer-app/src/plugin-defs.tsx packages/apps/composer-app/tsconfig.json pnpm-lock.yaml
git commit -m "chore(composer-app): register plugin-readwise

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Live walking-skeleton acceptance run (the increment's gate)

The headline acceptance from spec §6: prove the user journey in the running app. This is a manual/preview-driven verification, not a code commit — but it is the gate the increment must pass. The Readwise token is supplied by the user out-of-band and entered only into the running app (never committed).

**Files:** none (verification only). Produces screenshots for the user (remote — attach visual proof).

- [ ] **Step 1: Start composer-app**

Use the preview tooling to start the composer-app dev server (`moon run composer-app:serve`, port 5173) or the project's `.claude/launch.json` config. Confirm it loads with no console errors.

- [ ] **Step 2: Create a Readwise from "+ Add"** (AC 1)

In a space, open "+ Add"; confirm **"Readwise"** is offered; create one; confirm it opens. Screenshot.

- [ ] **Step 3: Empty-state connect** (AC 2)

Confirm the opened `Readwise` shows a **"Connect Readwise"** affordance (not blank). Screenshot.

- [ ] **Step 4: Connect with a token** (AC 3)

Click connect; enter the user-supplied token in the credential dialog; submit. Confirm the connection is established (no OAuth) and the first sync begins. If validation fails, inspect console/network (the EDGE proxy call to `readwise.io/api/v2/auth/`) and fix the root cause.

- [ ] **Step 5: Browse grouped by source** (AC 4)

Confirm highlights appear **grouped under their source, most-recently-active source first**, each card showing passage + source (linked) + note (only if present) + tags, plus the inert dot + inert forward affordance. Screenshot.

- [ ] **Step 6: Re-sync recency bump + idempotency** (AC 5)

Trigger the toolbar **Sync** again. Confirm no duplicates appear. (If the account gains a highlight between runs, confirm its source bumps to the top.) Screenshot.

- [ ] **Step 7: Open a highlight** (AC 6, 7)

Open a highlight card; confirm the detail shows full passage + note + source link; confirm the card's inert dot + forward affordance render. Screenshot.

- [ ] **Step 8: Record the result**

Attach the screenshots for the user. If every AC passed, note the increment's acceptance gate as GREEN in `.superpowers/sdd/progress.md`. If any failed, file the failure, fix at root cause in the plugin, re-run from the failed step.

---

### Task 13: PLUGIN.mdl req/test blocks

**Files:**
- Modify: `PLUGIN.mdl`.

**Interfaces:** documentation only.

- [ ] **Step 1: Read the current PLUGIN.mdl structure**

Run: `sed -n '1,80p' packages/plugins/plugin-readwise/PLUGIN.mdl`
Expected: existing feat/req/test blocks (some describing the removed triage flow — those must be replaced, per canon-partition, not appended to).

- [ ] **Step 2: Replace triage-era feats with Inc-1 feats + reqs at user-behavior altitude**

Author `feat`/`req`/`test` blocks mapping to the acceptance criteria (spec §2), written at user-observable altitude (no field names, no DOM selectors, no file paths). One `req` per AC, using the `given:`/`and:`/`when:`/`then:` multi-line form. Example:

```
req R-1.connect
  given: a space with a Readwise that has no connection
  and: the Readwise plugin is enabled
  when: the user opens the Readwise
  then: a "Connect Readwise" affordance is shown, not a blank pane

req R-1.browse
  given: a connected Readwise with synced highlights
  when: the user views it
  then: highlights appear grouped under their source document
  and: the most-recently-active source is listed first
  and: each card shows the passage, the source (linked), the note when present, and tags
```

Add `test T-N` blocks referencing the automated tests where they map (capture idempotency → the capture test; grouping/recency → the browse-query test; connect form → the credential-form test), and mark the live-run ACs as covered by the Task 12 walking-skeleton run. Remove every mention of triage/decompose/confirm/board from PLUGIN.mdl.

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/plugin-readwise/PLUGIN.mdl
git commit -m "docs(plugin-readwise): PLUGIN.mdl reqs/tests for Inc 1 (connect, sync, browse)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 14: Retire superseded docs + refresh EXTRACTION.md

**Files:**
- Delete: `docs/superpowers/specs/2026-07-04-readwise-annotation-triage-design.md` and its plan (find with `ls docs/superpowers/{specs,plans}/2026-07-04-readwise*`).
- Modify: `packages/plugins/plugin-readwise/EXTRACTION.md` (refresh the runtime-dependency surface — Inc 1 removed `@dxos/plugin-kanban` and the `Task`/`Message` usage; add `@dxos/plugin-connector` if newly load-bearing at runtime; the `Bookmark`/`@dxos/plugin-bookmarks` unpublished caveat still stands).

**Interfaces:** documentation only.

- [ ] **Step 1: Confirm the superseded docs and delete them**

Run: `ls docs/superpowers/specs/2026-07-04-readwise* docs/superpowers/plans/2026-07-04-readwise* 2>/dev/null`
Then `git rm` each. These are superseded by the `2026-07-05-readwise-roadmap.md` + this plan (canon-partition: they leave the tree; git history retains them).

- [ ] **Step 2: Refresh EXTRACTION.md's dependency surface**

Update the runtime-dependency section of `EXTRACTION.md` to reflect Inc 1: the bundled `@dxos/plugin-*` runtime deps are now `@dxos/plugin-bookmarks` (still unpublished — the extraction blocker) and `@dxos/plugin-connector`; `@dxos/plugin-kanban` is no longer a runtime dep (triage board removed). Do not describe the removed triage code.

- [ ] **Step 3: Grep for stale references to removed names**

Run: `grep -rniE 'triage|decompose|kanban' packages/plugins/plugin-readwise/src packages/plugins/plugin-readwise/PLUGIN.mdl packages/plugins/plugin-readwise/EXTRACTION.md`
Expected: no results (or only justified ones). Scrub any leftover in this same task.

- [ ] **Step 4: Commit**

```bash
git add -A packages/plugins/plugin-readwise/EXTRACTION.md
git add -A docs/superpowers
git commit -m "docs(plugin-readwise): retire superseded triage design; refresh extraction deps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage (spec §2 ACs → tasks):**
- Creatable "+ Add" → Task 7; opens → Task 9 (Article surface) + Task 12.
- Empty-state connect → Task 9 (ConnectorAuth) + Task 6 (connector entry) + Task 12.
- Token connect, no OAuth, first sync → Task 6 (form) + Task 12.
- Grouped, recency-sorted browse → Task 9 (browse-query + container) + Task 12.
- Recency bump → Task 9 (orderGroups) + Task 12.
- Idempotent → Task 4 (capture dedup) + Task 5 (sync test) + Task 12.
- Openable highlight → Task 9 (HighlightDetail) + Task 12.
- Inert hooks (dot + forward) → Task 3 (reserved field) + Task 9 (card) + Task 12.
- Green in app; build/test/lint → every task's gate + Task 12.
- Onboarding via Connector framework → Task 6. Creatable via CreateObjectEntry → Task 7. Sync via app-graph-builder → Task 8. Article/CardContent surfaces → Task 9. Traceability reserved (no forward field; reverse-query) → Task 3. Reconcile uncommitted (nextPageCursor keep; dev-seed/composer revert) → Task 1. Retire old docs → Task 14.

**Placeholder scan:** No "TBD"/"implement later". The one intentional anti-example (`as unknown as` in Task 9 Step 3) is explicitly flagged "do not ship it" with the correct comparator form given.

**Type consistency:** `captureHighlights({ db, container }, highlights)` and `CaptureResult { created, updated }` are used identically in Tasks 4, 5. `ReadwiseOperation.Sync` output `{ created, updated }` (Task 2) matches `CaptureResult` (Task 4). `selectBindingForTarget(bindings, containerId)` defined in Task 8, consumed in Tasks 8 (graph) and 9 (container via the hook). `READWISE_CONNECTOR_ID` defined in Task 6, used in Tasks 6, 9. Surface roles `AppSurface.Article`/`AppSurface.CardContent` consistent Task 9. `Readwise.instanceOf` (Task 3) used in Task 5.

**Known verification points handed to implementers (cited precedents, to confirm against `main` at build time):** the exact import sources for plugin-wiring symbols (`Plugin.addModule`, `AppActivationEvents`, `allOf`, `SetupAppGraph`, `AttentionReady`) — mirror `plugin-inbox/src/InboxPlugin.tsx`; `GraphBuilder.createTypeExtension`/`Node.makeAction` shapes — mirror `plugin-assistant`; `Database.add` vs `db.add` in materialize-target — mirror `plugin-inbox`; `Surface.Surface` + `ConnectorAuth` usage — mirror `plugin-inbox/src/components/Initialize/InitializeAction.tsx`; Tailwind logical-property class names — mirror a sibling plugin card.
