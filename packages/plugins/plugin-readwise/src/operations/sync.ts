//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import type * as Layer from 'effect/Layer';

import { Operation } from '@dxos/compute';
import { Database, Obj, Relation } from '@dxos/echo';
import { Cursor } from '@dxos/types';

import { formatReadwiseSyncFailure } from '../errors';
import { ReadwiseApi, ReadwiseApiLayer, ReadwiseCredentials, type Transport, TransportLive } from '../services';
import { ReadwiseOperation } from '../types';
import { captureHighlights } from './capture';
import { ensureTriageBoard } from './ensure-board';

/**
 * Builds the `Sync` handler with the given {@link Transport} layer. Defaults to the production
 * `TransportLive.edgeProxy` (see {@link handler}, the module's default export used by the plugin's
 * `OperationHandlerSet`); tests call this factory directly with a mock layer instead, since
 * `Effect.provide` inside the handler body would otherwise always win over one supplied from
 * outside (the innermost `provide` in an Effect pipeline satisfies the requirement first).
 *
 * Reconciles one Readwise {@link SyncBinding}: resolves the binding's `Connection` for
 * credentials, pulls every highlight updated since the binding's cursor, captures them into ECHO
 * via `captureHighlights`, then advances the cursor to the ISO timestamp captured at the start of
 * this run (not the highlights' own `updated` fields — the run-start time is a safe high-water
 * mark even when Readwise returns items out of update order). On failure the cursor records
 * `lastError` and its `value` is left untouched, so the next run resumes from the same position
 * rather than skipping unprocessed highlights.
 *
 * Mirrors `plugin-linear`'s `SyncLinearTeams` handler shape: the caller (`SyncConnection` in
 * `plugin-connector`, or a direct invocation) is responsible for preloading `binding.target` —
 * `Ref.make` on an already-resolved relation — since the operation has no `Database.Service` in
 * its `services` list (the database isn't known until the binding is resolved).
 */
export const makeHandler = (
  transportLayer: Layer.Layer<Transport> = TransportLive.edgeProxy,
): Operation.WithHandler<typeof ReadwiseOperation.Sync> =>
  ReadwiseOperation.Sync.pipe(
    Operation.withHandler(
      Effect.fn(function* ({ binding: bindingRef }) {
        const bindingTarget = bindingRef.target;
        if (!bindingTarget) {
          return yield* Effect.dieMessage('Binding ref must be preloaded by caller (relation not resolved).');
        }
        const db = Obj.getDatabase(bindingTarget);
        if (!db) {
          return yield* Effect.dieMessage('Binding ref must be preloaded by caller (no database derivable).');
        }
        const dbLayer = Database.layer(db);

        const runStartedAt = new Date().toISOString();

        const binding = yield* Database.load(bindingRef).pipe(Effect.provide(dbLayer));
        const cursor = yield* Database.load(binding.cursor).pipe(Effect.provide(dbLayer));
        const connection = Relation.getSource(binding);

        const outcome = yield* Effect.either(
          Effect.gen(function* () {
            const { highlights } = yield* ReadwiseApi.pipe(
              Effect.flatMap((api) => api.listHighlightsSince(cursor.value)),
            );
            const result = yield* captureHighlights({ db }, highlights);
            // Find-or-create the triage board once per sync so it exists after the first run;
            // idempotent, so re-running never creates a duplicate board.
            yield* ensureTriageBoard({ db });
            return result;
          }).pipe(
            Effect.provide(dbLayer),
            Effect.provide(ReadwiseCredentials.fromConnection(connection)),
            Effect.provide(ReadwiseApiLayer),
            Effect.provide(transportLayer),
          ),
        );

        if (outcome._tag === 'Right') {
          Cursor.advance(cursor, runStartedAt);
          return outcome.right;
        }

        Cursor.recordError(cursor, formatReadwiseSyncFailure(outcome.left));
        return yield* Effect.fail(outcome.left);
      }),
    ),
  );

const handler: Operation.WithHandler<typeof ReadwiseOperation.Sync> = makeHandler();

export default handler;
