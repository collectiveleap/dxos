//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { RowEditor } from './RowEditor';
import { type OutlineRow as OutlineRowModel } from '../../model/outline';

const INDENT_PX = 24;

export const OutlineRow = ({ row }: { row: OutlineRowModel }) => {
  return (
    <div data-testid='bramble-row' data-depth={row.depth} role='treeitem' style={{ paddingInlineStart: row.depth * INDENT_PX }}>
      <span data-testid='bramble-chevron' aria-hidden={!row.hasChildren} />
      <span data-testid='bramble-bullet' aria-hidden='true' />
      <RowEditor node={row.node} testId='bramble-node-name' />
    </div>
  );
};
