//
// Copyright 2026 DXOS.org
//

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfig } from '../../../vitest.base.config';

export default createConfig({
  dirname: typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url)),
  // `ReadwisePlugin.test.ts`'s `createComposerTestApp` harness boot (client + full plugin
  // manager activation) consistently takes ~20-25s in this environment — past vitest's 15s
  // default `testTimeout` — so it's raised here rather than treating the timeout as a one-off flake.
  node: { timeout: 30_000 },
});
