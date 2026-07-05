# Extracting `@dxos/plugin-readwise` to an external repo

This plugin ships **inside** the `dxos/dxos` monorepo today. This document is the runbook for
moving it to its own repo and loading it into Composer at runtime, without requiring any
change to how it builds/tests/lints in-tree in the meantime.

Nothing in this document has been executed against a real external repo — it is a proposal,
verified locally via the dev-plugin-loader path (`devPluginUrl`) described in Step 5.

## 1. Dependency host-availability audit

Composer's host app provides a fixed set of `@dxos/*` (and a few third-party) packages to
plugins at runtime via an import map — `DEFAULT_PACKAGES` in
`packages/sdk/app-framework/src/vite-plugin/packages.ts`. `composerPlugin`'s build
externalizes exactly this set (via `isSharedPackage`); anything not on the list gets bundled
into the plugin's own `dist/index.mjs`.

**By design, `DEFAULT_PACKAGES` excludes every `@dxos/plugin-*` package** — the file's own
comment: *"Plugin packages (`@dxos/plugin-*`) are intentionally NOT listed: community plugins
bundle their own copy of any plugin-subpath import, which is safe because those exports are
limited to lightweight types/operation defs."* This audit checks whether that "safe because…"
premise actually holds for this plugin's specific imports, not just assumes it.

| Dependency | Host-provided? | Used in runtime src (not test/story)? | Verdict |
|---|---|---|---|
| `@dxos/ai` | Yes | — | Externalized — safe |
| `@dxos/app-framework` | Yes | Yes | Externalized — safe |
| `@dxos/app-toolkit` | Yes | Yes | Externalized — safe |
| `@dxos/assistant-toolkit` | Yes | — | Externalized — safe |
| `@dxos/compute` | Yes | — | Externalized — safe |
| `@dxos/echo` | Yes | Yes | Externalized — safe |
| `@dxos/echo-react` | Yes | — | Externalized — safe |
| `@dxos/edge-client` | Yes | — | Externalized — safe |
| `@dxos/errors` | Yes | — | Externalized — safe |
| `@dxos/invariant` | Yes | — | Externalized — safe |
| `@dxos/keys` | Yes | — | Externalized — safe |
| `@dxos/log` | Yes | — | Externalized — safe |
| `@dxos/react-client` | Yes | — | Externalized — safe |
| `@dxos/react-ui-list` | Yes | — | Externalized — safe |
| `@dxos/react-ui-menu` | Yes | — | Externalized — safe |
| `@dxos/react-ui-mosaic` | Yes | — | Externalized — safe |
| `@dxos/schema` | Yes | — | Externalized — safe |
| `@dxos/types` | Yes | Yes | Externalized — safe |
| `@dxos/util` | Yes | — | Externalized — safe |
| `@dxos/plugin-assistant` | **No** | No — only `ReadwisePlugin.test.ts` imports `AssistantCapabilities`/`AssistantOperation`, and only `TriageCard.stories.tsx` imports `AssistantPlugin` | Not a real runtime dependency today. If it becomes one, see risk below. |
| `@dxos/plugin-bookmarks` | **No** | Yes — `Bookmark` (ECHO type), imported by `ReadwisePlugin.tsx`, `.node.ts`, `operations/capture.ts`, `operations/confirm.ts` | Bundled duplicate — see risk analysis below. Safe. |
| `@dxos/plugin-client` | **No** | No — only tests/stories (`ClientPlugin`, `ClientCapabilities`, `initializeIdentity`) | Not a runtime dependency; test/story only. Should move to `devDependencies` in the extracted repo (currently a `dependencies` entry despite being test/story-only). |
| `@dxos/plugin-connector` | **No** | Yes — `Connection` (type-only) and `SyncBinding` (ECHO relation), imported by `services/credentials.ts`, `hooks/useReadwiseSyncBinding.ts`, `types/ReadwiseOperation.ts` | Bundled duplicate — see risk analysis below. Safe. |
| `@dxos/plugin-kanban` | **No** | Yes — `Kanban` (ECHO type), imported by `ReadwisePlugin.tsx`, `operations/ensure-board.ts`, `capabilities/react-surface.tsx`, `containers/TriageBoard/TriageBoard.tsx` | Bundled duplicate — see risk analysis below. Safe. |

### Risk analysis: bundling a duplicate copy of an ECHO type

The real question isn't "is the import type-only" (some of these — `Bookmark`, `Kanban`,
`SyncBinding` — are ECHO **type classes**, not plain interfaces) but whether ECHO resolves an
object's type by comparing **class identity** (unsafe to duplicate — the readwise bundle's
copy of the `Bookmark` class would be a different JS object than the host's) or by a
**typename string** (safe — any two classes declaring the same typename are treated as the
same type).

