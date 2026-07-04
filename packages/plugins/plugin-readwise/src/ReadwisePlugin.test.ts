//
// Copyright 2026 DXOS.org
//

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
