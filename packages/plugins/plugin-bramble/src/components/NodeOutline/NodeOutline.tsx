//
// Copyright 2026 DXOS.org
//

import React, { useMemo } from 'react';

import { Filter, Obj, Query } from '@dxos/echo';
import { useObject, useQuery } from '@dxos/react-client/echo';

import { OutlineRow } from './OutlineRow';
import { RowEditor } from './RowEditor';
import { outlineRows } from '../../model/outline';
import { Edge, type Node } from '../../types';

export type NodeOutlineProps = { subject: Node; role?: string };

export const NodeOutline = ({ subject }: NodeOutlineProps) => {
  const [root] = useObject(subject);
  const db = Obj.getDatabase(subject);
  const edges = useQuery(db, Query.select(Filter.type(Edge))) as Edge[];
  const rows = useMemo(() => (root ? outlineRows(edges, root) : []), [edges, root]);

  if (!root) {
    return null;
  }
  return (
    <div data-testid='bramble-outline' role='tree'>
      <div data-testid='bramble-header'>
        <RowEditor node={root} />
      </div>
      {rows.map((row) => (
        <OutlineRow key={row.node.id} row={row} />
      ))}
    </div>
  );
};
