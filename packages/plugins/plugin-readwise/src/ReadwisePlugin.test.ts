//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { ActivationEvents, Capabilities } from '@dxos/app-framework';
import { AppCapabilities } from '@dxos/app-toolkit';
import { OperationHandlerSet } from '@dxos/compute';
import { Type } from '@dxos/echo';
import { EffectEx } from '@dxos/effect';
import { ClientPlugin } from '@dxos/plugin-client/plugin';
import { createComposerTestApp } from '@dxos/plugin-testing/harness';

import { ReadwisePlugin } from '#plugin';
import { Highlight, Readwise, ReadwiseOperation } from '#types';

import { meta } from './meta';

const moduleId = (name: string) => `${meta.profile.key}.module.${name}`;

describe('ReadwisePlugin', () => {
  test('schema module activates on startup and registers Readwise + Highlight', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()] });
    expect(harness.manager.getActive()).toEqual(expect.arrayContaining([moduleId('schema')]));

    const registeredTypenames = harness.getAll(AppCapabilities.Schema).flat().map(Type.getTypename);
    expect(registeredTypenames).toEqual(
      expect.arrayContaining([Type.getTypename(Readwise.Readwise), Type.getTypename(Highlight.Highlight)]),
    );
  });

  test('operation handler module activates on SetupProcessManager', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()] });
    // Operation handlers are not loaded on startup — SetupProcessManager fires lazily when an
    // operation is invoked (mirrors plugin-chess's `ChessPlugin.test.ts`).
    await harness.fire(ActivationEvents.SetupProcessManager);
    expect(harness.manager.getActive()).toContain(moduleId('OperationHandler'));
  });

  test('the sync action invokes a registered, resolvable ReadwiseOperation.Sync handler', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()] });
    await harness.fire(ActivationEvents.SetupProcessManager);

    // `ReadwiseContainer`'s inline sync affordance invokes `ReadwiseOperation.Sync` through the
    // operation invoker — proving the operation is registered and resolvable is sufficient here
    // (per the brief) since actually running it needs a live `SyncBinding` + network transport,
    // already covered without network by `operations/sync.test.ts`.
    const handlerSets = harness.getAll(Capabilities.OperationHandler);
    const handler = await EffectEx.runAndForwardErrors(
      OperationHandlerSet.getHandler(OperationHandlerSet.merge(...handlerSets), ReadwiseOperation.Sync),
    );
    expect(handler.meta.key).toBe(ReadwiseOperation.Sync.meta.key);
  });
});
