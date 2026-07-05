//
// Copyright 2026 DXOS.org
//

import { OperationHandlerSet } from '@dxos/compute';

export * from './capture';

/**
 * Lazily-loaded handler set contributed to `Capabilities.OperationHandler` (see
 * `capabilities/operation-handler.ts`).
 */
export const ReadwiseOperationHandlerSet = OperationHandlerSet.lazy(
  () => import('./sync'),
);
