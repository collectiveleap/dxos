//
// Copyright 2026 DXOS.org
//

import React, { useMemo, useRef } from 'react';

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
  const rows = useMemo(() => outlineRows(edges, subject), [edges, subject]);

  const controllerRef = useRef<OutlineController | undefined>(undefined);
  if (!controllerRef.current && db) {
    controllerRef.current = new OutlineController({ db, root: subject, getRows: () => rows });
  }
  controllerRef.current?.setCtx({ db: db!, root: subject, getRows: () => rows });

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
