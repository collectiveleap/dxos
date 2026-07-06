# plugin-sensemaking — Increment 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first slice of the horizontal Workbench — a new `plugin-sensemaking` where synced Readwise highlights appear as flagged **Captures** in an **Inbox** clustered by referent, which the user **triages by hand** into **to-do / question / connect** results, each traceable back to its capture.

**Architecture:** A new horizontal `plugin-sensemaking` owns the source-agnostic spine (`Capture` envelope, `Result`, the `ConnectedTo`/`DerivedFrom` relations, the Inbox surface + manual triage). `plugin-readwise` becomes a **feeder**: on sync it idempotently creates one `Capture` per `Highlight` (denormalizing the referent Bookmark onto the capture) and its account view shrinks to connect/sync/status. The Inbox renders each Readwise capture via the already-registered `HighlightCard` `CardContent` surface (no cross-plugin import). Dependency direction: `plugin-readwise` → `plugin-sensemaking`.

**Tech Stack:** DXOS ECHO (`Type.makeObject`, `Type.makeRelation`, `Relation.make`, `Query.select(...).sourceOf/targetOf`), Effect-TS, `@dxos/app-framework`/`@dxos/app-toolkit` plugin modules, React + TailwindCSS, vitest + `@dxos/plugin-testing/harness`.

## Global Constraints

- **New package:** `plugin-sensemaking` MUST set `"private": true` in `package.json`. All in-repo `@dxos/*` deps are `"workspace:*"` (never catalog); external deps use `"catalog:"`.
- **No ECHO-core changes.** `plugin-sensemaking` is a strict layer above `@dxos/echo`/`@dxos/types`; never edit core schemas/annotations/helpers. Adding plugin-local ECHO types is fine.
- **No casts** (`as any`, `as unknown as T`, `as T` to silence, non-null `!`). `as const` is allowed. Fix types at the source; a cast at a genuine boundary needs a one-line justifying comment.
- **DXOS style:** single quotes, arrow functions, functional style, React named imports (`useCallback`, not `React.useCallback`), barrel imports, no default exports **except** capability files (`export default Capability.makeModule(...)`) and the `*Plugin.tsx` default export (mirror plugin-readwise). Namespace-per-type in `types/` (`export * as Capture from './Capture'`).
- **Comments state the invariant**, not the history; JSDoc on public functions; comments end with a period.
- **Reqs/acceptance at user-behavior altitude** (no field names/DOM selectors in scenario bodies).
- **Build/test/lint gate per task:** `moon run plugin-sensemaking:build` (and `plugin-readwise:build` for feeder tasks) must be 0 errors; `:test` green; `:lint` 0. The `DEPOT_TOKEN` warning is expected — ignore it.
- **Commits** authored `Steve Sanderson <296+Steve@users.noreply.github.com>` with trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Solo work — **no PR**.
- **Grounding reference** (exact templates + cited APIs): `.superpowers/sdd/sensemaking-plan-reference.md`. Every scaffold/API shape below is drawn from it; when a step says "mirror plugin-readwise's X", that file has the exact source.
- **Plugin id:** `org.dxos.plugin.sensemaking`. **Type DXNs:** `org.dxos.type.capture`, `org.dxos.type.result` (v0.1.0); **relation DXNs:** `org.dxos.relation.derivedFrom`, `org.dxos.relation.connectedTo` (v0.1.0).

---

## File Structure

**New package `packages/plugins/plugin-sensemaking/`:**
- `package.json`, `moon.yml`, `tsconfig.json`, `dx.config.ts` — scaffold (mirror plugin-readwise).
- `src/index.ts` — top barrel (`export * from './meta'` + constants).
- `src/meta.ts` — `Plugin.getMetaFromConfig(config)`.
- `src/plugin.ts` — re-export `SensemakingPlugin` for the `#plugin` subpath.
- `src/SensemakingPlugin.tsx` — the `Plugin.define(meta).pipe(...)` module list.
- `src/translations.ts` — locale-keyed UI strings + type labels.
- `src/constants.ts` — foreign-key source + node-type constants.
- `src/types/{index.ts, Capture.ts, Result.ts, DerivedFrom.ts, ConnectedTo.ts, SensemakingOperation.ts}`.
- `src/capabilities/{index.ts, react-surface.tsx, operation-handler.ts, app-graph-builder.ts}`.
- `src/containers/{index.ts, Inbox/Inbox.tsx, Inbox/index.ts}`.
- `src/operations/{cluster.ts, cluster.test.ts}`.
- `src/SensemakingPlugin.test.ts` — smoke test.

