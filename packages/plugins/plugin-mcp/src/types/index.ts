//
// Copyright 2025 DXOS.org
//

import type { Atom } from '@effect-atom/atom-react';

import { Capability } from '@dxos/app-framework';

import { meta } from '#meta';

import type * as Settings from './Settings';

export * as Settings from './Settings';

export namespace McpCapabilities {
  export const Settings = Capability.make<Atom.Writable<Settings.Settings>>(`${meta.id}.capability.settings`);
}
