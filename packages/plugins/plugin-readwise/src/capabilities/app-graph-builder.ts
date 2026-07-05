//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capability } from '@dxos/app-framework';
import { AppCapabilities } from '@dxos/app-toolkit';
import { Operation } from '@dxos/compute';
import { Filter, Obj, Query, Ref } from '@dxos/echo';
import { invariant } from '@dxos/invariant';
import { SyncBinding } from '@dxos/plugin-connector';
import { GraphBuilder, Node } from '@dxos/plugin-graph';

import { meta } from '#meta';

import { selectBindingForTarget } from '../hooks';
import { Readwise, ReadwiseOperation } from '../types';

/**
 * Adds an always-reachable "Sync" toolbar action to every `Readwise` node — independent of any open
 * view. When the account is connected (a `SyncBinding` targets it), the action invokes `Sync`;
 * otherwise it is a no-op (the empty-state connect affordance handles first connection).
 */
export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    const extension = yield* GraphBuilder.createTypeExtension({
      id: 'readwiseSync',
      type: Readwise.Readwise,
      actions: (readwise: Readwise.Readwise) =>
        Effect.succeed([
          Node.makeAction({
            id: `${meta.profile.key}/sync`,
            data: () =>
              Effect.gen(function* () {
                const db = Obj.getDatabase(readwise);
                invariant(db, 'Readwise container has no database.');
                const bindings = yield* Effect.tryPromise(() =>
                  db.query(Query.select(Filter.type(SyncBinding.SyncBinding))).run(),
                );
                const binding = selectBindingForTarget(bindings, readwise.id);
                if (!binding) {
                  return; // not connected yet
                }
                yield* Operation.invoke(ReadwiseOperation.Sync, { binding: Ref.make(binding) }, { spaceId: db.spaceId });
              }),
            properties: {
              label: ['sync.label', { ns: meta.profile.key }],
              icon: 'ph--arrows-clockwise--regular',
              disposition: 'toolbar',
            },
          }),
        ]),
    });
    return Capability.contributes(AppCapabilities.AppGraphBuilder, [extension]);
  }),
);
