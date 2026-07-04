//
// Copyright 2026 DXOS.org
//

import { Atom, RegistryContext } from '@effect-atom/atom-react';
import React, { forwardRef, useContext, useMemo } from 'react';

import { Obj, Query } from '@dxos/echo';
import { useObject } from '@dxos/echo-react';
import { type Kanban } from '@dxos/plugin-kanban';
import { Panel } from '@dxos/react-ui';
import { Board, type BoardColumnProps, type BoardModel } from '@dxos/react-ui-mosaic';
import { Task } from '@dxos/types';

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
};

/**
 * Minimal triage board: three fixed columns (`todo` / `in-progress` / `done`), each populated by
 * re-running the board's `View` query and filtering to that column's `status` client-side. Reuses
 * `Board.Root`/`Board.Content`/`Board.Column`'s default item tile (`@dxos/react-ui-mosaic`) rather
 * than copying `plugin-kanban`'s internal `KanbanColumn`/`KanbanCard` — those aren't part of that
 * package's public surface (see `packages/plugins/plugin-kanban/package.json` `exports`).
 */
export const TriageBoard = ({ kanban }: TriageBoardProps) => {
  const registry = useContext(RegistryContext);
  const db = Obj.getDatabase(kanban);
  const [view] = useObject(kanban.spec.kind === 'view' ? kanban.spec.view : undefined);

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
      getColumns: () => TRIAGE_COLUMNS,
      getItems: (column) => itemsInColumn(registry.get(itemsAtom) ?? [], column),
    };
  }, [itemsAtom, registry]);

  if (!model) {
    return null;
  }

  return (
    <Panel.Root>
      <Board.Root model={model}>
        <Panel.Content asChild>
          <Board.Content Tile={TriageColumn} />
        </Panel.Content>
      </Board.Root>
    </Panel.Root>
  );
};