**Modified `packages/plugins/plugin-readwise/`:**
- `package.json` — add `@dxos/plugin-sensemaking: workspace:*`; `tsconfig.json` — add its project reference.
- `src/operations/capture.ts` (+ `capture.test.ts`) — after capturing highlights, upsert one `Capture` per `Highlight`.
- `src/containers/ReadwiseContainer/ReadwiseContainer.tsx` — shrink to connect/sync/status.

**Modified `packages/apps/composer-app/`:**
- `src/plugin-defs.tsx` — import, default-id list, instantiation (its own `chore(composer-app):` commit).

---

## Task 1: Scaffold the plugin + smoke test (walking skeleton)

**Files:**
- Create: the scaffold files above (`package.json`, `moon.yml`, `tsconfig.json`, `dx.config.ts`, `src/index.ts`, `src/meta.ts`, `src/plugin.ts`, `src/constants.ts`, `src/translations.ts`, `src/SensemakingPlugin.tsx`, `src/types/index.ts`, `src/types/Capture.ts`, `src/capabilities/index.ts`).
- Test: `src/SensemakingPlugin.test.ts`.

**Interfaces:**
- Produces: `SensemakingPlugin` (from `#plugin`), `meta` (`meta.profile.key === 'org.dxos.plugin.sensemaking'`), `Capture.Capture` type (defined here so the schema module has something to register; fleshed out in Task 2).

