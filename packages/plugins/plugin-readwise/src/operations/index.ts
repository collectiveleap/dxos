//
// Copyright 2026 DXOS.org
//

import { OperationHandlerSet } from '@dxos/compute';

export * from './capture';
export * from './ensure-board';

/**
 * Lazily-loaded handler set contributed to `Capabilities.OperationHandler` (see
 * `capabilities/operation-handler.ts`). Triage operations are added in a later task.
 */
export const ReadwiseOperationHandlerSet = OperationHandlerSet.lazy(() => import('./sync'));
