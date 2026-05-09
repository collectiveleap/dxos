//
// Copyright 2025 DXOS.org
//

import { Plugin } from '@dxos/app-framework';

import { meta } from './meta';

export const BlocksPlugin = Plugin.lazy(meta, () => import('./BlocksPlugin'));

export * from './meta';