- [ ] **Step 1: Scaffold the package boilerplate.** Copy `packages/plugins/plugin-readwise/{package.json, moon.yml, tsconfig.json, dx.config.ts}` and swap `readwise`→`sensemaking` throughout, with these deltas:
  - `package.json`: `"name": "@dxos/plugin-sensemaking"`, `"private": true`. Keep the `imports` subpaths for `#capabilities`, `#containers`, `#meta`, `#operations`, `#plugin`, `#translations`, `#types` (drop `#hooks` — none in Inc 1). Dependencies (`workspace:*`): `@dxos/app-framework`, `@dxos/app-toolkit`, `@dxos/echo`, `@dxos/plugin-graph`, `@dxos/plugin-space`, `@dxos/react-client`, `@dxos/react-ui`, `@dxos/util`. devDeps: `@dxos/plugin-client`, `@dxos/plugin-testing`, `@dxos/echo-client`. External (`catalog:`): `effect`, `@effect-atom/atom-react`, `react`, `@types/react`.
  - `moon.yml`: `--entryPoint` per barrel: `src/index.ts`, `src/SensemakingPlugin.tsx`, `src/capabilities/index.ts`, `src/containers/index.ts`, `src/meta.ts`, `src/operations/index.ts` (add in Task 6), `src/plugin.ts`, `src/translations.ts`, `src/types/index.ts`. `--platform=neutral`. Keep tags `[ts-build, ts-test, pack]`.
  - `dx.config.ts`: plugin id `org.dxos.plugin.sensemaking`, name `SensemakingPlugin` (mirror plugin-readwise's shape — read `packages/plugins/plugin-readwise/dx.config.ts` for the exact fields).
  - `tsconfig.json`: `references` for each `@dxos/*` dep above.

- [ ] **Step 2: Write the leaf source files.**

`src/meta.ts`:
```ts
//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';

import config from '../dx.config';

export const meta = Plugin.getMetaFromConfig(config);
```

`src/constants.ts`:
```ts
//
// Copyright 2026 DXOS.org
//

import { meta } from '#meta';

/** App-graph node `type` for a space's Inbox view. */
export const INBOX_NODE_TYPE = `${meta.profile.key}.inbox`;

/** Sentinel `data` for the Inbox view node (non-null so the nav tree can select it). */
export const INBOX_NODE_DATA = `${meta.profile.key}.inbox-view` as const;
```

`src/index.ts`:
```ts
//
// Copyright 2026 DXOS.org
//

export * from './constants';
export * from './meta';
```

`src/plugin.ts`:
```ts
//
// Copyright 2026 DXOS.org
//

export { SensemakingPlugin, default } from './SensemakingPlugin';
```

`src/types/index.ts` (grows in later tasks):
```ts
//
// Copyright 2026 DXOS.org
//

export * as Capture from './Capture';
```

`src/capabilities/index.ts` (grows in later tasks):
```ts
//
// Copyright 2026 DXOS.org
//

import { Capability } from '@dxos/app-framework';

export const ReactSurface = Capability.lazy('ReactSurface', () => import('./react-surface'));
```

`src/translations.ts` — mirror plugin-readwise's shape: an `as const satisfies Resource[]` array, `'en-US'` locale, with a `[Type.getTypename(Capture.Capture)]` block (`'typename.label': 'Capture'`, `'typename.label_other': 'Captures'`) and a `[meta.profile.key]` block (`'plugin.name': 'Sensemaking'`, `'inbox.label': 'Inbox'`). Import `Type` from `@dxos/echo` and `Capture` from `#types`.

- [ ] **Step 3: Write a minimal `Capture` type** (fleshed out in Task 2, but the schema module needs a real type now). `src/types/Capture.ts`:
```ts
//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Ref, Type } from '@dxos/echo';
import { LabelAnnotation } from '@dxos/echo/Annotation';

/**
 * A flagged unit of sensemaking — a copy-on-write envelope over a source object. Its existence is
 * the flag. `source` is the wrapped object; `referent` is the deduped thing the capture is about
 * (denormalized by the feeder so the Inbox clusters without knowing the source type).
 */
export class Capture extends Type.makeObject<Capture>(DXN.make('org.dxos.type.capture', '0.1.0'))(
  Schema.Struct({
    source: Ref.Ref(Obj.Unknown),
    referent: Schema.optional(Ref.Ref(Obj.Unknown)),
    flaggedAt: Schema.String,
    note: Schema.optional(Schema.String),
    tags: Schema.optional(Schema.Array(Schema.String)),
  }).pipe(Annotation.IconAnnotation.set({ icon: 'ph--flag--regular', hue: 'amber' })),
) {}

export const make = (props: Obj.MakeProps<typeof Capture>): Capture => Obj.make(Capture, props);
export const instanceOf = (value: unknown): value is Capture => Obj.instanceOf(Capture, value);
```
(No `LabelAnnotation` — a capture has no name; keep the import out if unused.)

- [ ] **Step 4: Write `SensemakingPlugin.tsx`** with only the schema + translations modules for now:
```tsx
//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';

import { meta } from '#meta';
import { translations } from '#translations';
import { Capture } from '#types';

export const SensemakingPlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({ schema: [Capture.Capture] }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default SensemakingPlugin;
```

- [ ] **Step 5: Write the smoke test** `src/SensemakingPlugin.test.ts` (mirror plugin-readwise's `ReadwisePlugin.test.ts`):
```ts
//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { AppCapabilities } from '@dxos/app-toolkit';
import { Type } from '@dxos/echo';
import { ClientPlugin } from '@dxos/plugin-client/plugin';
import { createComposerTestApp } from '@dxos/plugin-testing/harness';

import { SensemakingPlugin } from '#plugin';
import { meta } from './meta';
import { Capture } from './types';

const moduleId = (name: string) => `${meta.profile.key}.module.${name}`;

describe('SensemakingPlugin', () => {
  test('schema module activates on startup and registers Capture', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), SensemakingPlugin()] });
    expect(harness.manager.getActive()).toEqual(expect.arrayContaining([moduleId('schema')]));
    const registeredTypenames = harness.getAll(AppCapabilities.Schema).flat().map(Type.getTypename);
    expect(registeredTypenames).toEqual(expect.arrayContaining([Type.getTypename(Capture.Capture)]));
  });
});
```

- [ ] **Step 6: Register in composer-app** (own `chore(composer-app):` commit — this is the one approved out-of-package edit). In `packages/apps/composer-app/src/plugin-defs.tsx`: add `import { SensemakingPlugin } from '@dxos/plugin-sensemaking/plugin';` (alphabetical), add `SensemakingPlugin.meta.profile.key` to the dev/labs default-id array, and `SensemakingPlugin(),` to the instantiated plugin list (mirror the three `ReadwisePlugin` touch points at reference §7).

- [ ] **Step 7: Install + build + test.** Run `pnpm install` (the new workspace package), then `moon run plugin-sensemaking:build` (expect 0 errors), `moon run plugin-sensemaking:test -- src/SensemakingPlugin.test.ts` (expect PASS), `moon run plugin-sensemaking:lint`.

- [ ] **Step 8: Commit.**
```bash
git add packages/plugins/plugin-sensemaking pnpm-lock.yaml
git commit -m "feat(plugin-sensemaking): scaffold plugin + Capture schema + smoke test"
# then, separately:
git add packages/apps/composer-app/src/plugin-defs.tsx
git commit -m "chore(composer-app): register plugin-sensemaking"
```

---

## Task 2: `Result` type

**Files:**
- Create: `src/types/Result.ts`, `src/types/Result.test.ts`.
- Modify: `src/types/index.ts` (add `export * as Result from './Result';`), `src/SensemakingPlugin.tsx` (add `Result.Result` to the schema array), `src/translations.ts` (add a `Result` typename block).

**Interfaces:**
- Produces: `Result.Result` (fields `kind: 'todo' | 'question'`, `body: string`), `Result.make`, `Result.instanceOf`, `Result.Kind` (the literal union).

- [ ] **Step 1: Write the failing test** `src/types/Result.test.ts`:
```ts
//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Obj } from '@dxos/echo';

import { Result } from './Result';

describe('Result', () => {
  test('makes a to-do result with a body', ({ expect }) => {
    const result = Obj.make(Result, { kind: 'todo', body: 'Draft the post' });
    expect(Result.instanceOf?.(result) ?? Obj.instanceOf(Result, result)).toBe(true);
    expect(result.kind).toBe('todo');
    expect(result.body).toBe('Draft the post');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module './Result'`). `moon run plugin-sensemaking:test -- src/types/Result.test.ts`.

- [ ] **Step 3: Implement** `src/types/Result.ts`:
```ts
//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Type } from '@dxos/echo';
import { LabelAnnotation } from '@dxos/echo/Annotation';

/** A triage outcome. `to-do` and `question` are actions (they flow to the Pipeline in a later rung). */
export const Kind = Schema.Literal('todo', 'question');
export type Kind = Schema.Schema.Type<typeof Kind>;

export class Result extends Type.makeObject<Result>(DXN.make('org.dxos.type.result', '0.1.0'))(
  Schema.Struct({
    kind: Kind,
    body: Schema.String,
  }).pipe(
    LabelAnnotation.set(['body']),
    Annotation.IconAnnotation.set({ icon: 'ph--check-square--regular', hue: 'indigo' }),
  ),
) {}

export const make = (props: Obj.MakeProps<typeof Result>): Result => Obj.make(Result, props);
export const instanceOf = (value: unknown): value is Result => Obj.instanceOf(Result, value);
```

- [ ] **Step 4: Wire the barrel + schema module + translations.** Add `export * as Result from './Result';` to `src/types/index.ts`; add `Result.Result` to the `addSchemaModule` array in `SensemakingPlugin.tsx`; add a `[Type.getTypename(Result.Result)]` block to translations (`'typename.label': 'Result'`).

- [ ] **Step 5: Run the test — expect PASS.** Then `moon run plugin-sensemaking:build` (0 errors), `:lint`.

- [ ] **Step 6: Commit** `feat(plugin-sensemaking): Result type (to-do / question)`.

---

## Task 3: The `DerivedFrom` and `ConnectedTo` relations

**Files:**
- Create: `src/types/DerivedFrom.ts`, `src/types/ConnectedTo.ts`, `src/types/relations.test.ts`.
- Modify: `src/types/index.ts`, `src/SensemakingPlugin.tsx` (register both in the schema array).

**Interfaces:**
- Produces: `DerivedFrom.DerivedFrom` (relation: source=`Result`, target=`Capture`) + `DerivedFrom.make`; `ConnectedTo.ConnectedTo` (relation: source=`Capture`, target=`Obj.Unknown`) + `ConnectedTo.make`. Both created via `Relation.make(Type, { [Relation.Source], [Relation.Target] })` and persisted with `db.add(...)`; queried via `Query.select(Filter.id(x)).targetOf(...).source()`.

- [ ] **Step 1: Write the failing test** `src/types/relations.test.ts` (exercises create + reverse-query against a real in-memory space):
```ts
//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Filter, Obj, Query, Relation } from '@dxos/echo';
import { EchoTestBuilder } from '@dxos/echo-db/testing';

import { Capture } from './Capture';
import { ConnectedTo } from './ConnectedTo';
import { DerivedFrom } from './DerivedFrom';
import { Result } from './Result';

describe('sensemaking relations', () => {
  test('a Result is traceable back to its Capture', async ({ expect }) => {
    await using builder = await new EchoTestBuilder().open();
    const { db } = await builder.createDatabase({ types: [Capture, Result, DerivedFrom.DerivedFrom] });

    const capture = db.add(Obj.make(Capture, { source: undefined as never, flaggedAt: '2026-07-06T00:00:00Z' }));
    const result = db.add(Obj.make(Result, { kind: 'todo', body: 'Do it' }));
    db.add(DerivedFrom.make({ [Relation.Source]: result, [Relation.Target]: capture }));
    await db.flush();

    const derived = await db
      .query(Query.select(Filter.id(capture.id)).targetOf(DerivedFrom.DerivedFrom).source())
      .run();
    expect(derived.objects.map((object) => object.id)).toContain(result.id);
  });
});
```
> Note to implementer: confirm the exact `EchoTestBuilder`/`createDatabase` import + `.query(...).run()` result shape against a sibling relation test (e.g. grep `plugin-inbox` / `@dxos/echo-db` tests for `targetOf`); adjust the harness call to match, keeping the assertion (a Result is reachable from its Capture via the relation). The `source: undefined` placeholder is only to satisfy the required field in this isolated relation test — real captures always carry a source (Task 5).

- [ ] **Step 2: Run it — expect FAIL** (missing modules).

- [ ] **Step 3: Implement** `src/types/DerivedFrom.ts` (mirror `plugin-inbox/src/types/ExtractedFrom.ts` exactly):
```ts
//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { DXN, Relation, Type } from '@dxos/echo';

import { Capture } from './Capture';
import { Result } from './Result';

/** Traceability relation. Source = the triage Result; target = the Capture it was derived from. */
export class DerivedFrom extends Type.makeRelation<DerivedFrom>(DXN.make('org.dxos.relation.derivedFrom', '0.1.0'))({
  source: Result,
  target: Capture,
})(Schema.Struct({})) {}

export const make = (props: Relation.MakeProps<typeof DerivedFrom>) => Relation.make(DerivedFrom, props);
```

`src/types/ConnectedTo.ts`:
```ts
//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { DXN, Obj, Relation, Type } from '@dxos/echo';

import { Capture } from './Capture';

/**
 * Connect relation (replaces "comment"). Source = the Capture; target = what it belongs with
 * (a Collection/project by default; any object in general).
 */
export class ConnectedTo extends Type.makeRelation<ConnectedTo>(DXN.make('org.dxos.relation.connectedTo', '0.1.0'))({
  source: Capture,
  target: Obj.Unknown,
})(Schema.Struct({})) {}

export const make = (props: Relation.MakeProps<typeof ConnectedTo>) => Relation.make(ConnectedTo, props);
```

- [ ] **Step 4: Wire the barrel + schema module.** Add both to `src/types/index.ts` (`export * as DerivedFrom from './DerivedFrom';`, `export * as ConnectedTo from './ConnectedTo';`) and to the `addSchemaModule` array (`DerivedFrom.DerivedFrom`, `ConnectedTo.ConnectedTo`).

- [ ] **Step 5: Run the test — expect PASS.** `moon run plugin-sensemaking:build`, `:lint`.

- [ ] **Step 6: Commit** `feat(plugin-sensemaking): DerivedFrom + ConnectedTo relations`.

---

## Task 4: Triage operations (create result / connect)

**Files:**
- Create: `src/types/SensemakingOperation.ts`, `src/capabilities/operation-handler.ts`, `src/operations/index.ts`, `src/operations/triage.test.ts`.
- Modify: `src/types/index.ts`, `src/capabilities/index.ts` (add lazy `OperationHandler`), `src/SensemakingPlugin.tsx` (add `AppPlugin.addOperationHandlerModule({ activate: OperationHandler })`), `moon.yml` (add the `src/operations/index.ts` entry point if not present).

**Interfaces:**
- Produces: `SensemakingOperation.CreateResult({ capture: Ref<Capture>, kind, body }) → { result }` — creates a `Result` + a `DerivedFrom` relation to the capture. `SensemakingOperation.Connect({ capture: Ref<Capture>, target: Ref<Obj.Unknown> }) → { relation }` — creates a `ConnectedTo` relation. Handlers persist via `db.add(...)`.

- [ ] **Step 1: Define the operations** `src/types/SensemakingOperation.ts` — mirror `plugin-readwise/src/types/ReadwiseOperation.ts` (read it for the exact `Operation.make`/schema shape). Two operations: `CreateResult` (input `{ capture: Ref.Ref(Capture.Capture), kind: Result.Kind, body: Schema.String }`, output `{ result: Ref.Ref(Result.Result) }`), `Connect` (input `{ capture: Ref.Ref(Capture.Capture), target: Ref.Ref(Obj.Unknown) }`, output `{ relation: ... }`).

- [ ] **Step 2: Write the failing test** `src/operations/triage.test.ts` — build a space with a Capture, invoke `CreateResult`, assert a Result exists and is reachable from the capture via `DerivedFrom` (reuse the query idiom from Task 3); invoke `Connect`, assert a `ConnectedTo` relation exists from the capture to the target. (Follow the harness pattern the Task-3 test settled on.)

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement `src/capabilities/operation-handler.ts`** (mirror `plugin-readwise/src/capabilities/operation-handler.ts` for the `Capability.makeModule` + `Operation.withHandler` shape). `CreateResult` handler: resolve the capture, `const result = db.add(Result.make({ kind, body }))`, `db.add(DerivedFrom.make({ [Relation.Source]: result, [Relation.Target]: capture }))`, return `{ result: Ref.make(result) }`. `Connect` handler: `db.add(ConnectedTo.make({ [Relation.Source]: capture, [Relation.Target]: target }))`, return `{ relation }`. Resolve `db` from the capture via `Obj.getDatabase(...)`.

- [ ] **Step 5: Wire** the lazy `OperationHandler` capability (`src/capabilities/index.ts`) and `addOperationHandlerModule` in `SensemakingPlugin.tsx`; add `SensemakingOperation` to `src/types/index.ts` + `src/operations/index.ts` barrel.

- [ ] **Step 6: Run the test — expect PASS.** `build`, `lint`.

- [ ] **Step 7: Commit** `feat(plugin-sensemaking): triage operations (create result, connect)`.

---

## Task 5: Readwise feeder — one Capture per Highlight

**Files:**
- Modify: `packages/plugins/plugin-readwise/package.json` (add `@dxos/plugin-sensemaking: workspace:*`) + `tsconfig.json` (project reference); `packages/plugins/plugin-readwise/src/operations/capture.ts`; `packages/plugins/plugin-readwise/src/constants.ts` (a `CAPTURE_SOURCE` foreign-key constant); `src/operations/capture.test.ts`.

**Interfaces:**
- Consumes: `Capture.make` / `Capture.Capture` from `@dxos/plugin-sensemaking` (import the type namespace).
- Produces: after `captureHighlights`, for each captured `Highlight` there is exactly one `Capture` whose `source` refs the Highlight and whose `referent` refs the Highlight's source `Bookmark`. Idempotent (re-sync creates no duplicate captures).

- [ ] **Step 1: Add the dependency.** `pnpm add --filter @dxos/plugin-readwise --save-workspace @dxos/plugin-sensemaking` (or hand-edit `package.json` dep + `tsconfig.json` reference to match the repo convention), then `pnpm install`.

- [ ] **Step 2: Write the failing test** — extend `packages/plugins/plugin-readwise/src/operations/capture.test.ts` with a case: after `captureHighlights` over a fixture batch, query the space for `Capture` objects and assert one per distinct highlight, each `capture.source.target` is the Highlight and `capture.referent.target` is that Highlight's Bookmark; run capture again with the same batch and assert the Capture count is unchanged (idempotent). Use the existing test's space/db setup.

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement.** In `capture.ts`, add a `CAPTURE_SOURCE = 'readwise-capture'` foreign-key constant and an `upsertCapture(db, highlight, bookmark)` mirroring `upsertHighlight`'s idempotent pattern (reference §6): `findByForeignId(db, Capture.Capture, highlight.readwiseId)`; on miss `db.add(Capture.make({ [Obj.Meta]: { keys: [{ source: CAPTURE_SOURCE, id: highlight.readwiseId }] }, source: Ref.make(highlightObject), referent: Ref.make(bookmarkObject), flaggedAt: highlight.updated }))`. Call it in `captureHighlights` right after the Highlight is upserted (so the Highlight + Bookmark objects exist to ref). Fold capture create/update into the returned counts if desired, or leave counts as-is (highlights only) — the test asserts capture *count*, not the returned tally.
  > `flaggedAt` uses the highlight's own `updated` timestamp (deterministic; avoids `Date.now()` which is unavailable/nondeterministic).

- [ ] **Step 5: Run the test — expect PASS.** `moon run plugin-readwise:build` (0 errors), `moon run plugin-sensemaking:build`, both `:test`, both `:lint`.

- [ ] **Step 6: Commit** `feat(plugin-readwise): create a sensemaking Capture per synced highlight`.

---

## Task 6: Cluster captures by referent (pure)

**Files:**
- Create: `src/operations/cluster.ts`, `src/operations/cluster.test.ts` (in plugin-sensemaking).
- Modify: `src/operations/index.ts`.

**Interfaces:**
- Produces: `clusterByReferent(captures: Capture[], get): Cluster[]` where `Cluster = { referent: Obj.Unknown | undefined, captures: Capture[] }`, groups shared a `referent.target.id`, ordered by each cluster's newest `flaggedAt` first (mirrors the shipped `buildSourceGroups` ordering in `plugin-readwise/src/operations/browse-query.ts`).

- [ ] **Step 1: Write the failing test** `src/operations/cluster.test.ts` — given captures with `referent` refs to two Bookmarks and varied `flaggedAt`, assert (a) captures group by referent id, (b) clusters ordered newest-active first, (c) a capture with no referent forms its own group. Model the assertions on `plugin-readwise/src/operations/browse-query.test.ts`.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `cluster.ts`** — a pure grouping function (read `browse-query.ts` for the grouping+sort idiom; here the group key is `capture.referent?.target?.id` instead of the source id). No ECHO writes; deref refs via the passed `get`/atom accessor consistent with `browse-query.ts`.

- [ ] **Step 4: Run the test — expect PASS.** `build`, `lint`.

- [ ] **Step 5: Commit** `feat(plugin-sensemaking): cluster captures by referent`.

---

## Task 7: The Inbox surface + navtree entry

**Files:**
- Create: `src/containers/Inbox/Inbox.tsx`, `src/containers/Inbox/index.ts`, `src/containers/index.ts`, `src/capabilities/react-surface.tsx`, `src/capabilities/app-graph-builder.ts`.
- Modify: `src/capabilities/index.ts` (add lazy `AppGraphBuilder`), `src/SensemakingPlugin.tsx` (add `addSurfaceModule` + `addAppGraphModule`), `src/translations.ts` (`'inbox.label'`).

**Interfaces:**
- Produces: an **Inbox** navtree node per space (shown when the space has ≥1 Capture), opening the `Inbox` surface. The `Inbox` container queries all `Capture`s in the space, clusters them via `clusterByReferent`, and renders each capture's `source` natively via `<Surface.Surface type={AppSurface.CardContent} data={{ subject: capture.source.target }} limit={1} />` (this resolves to the already-registered `HighlightCard` for Readwise highlights — reference §8).

- [ ] **Step 1: Implement the Inbox container** `src/containers/Inbox/Inbox.tsx` — query `Filter.type(Capture.Capture)` in the subject space, `clusterByReferent`, render each cluster with a header (the referent's title/label via `Entity.getLabel`) and each capture via the `CardContent` Surface fan-out. Model the layout on the shipped `ReadwiseContainer` (grouped sections). Import `Surface`, `AppSurface` from `@dxos/app-toolkit`/`@dxos/app-framework/ui` (match reference §8's `RelatedArticle` usage).
  > Rendering caveat (reference §8): the fan-out is unconditional here (like `RelatedArticle`), so `HighlightCard` renders without needing `AppAnnotation.CardAnnotation`. Do **not** gate on that annotation.

- [ ] **Step 2: Register the surface** `src/capabilities/react-surface.tsx` — a `Surface.create({ id: 'sensemakingInbox', filter: <the Inbox node/view filter>, component })` opening the Inbox. Follow `plugin-readwise/src/capabilities/react-surface.tsx`; the Inbox is opened from a view node (see Step 3), so filter on the Inbox node data/type (mirror how a non-object view surface is filtered — grep a plugin that surfaces a virtual node, e.g. plugin-inbox's Drafts/Calendar view surface).

- [ ] **Step 3: Contribute the Inbox navtree node** `src/capabilities/app-graph-builder.ts` — a graph extension matching `AppNodeMatcher.whenNavTreeGroup(Paths.GroupTypes.content)` (or `whenSpace`) that, when `space.db.query(Filter.type(Capture.Capture))` is non-empty, returns one node (`INBOX_NODE_TYPE` / `INBOX_NODE_DATA`, label `inbox.label`, icon `ph--tray--regular`) that opens the Inbox surface. Reuse the structure-only pattern from `plugin-readwise/src/capabilities/app-graph-builder.ts` (bare-word node id, no `/`, no actions). Register via `AppPlugin.addAppGraphModule({ activatesOn: ActivationEvent.allOf(AppActivationEvents.SetupAppGraph, AttentionEvents.AttentionReady), activate: AppGraphBuilder })` (add `@dxos/plugin-attention` dep if needed).

- [ ] **Step 4: Wire** the lazy capabilities + modules in `index.ts`/`SensemakingPlugin.tsx`.

- [ ] **Step 5: Build + lint.** `moon run plugin-sensemaking:build` (0 errors), `:lint`. (No unit test for the surface — the seam is the live app; verified in Step 6.)

- [ ] **Step 6: Live-verify (user is remote — screenshot).** Boot composer-app (`preview_start` / `preview_list`; a server may be on :5180). With a connected Readwise account already synced, confirm an **Inbox** node appears in the navtree; opening it shows the highlights as capture cards clustered by source (referent), rendered via `HighlightCard`. Capture a `preview_screenshot`. **PAUSE for user review** before Task 8.

- [ ] **Step 7: Commit** `feat(plugin-sensemaking): Inbox surface clustering captures by referent`.

---

## Task 8: Manual triage in the Inbox

**Files:**
- Modify: `src/containers/Inbox/Inbox.tsx` (add per-capture triage affordances + inline results), `src/translations.ts` (labels: `result-todo.label`, `result-question.label`, `connect.label`).

**Interfaces:**
- Consumes: `SensemakingOperation.CreateResult`, `SensemakingOperation.Connect` (Task 4); the `DerivedFrom` reverse-query for inline display.

- [ ] **Step 1: Add the triage affordances.** On each capture card, a `+ result` control (choose to-do / question, enter a body) invokes `CreateResult`; a `connect to…` control (pick a Collection) invokes `Connect`. Use `useOperationInvoker` (as `ReadwiseContainer` does).

- [ ] **Step 2: Show results inline.** Under each capture, query its derived results (`Query.select(Filter.id(capture.id)).targetOf(DerivedFrom.DerivedFrom).source()`, via `useQuery`) and render each with its kind + body and the link back (mirror reference §4c `useExtractedObjects`).

- [ ] **Step 3: Build + lint.** 0 errors / 0.

- [ ] **Step 4: Live-verify (screenshot).** On a capture, create a to-do and a question → they appear inline under it; connect a capture to a Collection → no board item appears, and the connection persists (re-open the Inbox and the results/connection are still there). `preview_screenshot`. **PAUSE for user review.**

- [ ] **Step 5: Commit** `feat(plugin-sensemaking): manual triage into to-do / question / connect`.

---

## Task 9: Shrink the Readwise account view to connect/sync/status

**Files:**
- Modify: `packages/plugins/plugin-readwise/src/containers/ReadwiseContainer/ReadwiseContainer.tsx` (+ its test if any).

**Interfaces:**
- Produces: `ReadwiseContainer` renders only the connect (when unconnected) / sync / status affordances; it no longer renders the grouped highlight browse (the Inbox owns that now).

- [ ] **Step 1: Remove the browse.** Delete the `buildSourceGroups`/`HighlightCard` rendering path from `ReadwiseContainer`; keep the `ConnectorAuth` empty state, the Sync affordance, and add a compact status line (connected / last-sync / highlight count) plus a pointer to the Inbox (`t('open-inbox.label')`). Remove now-unused imports (`HighlightCard`, `buildSourceGroups`) and any code they solely supported.
  > `buildSourceGroups`/`HighlightCard` may still be referenced by the stashed visual-polish work and by the Inbox's fan-out (via the surface, not import). Keep `HighlightCard` + its `CardContent` surface registration in plugin-readwise (the Inbox renders through it); only remove `ReadwiseContainer`'s *direct* use.

- [ ] **Step 2: Build + lint** both plugins. 0 / 0.

- [ ] **Step 3: Live-verify (screenshot).** Opening the Readwise account shows connect/sync/status only; reading + triage happen in the Inbox. `preview_screenshot`.

- [ ] **Step 4: Commit** `feat(plugin-readwise): shrink account view to connect/sync/status`.

---

## Task 10: Whole-flow acceptance + PLUGIN.mdl

**Files:**
- Create: `packages/plugins/plugin-sensemaking/PLUGIN.mdl` (spec doc: types, the Inbox/triage components, the acceptance scenarios from the design §9) + wire `addPluginAssetModule` (mirror plugin-readwise). Optional but matches the repo convention that a plugin ships its spec.

**Interfaces:** none new — this task verifies the increment end-to-end and documents it.

- [ ] **Step 1: Author `PLUGIN.mdl`** at user-behavior altitude: the `Capture`/`Result` types, the `ConnectedTo`/`DerivedFrom` relations, the `Inbox` component, and the design §9 acceptance scenarios as `feat`/`test` blocks. Register it via `AppPlugin.addPluginAssetModule` + `import pluginSpec from '../PLUGIN.mdl?raw'` (reference §1).

- [ ] **Step 2: Full live acceptance run** against composer-app (the design §9 scenarios): synced highlight → capture in Inbox · clustered by referent · `+ result` creates a traceable Result · connect creates a relation (no board item) · re-sync creates no duplicate captures · Readwise view shows only connect/sync/status. Screenshot the Inbox with results. **PAUSE for user review.**

- [ ] **Step 3: Whole-package gate.** `moon run plugin-sensemaking:build`, `moon run plugin-readwise:build`, both `:test`, both `:lint` — all green.

- [ ] **Step 4: Commit** `docs(plugin-sensemaking): PLUGIN.mdl + Inc-1 acceptance`.

---

## Self-Review

- **Spec coverage:** design §3 (plugin split) → Tasks 1/5/9; §4 data model (Capture/Result/connect/traceability/Flag-as-Capture/referent-reuse) → Tasks 1–5; §5 surfaces (Inbox subsumes browse, native rendering, triage) → Tasks 7–9; §6 feeder → Task 5; §9 acceptance → Task 10. Non-goals (§7: Pipeline/AI/source #2) are intentionally absent.
- **Type consistency:** `Capture` (source/referent/flaggedAt), `Result` (kind/body), `DerivedFrom` (Result→Capture), `ConnectedTo` (Capture→target) are used with the same shapes across Tasks 2–8. Operations `CreateResult`/`Connect` names match between Task 4 and Task 8.
- **Known soft spots for the implementer to pin during execution (flagged inline, not placeholders):** the exact `EchoTestBuilder`/`createDatabase` harness call for relation tests (Task 3 Step 1 note); the view-node surface `filter` shape for a non-object Inbox view (Task 7 Step 2); confirm `Ref.make`/`Ref.Ref(Obj.Unknown)` is the right untyped-ref form against `Highlight.ts`. Each names the sibling to grep.
