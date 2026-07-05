//
// Copyright 2026 DXOS.org
//

import { useMemo } from 'react';

import { type Database, Filter, Relation } from '@dxos/echo';
import { SyncBinding } from '@dxos/plugin-connector';
import { useQuery } from '@dxos/react-client/echo';

import { type Readwise } from '../types';

/** Selects the `SyncBinding` whose target is the given container, if one exists. */
export const selectBindingForTarget = (
  bindings: readonly SyncBinding.SyncBinding[],
  containerId: string,
): SyncBinding.SyncBinding | undefined =>
  bindings.find((binding) => Relation.getTarget(binding).id === containerId);

/** React hook: the `SyncBinding` bound to `container` in `db`, or undefined when not yet connected. */
export const useReadwiseSyncBinding = (
  db: Database.Database | undefined,
  container: Readwise.Readwise | undefined,
): SyncBinding.SyncBinding | undefined => {
  const bindings = useQuery(db, Filter.type(SyncBinding.SyncBinding));
  return useMemo(
    () => (container ? selectBindingForTarget(bindings, container.id) : undefined),
    [bindings, container?.id],
  );
};
