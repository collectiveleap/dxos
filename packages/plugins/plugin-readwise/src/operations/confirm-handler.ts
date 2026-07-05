//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Operation } from '@dxos/compute';
import { Database } from '@dxos/echo';

import { ReadwiseOperation } from '../types';
import { confirmItems } from './confirm';

/**
 * UI-facing handler for `ReadwiseOperation.Confirm`: delegates straight to `confirmItems`, letting
 * the `TriageCard` container materialize Steve's decisions through the operation-invoker rather
 * than calling the space-layer function directly.
 */
const handler: Operation.WithHandler<typeof ReadwiseOperation.Confirm> = ReadwiseOperation.Confirm.pipe(
  Operation.withHandler(
    Effect.fn(function* ({ card, decisions }) {
      const { db } = yield* Database.Service;
      const { results } = yield* confirmItems({ db }, card, decisions);
      return { results };
    }),
  ),
);

export default handler;
