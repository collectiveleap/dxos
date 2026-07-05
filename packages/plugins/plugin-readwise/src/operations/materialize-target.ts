//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Operation } from '@dxos/compute';
import { Database, Obj, Ref } from '@dxos/echo';

import { Readwise, ReadwiseOperation } from '../types';

/**
 * Eagerly materializes a local `Readwise` container so a `SyncBinding` can be created (relations
 * require both endpoints to exist). Readwise is a single-target connector (one account container
 * per connection), so a fresh container is always created. Mirrors `plugin-inbox`'s
 * `MaterializeJmapTarget`.
 */
const handler: Operation.WithHandler<typeof ReadwiseOperation.MaterializeTarget> =
  ReadwiseOperation.MaterializeTarget.pipe(
    Operation.withHandler(
      Effect.fnUntraced(function* ({ connection }) {
        // The operation derives the db from the connection ref's target and provides
        // `Database.layer(db)` itself (composer's invoker is wired without a `databaseResolver`).
        const connectionObj = connection.target;
        const db = connectionObj ? Obj.getDatabase(connectionObj) : undefined;
        if (!connectionObj || !db) {
          return yield* Effect.dieMessage('Connection ref must be preloaded by caller (relation not resolved).');
        }
        return yield* Effect.gen(function* () {
          const created = yield* Database.add(Readwise.make({ name: 'Readwise' }));
          return { target: Ref.make(created) };
        }).pipe(Effect.provide(Database.layer(db)));
      }),
    ),
  );

export default handler;