Verified in `@dxos/echo`'s own source: `isInstanceOf` in
`packages/core/echo/echo/src/internal/Entity/type-uri.ts:52-58` documents *"Only typename is
compared, the schema version is ignored… Object was created with a different schema (maybe
dynamic) that has the same typename"* and its implementation (`type-uri.ts:82-93`) resolves
via `DXN.getName(parsed) === typename` — a **string** comparison, never a class/object
identity check. `Filter.type()` (`packages/core/echo/echo/src/Filter.ts:143-146`) builds its
query filter from the same string URI, not a schema reference. The same pattern holds outside
ECHO: `Capability.make` and `Operation.make` register by a string `identifier`/`meta.key`, not
by object reference (`packages/sdk/app-framework/src/core/capability.ts`,
`packages/core/compute/compute/src/Operation.ts`).

**Conclusion: bundling a duplicate copy of `Bookmark`, `Kanban`, and `SyncBinding` is safe.**
Confirmed empirically too — building the external bundle shows `Bookmark`/`Kanban` compiled
into `dist/chunks/*.js` as fresh class declarations (`class $ extends
Type.makeObject(DXN.make('org.dxos.type.bookmark', '0.1.0'))(...)`), a different JS object
than the host's own `Bookmark` class, while `@dxos/echo`/`@dxos/app-framework`/`@dxos/types`
remain bare `import` statements resolved against the host's copies.

**Caveat — a version-skew risk, not an identity risk.** `isInstanceOf` explicitly ignores the
schema *version* segment of the typename DXN only when matching by typename string — but
`Bookmark`'s own declared DXN is `org.dxos.type.bookmark@0.1.0` and `SyncBinding`'s is
`org.dxos.type.syncBinding@0.2.0`. If the extracted plugin pins an older/newer
`@dxos/plugin-bookmarks`/`@dxos/plugin-connector` than what the host runs, and a *breaking*
schema change lands under the same typename, the two copies' field shapes can diverge even
though `isInstanceOf`/`Filter.type()` still consider them the same type. This is a version-
compatibility contract to maintain (pin close to the host's SDK version, per Step 3 below),
not a runtime-identity bug.

**`@dxos/plugin-client`, `@dxos/plugin-assistant` are not currently exercised by runtime
code** — only by tests and Storybook stories. No extraction risk today; flag if a future
change adds a real runtime import (e.g. wiring `AssistantOperation` into an actual Sync
handler) — at that point, re-run this audit for the newly-live import.

## 2. `vite.config.ts` — external build

Added `packages/plugins/plugin-readwise/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

import { composerPlugin } from '@dxos/app-framework/vite-plugin';

export default defineConfig({
  plugins: [wasm(), composerPlugin({ entry: 'src/ReadwisePlugin.tsx' }), react()],
});
```

Notes:

- **Entry is `src/ReadwisePlugin.tsx`, not `src/plugin.ts`.** The in-monorepo `#plugin` entry
  (`src/plugin.ts`) wraps the real plugin definition in `Plugin.lazy(meta, () =>
  import('#plugin'))` so `composer-app` can code-split it. An external bundle has no host-side
  chunk to lazy-load into — the host dynamic-imports the whole `index.mjs` as one unit — so
  the direct plugin definition (`ReadwisePlugin.tsx`, the browser/React variant) is the correct
  entry. `ReadwisePlugin.node.ts` (the headless CLI/agent variant, no React surfaces) is not
  used by this build; it stays as the Node conditional-export target for in-tree consumers.
- **Does not touch or replace the moon build.** `tsconfig.json` already excludes
  `vite.config.ts` from the TypeScript project, and moon's `compile`/`build` tasks
  (`.moon/tasks/tag-ts-build.yml`) never invoke `vite` — they run `dx-compile`/`dx-build`
  against the package's `exports` map. The vite build is a parallel, opt-in path invoked
  directly (`vite build` / `vite dev`) or via `dx registry publish` (which shells out to
  `publish.buildCommand`, see below). `moon run plugin-readwise:build`, `:test`, and `:lint`
  all still pass unmodified (see verification below).
- `@vitejs/plugin-react` and `vite-plugin-wasm` were added as `devDependencies` (pinned to
  the pnpm catalog, matching how `vite` itself was already declared).
- **`resolve: { conditions: ['source'] }` is required — a real gap in `composerPlugin`,
  not just this plugin's config.** This package's own `#capabilities`/`#containers`/`#hooks`/
  `#operations`/`#meta`/`#translations`/`#types` subpath imports (declared in `package.json`
  `imports`) resolve via either `source` (→ `src/**`, TypeScript) or `default` (→
  `dist/lib/neutral/**/*.mjs`, the in-monorepo `dx-compile` output). `composerPlugin` itself
  configures no `resolve.conditions` at all (confirmed by reading
  `packages/sdk/app-framework/src/vite-plugin/composer/index.ts` in full — no `resolve` key
  anywhere in its returned Vite config). Without an explicit `source` preference, Vite/rolldown
  falls through to `default`, which only exists if `moon run plugin-readwise:build` has
  already populated `dist/lib` — and Vite's build starts by emptying `dist/` (`emptyOutDir`
  default), which deletes that very directory before rolldown reads it. The net effect: a
  plain `composerPlugin`-only config **builds successfully only by accident**, when a stale
  `dist/lib` from an earlier moon build happens to still be on disk, and fails outright
  (`Rolldown failed to resolve import "#capabilities"`) on a clean checkout or a second
  consecutive `vite build`. Verified directly: removed `resolve.conditions` and reproduced the
  failure 3 times in a row from a clean `dist/`; added it back and reproduced success 3 times
  in a row. Adding `resolve: { conditions: ['source'] }` makes the bundle self-sufficient —
  it always compiles straight from this package's own TypeScript, matching how
  `composer-app`'s own `vite.config.ts` prefers `source` for in-repo `@dxos/*`/`#*` imports
  (via `tools/vite-plugin-import-source`, a heavier oxc-resolver-based plugin this package
  does not need since it only requires the condition preference, not cross-package rewriting).
  **This is worth fixing upstream in `composerPlugin` itself** (default `resolve.conditions`
  to include `'source'` so every future external-plugin author gets this for free instead of
  independently rediscovering the same failure) — flagged here rather than changed, since
  `composerPlugin` is shared infrastructure outside this plugin's scope.

