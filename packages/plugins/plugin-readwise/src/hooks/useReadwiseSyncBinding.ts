//
// Copyright 2026 DXOS.org
//

import { useMemo } from 'react';

import { type Database, Filter, Relation } from '@dxos/echo';
import { SyncBinding } from '@dxos/plugin-connector';
import { useQuery } from '@dxos/react-client/echo';

import { READWISE_SOURCE } from '../constants';

/**
 * Finds the single `SyncBinding` sourced from a Readwise `Connection` in `db`, if one has been set
 * up (Connection/AccessToken setup itself is out of this plugin's scope — it's the generic
 * `plugin-connector` settings UI's job). Matched by `accessToken.source === READWISE_SOURCE`
 * rather than `Connection.connectorId`, since this plugin registers no `Connector` entry (Increment
 * 1 triggers sync directly via `ReadwiseOperation.Sync`, not the generic `ConnectorEntry.sync` fan-out).
 *
 * Reads `connection.accessToken.target` synchronously rather than via `useObject`, so the result
 * can lag one render behind the token's own async hydration in a freshly-opened space — acceptable
 * for a settings-adjacent toolbar affordance where the binding's own `useQuery` subscription still
 * drives eventual re-render once the referenced objects are loaded.
 */
export const useReadwiseSyncBinding = (db: Database.Database | undefined): SyncBinding.SyncBinding | undefined => {
  const bindings = useQuery(db, Filter.type(SyncBinding.SyncBinding));
  return useMemo(
    () =>
      bindings.find((binding) => Relation.getSource(binding).accessToken.target?.source === READWISE_SOURCE),
    [bindings],
  );
};
