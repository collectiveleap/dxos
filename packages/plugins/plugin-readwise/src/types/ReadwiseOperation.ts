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
  MaterializeTargetInput,
  MaterializeTargetOutput,
  SyncBinding,
} from '@dxos/plugin-connector';

import { meta } from '#meta';

const makeKey = (name: string) => DXN.make(`${meta.profile.key}.operation.${name}`);

/**
 * Reconcile Readwise highlights for one {@link SyncBinding}. The binding's source is the Connection
 * that authenticates the pull; its `cursor` is the durable high-water mark (an ISO `updatedAfter`
 * timestamp) advanced on success. Pull-only and idempotent. Matches the `Connector.sync` contract
 * (`SyncInput`/`SyncOutput` in `@dxos/plugin-connector`) so it is wired as a `ConnectorEntry.sync`.
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
  }),
}).pipe(Operation.visible);

/**
 * Creates the `Readwise` container for a new connection (the Connector framework calls this when
 * connecting without an existing target). Mirrors `plugin-inbox`'s `MaterializeJmapTarget`.
 */
export const MaterializeTarget = Operation.make({
  meta: {
    key: makeKey('materializeTarget'),
    name: 'Create Readwise',
    description: 'Create the Readwise account container for a new connection.',
    icon: 'ph--book-open--regular',
  },
  input: MaterializeTargetInput,
  output: MaterializeTargetOutput,
});
