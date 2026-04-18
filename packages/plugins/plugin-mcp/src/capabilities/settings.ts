//
// Copyright 2025 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capability } from '@dxos/app-framework';
import { AppCapabilities } from '@dxos/app-toolkit';
import { createKvsStore } from '@dxos/effect';

import { meta } from '#meta';
import { McpCapabilities, Settings } from '#types';

export default Capability.makeModule(() =>
  Effect.sync(() => {
    const settingsAtom = createKvsStore({
      key: meta.id,
      schema: Settings.Settings,
      defaultValue: () => ({
        servers: [],
      }),
    });

    return [
      Capability.contributes(McpCapabilities.Settings, settingsAtom),
      Capability.contributes(AppCapabilities.Settings, {
        prefix: meta.id,
        schema: Settings.Settings,
        atom: settingsAtom,
      }),
    ];
  }),
);
