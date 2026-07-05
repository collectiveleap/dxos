//
// Copyright 2026 DXOS.org
//

import { OperationHandlerSet } from '@dxos/compute';

export * from './capture';
export * from './ensure-board';
export * from './decompose';
export * from './confirm';

/**
 * Lazily-loaded handler set contributed to `Capabilities.OperationHandler` (see
 * `capabilities/operation-handler.ts`).
 */
export const ReadwiseOperationHandlerSet = OperationHandlerSet.lazy(
  () => import('./sync'),
  () => import('./decompose-handler'),
  () => import('./confirm-handler'),
);
