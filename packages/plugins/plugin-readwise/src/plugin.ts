//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';

import { meta } from './meta';

export const ReadwisePlugin = Plugin.lazy(meta, () => import('#plugin'));

export { ReadwiseOperationHandlerSet } from './operations';
