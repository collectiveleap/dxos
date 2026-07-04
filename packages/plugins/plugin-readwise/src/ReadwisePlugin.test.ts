//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { ActivationEvents } from '@dxos/app-framework';
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

  test('operation handler module activates on SetupProcessManager', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()] });
    // Operation handlers are not loaded on startup — SetupProcessManager fires lazily when an
    // operation is invoked (mirrors plugin-chess's `ChessPlugin.test.ts`).
    await harness.fire(ActivationEvents.SetupProcessManager);
    expect(harness.manager.getActive()).toContain(moduleId('OperationHandler'));
  });
});
