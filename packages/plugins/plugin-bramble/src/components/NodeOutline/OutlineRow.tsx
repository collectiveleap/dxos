//
// Copyright 2026 DXOS.org
//

import { type ItemMode } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import React from 'react';

import { mx } from '@dxos/ui-theme';

import { INDENT_PX } from './constants';
import { OutlineDropIndicator } from './OutlineDropIndicator';
import { RowEditor } from './RowEditor';
import { useRowDnd } from './useRowDnd';
import { type OutlineRow as OutlineRowModel } from '../../model/outline';

import './node-outline.css';

export type OutlineRowProps = {
  row: OutlineRowModel;
  mode: ItemMode;
  /** Owning `NodeOutline` instance's id; scopes drag/drop so foreign outlines' drops are ignored. */
  listId: string;
  onToggleCollapse: (nodeId: string) => void;
  onZoom: (nodeId: string) => void;
};

export const OutlineRow = ({ row, mode, listId, onToggleCollapse, onZoom }: OutlineRowProps) => {
  const { rowRef, handleRef, instruction } = useRowDnd({ row, mode, listId });
  return (
    <div
      ref={rowRef}
      data-testid='bramble-row'
      data-depth={row.depth}
      role='treeitem'
      className={mx('bramble-outline-row')}
      style={{ position: 'relative', paddingInlineStart: row.depth * INDENT_PX }}
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
      <span
        ref={handleRef}
        data-testid='bramble-bullet'
        role='button'
        className={mx('bramble-outline-bullet')}
        onClick={(e) => {
          e.stopPropagation();
          onZoom(row.node.id);
        }}
      >
        <span data-testid='bramble-bullet-dot' className='bramble-outline-bullet-dot' />
      </span>
      <RowEditor node={row.node} testId='bramble-node-name' className='bramble-outline-row-name' />
      {instruction && <OutlineDropIndicator instruction={instruction} />}
    </div>
  );
};
