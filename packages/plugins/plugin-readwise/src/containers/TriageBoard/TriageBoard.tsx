//
// Copyright 2026 DXOS.org
//

import { Atom, RegistryContext } from '@effect-atom/atom-react';
import React, { forwardRef, useCallback, useContext, useMemo, useState } from 'react';

import { useOperationInvoker } from '@dxos/app-framework/ui';
import { Obj, Query, Ref } from '@dxos/echo';
import { useObject } from '@dxos/echo-react';
import { type Kanban } from '@dxos/plugin-kanban';
import { Panel } from '@dxos/react-ui';
import { Board, type BoardColumnProps, type BoardModel } from '@dxos/react-ui-mosaic';
import { Menu, MenuBuilder, useMenuActions } from '@dxos/react-ui-menu';
import { Task } from '@dxos/types';

import { useReadwiseSyncBinding } from '#hooks';
import { meta } from '#meta';
import { ReadwiseOperation } from '#types';

/** Non-optional `Task.status`, the pivot the triage board's columns are keyed by. */
type TriageColumnValue = Exclude<Task.Task['status'], undefined>;

/** Fixed column order for the triage board — the source of truth {@link TRIAGE_COLUMN_TITLES} is keyed by. */
const TRIAGE_COLUMNS = ['todo', 'in-progress', 'done'] as const satisfies readonly TriageColumnValue[];

/**
 * Column titles for the triage lifecycle, keyed by `Task.status`. A render-only label mapping —
 * `Task.status`'s own single-select option titles stay `Todo`/`In Progress`/`Done` (overriding
 * those would mean mutating the shared `@dxos/types` schema, which this plugin never does).
 */
const TRIAGE_COLUMN_TITLES: Record<TriageColumnValue, string> = {
  'todo': 'Needs Review',
  'in-progress': 'In Triage',
  'done': 'Done',
};

/** Minimal column tile: a labeled header (from {@link TRIAGE_COLUMN_TITLES}) over the default item list. */
const TriageColumn = forwardRef<HTMLDivElement, BoardColumnProps<TriageColumnValue>>(
  ({ classNames, location, data: column, debug, draggable }, forwardedRef) => (
    <Board.Column.Root
      classNames={classNames}
      location={location}
      data={column}
      debug={debug}
      draggable={draggable}
      ref={forwardedRef}
    >
      <div className='border-b border-separator p-2' data-testid='triage-board-column-header'>
        <span className='font-medium'>{TRIAGE_COLUMN_TITLES[column]}</span>
      </div>
      <Board.Column.Body data={column} />
    </Board.Column.Root>
  ),
);

TriageColumn.displayName = 'TriageColumn';

export type TriageBoardProps = {
  readonly kanban: Kanban.Kanban;
  /** Threaded into the toolbar's `Menu.Root` so attention-driven contributions target this surface. */
  readonly attendableId?: string;
};

/**
 * Minimal triage board: three fixed columns (`todo` / `in-progress` / `done`), each populated by
 * re-running the board's `View` query and filtering to that column's `status` client-side. Reuses
 * `Board.Root`/`Board.Content`/`Board.Column`'s default item tile (`@dxos/react-ui-mosaic`) rather
 * than copying `plugin-kanban`'s internal `KanbanColumn`/`KanbanCard` — those aren't part of that
 * package's public surface (see `packages/plugins/plugin-kanban/package.json` `exports`).
 *
 * The toolbar's "Sync Readwise" action invokes `ReadwiseOperation.Sync` directly for the space's
 * Readwise `SyncBinding` (found via `useReadwiseSyncBinding`) — Increment 1 has no `Connector`
 * registration for Readwise (see `docs/superpowers/specs/2026-07-04-readwise-annotation-triage-design.md`
 * §7: "a Sync operation Steve triggers"), so the generic `plugin-connector` fan-out
 * (`ConnectorOperation.SyncConnection`) isn't available here.
 */
export const TriageBoard = ({ kanban, attendableId }: TriageBoardProps) => {
  const { invokePromise } = useOperationInvoker();
  const registry = useContext(RegistryContext);
  const db = Obj.getDatabase(kanban);
  const [view] = useObject(kanban.spec.kind === 'view' ? kanban.spec.view : undefined);
  const binding = useReadwiseSyncBinding(db);
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (!binding) {
      return;
    }
    setSyncing(true);
    try {
      await invokePromise(ReadwiseOperation.Sync, { binding: Ref.make(binding) }, { spaceId: db?.spaceId });
    } finally {
      setSyncing(false);
    }
  }, [binding, db?.spaceId, invokePromise]);

  const actionsAtom = useMemo(
    () =>
      Atom.make(() =>
        MenuBuilder.make()
          .action(
            'sync',
            {
              label: [syncing ? 'sync-readwise-syncing.label' : 'sync-readwise.label', { ns: meta.profile.key }],
              icon: 'ph--arrows-clockwise--regular',
              disposition: 'toolbar',
              disabled: !binding || syncing,
            },
            handleSync,
          )
          .build(),
      ),
    [binding, syncing, handleSync],
  );
  const menuActions = useMenuActions(actionsAtom);

  const itemsAtom = useMemo(() => {
    if (!db || !view) {
      return undefined;
    }
    return db.query(Query.fromAst(view.query.ast)).atom;
  }, [db, view]);

  const model = useMemo<BoardModel<TriageColumnValue, Task.Task> | undefined>(() => {
    if (!itemsAtom) {
      return undefined;
    }
    const itemsInColumn = (items: Obj.Unknown[], column: TriageColumnValue) =>
      items.filter((item): item is Task.Task => Obj.instanceOf(Task.Task, item) && item.status === column);

    return {
      getColumnId: (column) => column,
      getItemId: (item) => item.id,
      isColumn: (value): value is TriageColumnValue => typeof value === 'string' && value in TRIAGE_COLUMN_TITLES,
      isItem: Obj.instanceOf(Task.Task),
      columns: Atom.make(() => TRIAGE_COLUMNS),
      items: (column) => Atom.make((get) => itemsInColumn(get(itemsAtom), column)),
      getColumns: () => [...TRIAGE_COLUMNS],
      getItems: (column) => itemsInColumn(registry.get(itemsAtom) ?? [], column),
    };
  }, [itemsAtom, registry]);

  if (!model) {
    return null;
  }

  return (
    <Panel.Root>
      <Panel.Toolbar>
        <Menu.Root {...menuActions} attendableId={attendableId ?? 'triage-board'} alwaysActive>
          <Menu.Toolbar />
        </Menu.Root>
      </Panel.Toolbar>
      <Board.Root model={model}>
        <Panel.Content asChild>
          <Board.Content Tile={TriageColumn} />
        </Panel.Content>
      </Board.Root>
    </Panel.Root>
  );
};
