//
// Copyright 2026 DXOS.org
//

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

import { composerPlugin } from '@dxos/app-framework/vite-plugin';

/**
 * External-plugin build: emits a self-contained ESM bundle (`dist/index.mjs` +
 * `dist/manifest.json`) that the Composer host loads at runtime via import map
 * externalization (see `composerPlugin`). Exists alongside — not instead of —
 * the in-monorepo `moon.yml` `compile`/`build` tasks: this config is excluded from
 * `tsconfig.json` and outside the moon task graph, so it only runs when invoked
 * directly (`vite build` / `vite dev`), never as part of `moon run plugin-readwise:build`.
 *
 * Entry is the browser variant of the plugin definition directly (not `src/plugin.ts`,
 * which wraps it in `Plugin.lazy` for in-monorepo code-splitting — an external bundle
 * has no host-side chunk to lazy-load, so the direct definition is the correct entry).
 *
 * `resolve.conditions: ['source']` is load-bearing: this package's own `#capabilities`,
 * `#containers`, `#hooks`, etc. subpath imports (declared in `package.json` `imports`)
 * only have `source` (→ `src/**`) and `default` (→ the `dx-compile` output in `dist/lib`)
 * conditions — no plain "resolve from this package's own src" condition exists otherwise.
 * Vite's build always starts from a clean `dist/` (`emptyOutDir`), which — without this —
 * deletes the very `dist/lib` the `default` condition depends on before rolldown reads it,
 * so an external build would only succeed by accident (whenever a stale `dist/lib` from a
 * prior `moon run plugin-readwise:build` happened to still be on disk). Preferring `source`
 * makes the bundle self-sufficient: it compiles straight from TypeScript regardless of
 * `dist/lib`'s state, exactly like `composer-app`'s own `vite.config.ts` does for in-repo
 * `@dxos/*`/`#*` imports via `tools/vite-plugin-import-source`.
 */
export default defineConfig({
  resolve: {
    conditions: ['source'],
  },
  plugins: [wasm(), composerPlugin({ entry: 'src/ReadwisePlugin.tsx' }), react()],
});