## 3. Build output

```
$ npx vite build
dist/index.mjs        21.67 kB
dist/manifest.json     4.36 kB
dist/chunks/*.js       (58 code-split chunks — lazy capabilities, operation handlers, and
                        the bundled copies of Bookmark/Kanban/SyncBinding types)
```

`dist/manifest.json` key fields:

```json
{
  "key": "org.dxos.plugin.readwise",
  "name": "Readwise",
  "version": "0.0.1",
  "dependencies": {
    "@dxos/ai": "0.10.0",
    "@dxos/app-framework": "0.10.0",
    "@dxos/app-toolkit": "0.10.0",
    "@dxos/assistant-toolkit": "0.10.0",
    "@dxos/compute": "0.10.0",
    "@dxos/echo": "0.10.0",
    "@dxos/echo-react": "0.10.0",
    "@dxos/edge-client": "0.10.0",
    "@dxos/errors": "0.10.0",
    "@dxos/invariant": "0.10.0",
    "@dxos/keys": "0.10.0",
    "@dxos/log": "0.10.0",
    "@dxos/plugin-assistant": "0.10.0",
    "@dxos/plugin-bookmarks": "0.10.0",
    "@dxos/plugin-client": "0.10.0",
    "@dxos/plugin-connector": "0.10.0",
    "@dxos/plugin-kanban": "0.10.0",
    "@dxos/react-client": "0.10.0",
    "@dxos/react-ui-list": "0.10.0",
    "@dxos/react-ui-menu": "0.10.0",
    "@dxos/react-ui-mosaic": "0.10.0",
    "@dxos/schema": "0.10.0",
    "@dxos/types": "0.10.0",
    "@dxos/util": "0.10.0",
    "@effect-atom/atom-react": "0.5.0",
    "@effect/ai": "0.36.0",
    "effect": "3.21.4"
  },
  "assets": ["chunks/…", "…", "index.mjs"]
}
```

`key` matches `org.dxos.plugin.readwise` as required. `dependencies` is the resolved-version
snapshot the extraction rewrite (Step 4 below) targets — note it lists every declared
dependency, including the 5 non-externalized `@dxos/plugin-*` packages, for transparency, even
though only the 19 packages in `DEFAULT_PACKAGES` (§1 above) actually matter for host SDK
compatibility.

## 4. Runbook — moving to an external repo

1. **Copy files** to the new repo root: `src/`, `package.json`, `dx.config.ts`,
   `vite.config.ts`. Also copy `PLUGIN.mdl` (referenced by `dx.config.ts`'s `spec` field and
   bundled as a plugin asset at runtime) and `vitest.config.ts`/`tsconfig.json` if you want
   the same test/type setup outside moon.

