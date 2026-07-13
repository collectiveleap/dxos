//
// Copyright 2026 DXOS.org
//

import React, { useMemo, useReducer, useRef } from 'react';

import { Filter, Obj, Query } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { useQuery } from '@dxos/react-client/echo';

import { OutlineController, OutlineControllerContext } from './controller';
import { OutlineRow } from './OutlineRow';
import { RowEditor } from './RowEditor';
import { outlineRows } from '../../model/outline';
import { Edge, type Node } from '../../types';

export type NodeOutlineProps = { subject: Node; role?: string };

export const NodeOutline = ({ subject }: NodeOutlineProps) => {
  // Use the live `subject` (a Node entity) for the view-model root and the header
  // editor; reactivity comes from `useQuery` (rows) and RowEditor's own text binding,
  // so the `useObject` snapshot (a `Snapshot<Node>`, not assignable to `Node`) isn't needed.
  const db = Obj.getDatabase(subject) as EchoDatabase | undefined;
  const edges = useQuery(db, Query.select(Filter.type(Edge))) as Edge[];
  // `useQuery`'s reactivity is membership-only (add/remove) — it does not re-render on an
  // in-place property mutation of an already-matching edge (e.g. `order`, for reorder). This
  // tick lets `OutlineController` force a re-render after such a mutation via `notifyMutated`.
  const [renderTick, forceRerender] = useReducer((c: number) => c + 1, 0);
  const rows = useMemo(() => outlineRows(edges, subject), [edges, subject, renderTick]);

  const controllerRef = useRef<OutlineController | undefined>(undefined);
  if (!controllerRef.current && db) {
    controllerRef.current = new OutlineController({ db, root: subject, getRows: () => rows, notifyMutated: forceRerender });
  }
  controllerRef.current?.setCtx({ db: db!, root: subject, getRows: () => rows, notifyMutated: forceRerender });

  return (
    <OutlineControllerContext.Provider value={controllerRef.current ?? null}>
      <div data-testid='bramble-outline' role='tree'>
        <div data-testid='bramble-header'>
          <RowEditor node={subject} className='bramble-outline-header' />
        </div>
        {rows.map((row) => (
          <OutlineRow key={row.node.id} row={row} />
        ))}
      </div>
    </OutlineControllerContext.Provider>
  );
};
