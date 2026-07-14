//
// Copyright 2026 DXOS.org
//

import { type ItemMode } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import React from 'react';

import { Filter, Query, Relation } from '@dxos/echo';
import { useQuery } from '@dxos/react-client/echo';
import { mx } from '@dxos/ui-theme';

import { INDENT_PX } from './constants';
import { useOutlineController } from './controller';
import { useExpansionPath } from './ExpansionPath';
import { NodeOutline } from './NodeOutline';
import { OutlineDropIndicator } from './OutlineDropIndicator';
import { RowEditor } from './RowEditor';
import { useRowDnd } from './useRowDnd';
import { type OutlineRow as OutlineRowModel } from '../../model/outline';
import { Edge, type Node } from '../../types';

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

  // Inline secondary views: this row's LINKED mentions that the user has expanded (Option-click),
  // each rendered as the target's own outline below the row. A target already on the expansion path
  // renders a cycle stub instead of recursing (IP-3.may-cycle, on-demand).
  const controller = useOutlineController();
  const expansionPath = useExpansionPath();
  const linkedEdges = (
    useQuery(controller?.db, Query.select(Filter.id(row.node.id)).sourceOf(Edge)) as Edge[]
  ).filter((e) => e.kind === 'linked');
  const expanded = controller?.getViewState().expandedMentions ?? new Set<string>();
  const expandedTargets = linkedEdges
    .filter((e) => expanded.has(e.id))
    .map((e) => ({ edgeId: e.id, target: Relation.getTarget(e) as Node }));

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
      {expandedTargets.map(({ edgeId, target }) =>
        expansionPath.has(target.id) ? (
          <div
            key={edgeId}
            data-testid='bramble-secondary-cycle'
            className='bramble-secondary bramble-secondary-cycle'
          >
            ↩ already expanded above
          </div>
        ) : (
          <div key={edgeId} data-testid='bramble-secondary' className='bramble-secondary'>
            <NodeOutline subject={target} />
          </div>
        ),
      )}
      {instruction && <OutlineDropIndicator instruction={instruction} />}
    </div>
  );
};
