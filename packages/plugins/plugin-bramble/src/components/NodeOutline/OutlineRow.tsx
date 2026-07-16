//
// Copyright 2026 DXOS.org
//

import { type ItemMode } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import React from 'react';

import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';
import { Obj } from '@dxos/echo';
import { mx } from '@dxos/ui-theme';

import { INDENT_PX } from './constants';
import { MentionExpansions } from './MentionExpansions';
import { OutlineDropIndicator } from './OutlineDropIndicator';
import { RowEditor } from './RowEditor';
import { useRowDnd } from './useRowDnd';
import { type OutlineRow as OutlineRowModel } from '../../model/outline';
import { Node } from '../../types';

import './node-outline.css';

export type OutlineRowProps = {
  row: OutlineRowModel;
  mode: ItemMode;
  /** Owning `NodeOutline` instance's id; scopes drag/drop so foreign outlines' drops are ignored. */
  listId: string;
  /** Attendable (plank) id threaded from the contributing surface; consumed by a foreign row's
   * `Section` surface (plan 1.3a Task 3). Undefined for non-plank hosts (e.g. popovers). */
  attendableId?: string;
  onToggleCollapse: (nodeId: string) => void;
  onZoom: (nodeId: string) => void;
};

export const OutlineRow = ({ row, mode, listId, attendableId, onToggleCollapse, onZoom }: OutlineRowProps) => {
  const { rowRef, handleRef, instruction } = useRowDnd({ row, mode, listId });
  return (
    <div
      ref={rowRef}
      data-testid='bramble-row'
      data-attendable-id={attendableId}
      data-depth={row.depth}
      role='treeitem'
      className={mx('bramble-outline-row')}
      style={{ position: 'relative', paddingInlineStart: row.depth * INDENT_PX }}
    >
      {/* The bullet/text sit on one horizontal line; a mention's inline expansion renders BELOW it
          (own line, indented) — not as a flex sibling of the editor, which pushed it off to the right. */}
      <div className='bramble-outline-row-line'>
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
        {/* A row renders by its type (BR-16): a Bramble `Node` gets the text `RowEditor`; any other
            object renders read-only via its own registered `Section` surface (plan 1.3a). */}
        {Obj.instanceOf(Node, row.node) ? (
          <RowEditor node={row.node} testId='bramble-node-name' className='bramble-outline-row-name' />
        ) : (
          <HeterogeneousRowBody subject={row.node} attendableId={attendableId} />
        )}
      </div>
      {/* Mentions are a Node-only concern (a foreign object's edges are its own surface's business). */}
      {Obj.instanceOf(Node, row.node) && <MentionExpansions node={row.node} />}
      {instruction && <OutlineDropIndicator instruction={instruction} />}
    </div>
  );
};

/**
 * A non-`Node` row's body (BR-16, read-only). Renders the object through its own registered `Section`
 * surface when one is available; otherwise a plain-text fallback so the row is never blank. Keyboard
 * split/merge/indent on such a row is out of scope (1.3b) — the surface owns its own editing.
 */
const HeterogeneousRowBody = ({ subject, attendableId }: { subject: Obj.Unknown; attendableId?: string }) => {
  const isSurfaceAvailable = Surface.useIsAvailable();
  // A `Section` surface's data contract requires a string `attendableId` (app-surface's ATTENDABLE_ROLES
  // guard rejects a Section candidate without one). With no `attendableId` there is no attemptable
  // surface, so fall straight through to the fallback.
  const data = attendableId != null ? { subject, attendableId } : undefined;
  const available = data != null && isSurfaceAvailable({ type: AppSurface.Section, data });
  return available && data ? (
    <Surface.Surface
      type={AppSurface.Section}
      data={data}
      limit={1}
      placeholder={<PlainTextFallback obj={subject} />}
    />
  ) : (
    <PlainTextFallback obj={subject} />
  );
};

/** Fallback body for an object with no registered `Section` surface: a best-effort label so the row
 *  reads as *something* rather than an empty slot. */
const PlainTextFallback = ({ obj }: { obj: Obj.Unknown }) => (
  <span data-testid='bramble-foreign-fallback' className='bramble-outline-row-name'>
    {Obj.getLabel(obj) ?? obj.id}
  </span>
);
