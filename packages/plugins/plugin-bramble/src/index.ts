//
// Copyright 2025 DXOS.org
//

import { Plugin } from '@dxos/app-framework';

import { meta } from './meta';

export const BramblePlugin = Plugin.lazy(meta, () => import('./BramblePlugin'));

export * from './meta';
