//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { Operation } from '@dxos/compute';
import { DXN, Ref } from '@dxos/echo';
import {
  // eslint-disable-next-line unused-imports/no-unused-imports
  type Connection,
  SyncBinding,
} from '@dxos/plugin-connector';

import { meta } from '#meta';

const makeKey = (name: string) => DXN.make(`${meta.profile.key}.operation.${name}`);

/**
 * Reconcile Readwise highlights for one {@link SyncBinding}. The binding's source is the
 * {@link Connection} that authenticates the pull; its `cursor` is the durable high-water mark
 * (an ISO `updatedAfter` timestamp) advanced on success. Pull-only (Readwise has no concept of
 * pushing local edits back) and idempotent — re-running with an unchanged cursor re-fetches
 * nothing new and {@link captureHighlights}'s dedup keys make a re-capture of the same page a
 * no-op. Matches the `Connector.sync` contract (`SyncInput`/`SyncOutput` in `@dxos/plugin-connector`)
 * so it can be wired as a `ConnectorEntry.sync` operation.
 */
export const Sync = Operation.make({
  meta: {
    key: makeKey('sync'),
    name: 'Sync Readwise Highlights',
    description: 'Pull new/updated Readwise highlights for one connection binding and capture them into ECHO.',
    icon: 'ph--arrows-clockwise--regular',
  },
  input: Schema.Struct({
    binding: Ref.Ref(SyncBinding.SyncBinding),
  }),
  output: Schema.Struct({
    created: Schema.Number,
    updated: Schema.Number,
    cards: Schema.Number,
  }),
}).pipe(Operation.visible);
