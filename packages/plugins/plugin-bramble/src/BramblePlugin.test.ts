//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { AppActivationEvents } from '@dxos/app-toolkit';
import { createComposerTestApp } from '@dxos/plugin-testing/harness';

import { BramblePlugin } from './BramblePlugin';
import { meta } from './meta';

const moduleId = (name: string) => `${meta.id}.module.${name}`;

// Smoke test for plugin-bramble. Mirrors plugin-chess's pattern.
// Scope kept narrow: verify the plugin loads under the headless
// harness and the schema module activates on `SetupSchema`. Surface
// rendering, createObject, and the appgraph module are exercised by
// browser-mode tests in a follow-up — those need a JSDOM environment
// and a ClientPlugin-backed harness.
describe('BramblePlugin', () => {
  test('schema module activates on SetupSchema', async ({ expect }) => {
    await using harness = await createComposerTestApp({
      plugins: [BramblePlugin()],
    });

    await harness.fire(AppActivationEvents.SetupSchema);
    expect(harness.manager.getActive()).toContain(moduleId('schema'));
  });
});
