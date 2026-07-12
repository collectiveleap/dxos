//
// Copyright 2026 DXOS.org
//

import React, { useMemo } from 'react';

import { Filter, Obj, Query } from '@dxos/echo';
import { useQuery } from '@dxos/react-client/echo';

import { OutlineRow } from './OutlineRow';
import { RowEditor } from './RowEditor';
import { outlineRows } from '../../model/outline';
import { Edge, type Node } from '../../types';

export type NodeOutlineProps = { subject: Node; role?: string };

export const NodeOutline = ({ subject }: NodeOutlineProps) => {
  // Use the live `subject` (a Node entity) for the view-model root and the header
  // editor; reactivity comes from `useQuery` (rows) and RowEditor's own text binding,
  // so the `useObject` snapshot (a `Snapshot<Node>`, not assignable to `Node`) isn't needed.
  const db = Obj.getDatabase(subject);
  const edges = useQuery(db, Query.select(Filter.type(Edge))) as Edge[];
  const rows = useMemo(() => outlineRows(edges, subject), [edges, subject]);

  return (
    <div data-testid='bramble-outline' role='tree'>
      <div data-testid='bramble-header'>
        <RowEditor node={subject} />
      </div>
      {rows.map((row) => (
        <OutlineRow key={row.node.id} row={row} />
      ))}
    </div>
  );
};
