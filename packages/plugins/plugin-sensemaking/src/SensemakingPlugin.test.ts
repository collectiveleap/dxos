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