2. **Rewrite `@dxos/*` `workspace:*` → npm semver.** Every `workspace:*` entry in
   `package.json` `dependencies`/`devDependencies`/`peerDependencies` becomes a real semver
   range, matching the built manifest's `dependencies` snapshot above (Composer's host SDK
   version at build time — `0.10.0` as of this build). Example:

   ```diff
   - "@dxos/app-framework": "workspace:*",
   + "@dxos/app-framework": "^0.10.0",
   - "@dxos/plugin-bookmarks": "workspace:*",
   + "@dxos/plugin-bookmarks": "^0.10.0",
   ```

   Keep this in lockstep with whatever Composer host version you're targeting — see the
   version-skew caveat in §1: an extracted plugin pinned to a stale `@dxos/plugin-bookmarks`/
   `@dxos/plugin-kanban`/`@dxos/plugin-connector` risks a schema-shape mismatch with a newer
   host, even though type-identity resolution (typename-based) itself won't break.

3. **Keep `dx.config.ts` verbatim** — the `publish` block already declares
   `buildCommand: 'vite build'` and `outputDirectory: 'dist'`; nothing in `dx.config.ts`
   references monorepo-relative paths.

4. **Install and build:**

   ```sh
   npm install
   npm run build   # or: npx vite build
   ```

   Verify `dist/index.mjs` + `dist/manifest.json` are emitted, `manifest.json`'s `key` is
   `org.dxos.plugin.readwise`, and `assets` includes `index.mjs`.

5. **Local runtime-load test (MANUAL step — requires a running Composer).**

   ```sh
   npx vite     # dev server, default port 3967, serves manifest.json + live-reloading entry
   ```

   In a locally-running Composer (`moon run composer-app:serve` from the monorepo, or the
   deployed app): open **Settings → Plugins → Plugin Registry**, set `devPluginUrl` to
   `http://localhost:3967/manifest.json`, and enable `devPluginEnabled`
   (`packages/plugins/plugin-registry/src/components/RegistrySettings/RegistrySettings.tsx`).
   Confirm:
   - The Readwise schema module activates (no console errors resolving `Bookmark`/`Kanban`
     from the bundled dev server against the host's live ECHO database).
   - The triage board's "Sync Readwise" action appears and is wired to a resolvable
     `ReadwiseOperation.Sync` handler.

   This step was **not executed** as part of this task — it requires a human-operated
   browser session against a running Composer instance and is documented here as the
   verification a human (or a future automated harness) runs before publishing.

6. **Publish:**

   ```sh
   dx registry publish --handle <bsky-handle> --app-password <app-password>
   ```

   Per `packages/plugins/plugin-registry/src/commands/registry/publish.ts`, this: runs
   `publish.buildCommand` (unless `--no-build`), reads the emitted `manifest.json`, uploads
   the `dist/` bundle to the DXOS edge registry (or an `assetBaseUrl` you host yourself), then
   writes `plugin.profile` + `plugin.release` ATProto records to the authenticated publisher's
   PDS, anchored by a `sha256-` hash of the manifest. Composer's registry UI picks up the new
   release from there — no GitHub release or `community-plugins.json` PR needed (that flow,
   documented in `tools/composer-plugin-dev/skills/composer-plugin-dev/references/
   publishing.md`, describes an older/parallel GitHub-releases-based registry and is now
   superseded by the ATProto-based `dx registry publish` path for this SDK version).

## 5. `dx.config.ts` — publish block

```ts
export default Config2.make({
  plugin: { /* … unchanged … */ },
  publish: {
    buildCommand: 'vite build',
    outputDirectory: 'dist',
  },
});
```

Matches the `Config2.Publish` schema (`packages/core/protocols/src/Config2.ts`): `buildCommand`
is the shell command `dx registry publish` runs before reading `dist/manifest.json`;
`outputDirectory` tells it where to look. `assetBaseUrl` is omitted — defaults to uploading via
the edge registry rather than a self-hosted URL.

## Verification (in-tree, this task)

```
$ moon run plugin-readwise:build   # 0 TS errors
$ moon run plugin-readwise:test    # 10 files, 20 tests passed
$ moon run plugin-readwise:lint    # 0 warnings, 0 errors
$ npx vite build                   # dist/index.mjs + dist/manifest.json emitted, key = org.dxos.plugin.readwise
```

All four green on the same working tree — adding `composerPlugin` did not require any change
to `src/`, and the moon build/test/lint tasks never invoke vite.
