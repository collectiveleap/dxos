//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { mx } from '@dxos/ui-theme';

import { RowEditor } from './RowEditor';
import { type OutlineRow as OutlineRowModel } from '../../model/outline';

import './node-outline.css';

const INDENT_PX = 32;

export type OutlineRowProps = {
  row: OutlineRowModel;
  onToggleCollapse: (nodeId: string) => void;
};

export const OutlineRow = ({ row, onToggleCollapse }: OutlineRowProps) => {
  return (
    <div
      data-testid='bramble-row'
      data-depth={row.depth}
      role='treeitem'
      className={mx('bramble-outline-row')}
      style={{ paddingInlineStart: row.depth * INDENT_PX }}
    >
      <span
        data-testid='bramble-chevron'
        role='button'
        aria-hidden={!row.hasChildren}
        className={mx('bramble-outline-chevron')}
        onClick={(e) => {
          e.stopPropagation();
          row.hasChildren && onToggleCollapse(row.node.id);
        }}
      >
        {row.hasChildren ? (row.collapsed ? '▸' : '▾') : null}
      </span>
      <span data-testid='bramble-bullet' aria-hidden='true' className={mx('bramble-outline-bullet')}>
        <span data-testid='bramble-bullet-dot' className='bramble-outline-bullet-dot' />
      </span>
      <RowEditor node={row.node} testId='bramble-node-name' className='bramble-outline-row-name' />
    </div>
  );
};
