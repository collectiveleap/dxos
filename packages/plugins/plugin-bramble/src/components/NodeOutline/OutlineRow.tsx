//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { mx } from '@dxos/ui-theme';

import { RowEditor } from './RowEditor';
import { type OutlineRow as OutlineRowModel } from '../../model/outline';

import './node-outline.css';

const INDENT_PX = 24;

export const OutlineRow = ({ row }: { row: OutlineRowModel }) => {
  return (
    <div
      data-testid='bramble-row'
      data-depth={row.depth}
      role='treeitem'
      className={mx('bramble-outline-row')}
      style={{ paddingInlineStart: row.depth * INDENT_PX }}
    >
      <span data-testid='bramble-chevron' aria-hidden={!row.hasChildren} className={mx('bramble-outline-chevron')}>
        {row.hasChildren ? '▸' : null}
      </span>
      <span data-testid='bramble-bullet' aria-hidden='true' className={mx('bramble-outline-bullet')} />
      <RowEditor node={row.node} testId='bramble-node-name' className='bramble-outline-row-name' />
    </div>
  );
};
