//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Operation, OperationHandlerSet } from '@dxos/compute';
import { Database, Obj, Ref } from '@dxos/echo';

import { DatabaseNotFoundError } from '../errors';
import { SensemakingOperation } from '../types';

import { connect, createResult } from './triage';

export * from './triage';

/**
 * Resolves the `db` reachable from a preloaded capture, failing with a typed {@link DatabaseNotFoundError}
 * when the ref has not been resolved (mirrors `plugin-readwise`'s `sync.ts` guard, but as a recoverable
 * domain error rather than a defect).
 */
const CreateResultHandler = SensemakingOperation.CreateResult.pipe(
  Operation.withHandler(
    Effect.fnUntraced(function* (input) {
      const capture = yield* Database.load(input.capture);
      const db = Obj.getDatabase(capture);
      if (!db) {
        return yield* Effect.fail(new DatabaseNotFoundError());
      }
      const { result } = createResult(db, capture, input.kind, input.body);
      return { result: Ref.make(result) };
    }),
  ),
);

const ConnectHandler = SensemakingOperation.Connect.pipe(
  Operation.withHandler(
    Effect.fnUntraced(function* (input) {
      const capture = yield* Database.load(input.capture);
      const db = Obj.getDatabase(capture);
      if (!db) {
        return yield* Effect.fail(new DatabaseNotFoundError());
      }
      const target = yield* Database.load(input.target);
      connect(db, capture, target);
      return {};
    }),
  ),
);

/**
 * Lazily-loaded handler set contributed to `Capabilities.OperationHandler` (see
 * `capabilities/operation-handler.ts`).
 */
export const SensemakingOperationHandlerSet = OperationHandlerSet.make(CreateResultHandler, ConnectHandler);
