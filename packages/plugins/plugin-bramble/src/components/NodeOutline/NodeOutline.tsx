//
// Copyright 2026 DXOS.org
//

import React, { useMemo, useReducer, useRef } from 'react';

import { Filter, Obj, Query, Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { useQuery } from '@dxos/react-client/echo';

import { OutlineController, OutlineControllerContext } from './controller';
import { OutlineRow } from './OutlineRow';
import { RowEditor } from './RowEditor';
import { outlineRows } from '../../model/outline';
import { resolveZoomRoot } from '../../model/view-state';
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

  const controllerRef = useRef<OutlineController | undefined>(undefined);
  if (!controllerRef.current && db) {
    controllerRef.current = new OutlineController({ db, root: subject, getRows: () => rows, notifyMutated: forceRerender });
  }
  const collapsed = controllerRef.current?.getViewState().collapsed;
  const zoomRootId = resolveZoomRoot(controllerRef.current?.getViewState().zoomRootId ?? null, subject.id);
  // Resolve the zoom-root Node from the structural EDGES, not from `rows` — `rows` is
  // computed *from* the root below, so deriving the root from `rows` would be circular.
  const zoomRootNode =
    zoomRootId === subject.id ? subject : (edges.map((e) => Relation.getTarget(e) as Node).find((n) => n.id === zoomRootId) ?? subject);
  const rows = useMemo(
    () => outlineRows(edges, zoomRootNode, collapsed),
    [edges, zoomRootNode, renderTick, collapsed, zoomRootId],
  );
  controllerRef.current?.setCtx({ db: db!, root: subject, getRows: () => rows, notifyMutated: forceRerender });

  return (
    <OutlineControllerContext.Provider value={controllerRef.current ?? null}>
      <div data-testid='bramble-outline' role='tree' className='bramble-outline'>
        <div data-testid='bramble-header' style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {zoomRootId !== subject.id && (
            <span
              data-testid='bramble-zoom-out'
              role='button'
              style={{ cursor: 'pointer' }}
              onClick={() => controllerRef.current?.zoomOut()}
            >
              ↑
            </span>
          )}
          <RowEditor node={zoomRootNode} className='bramble-outline-header' />
        </div>
        {rows.map((row) => (
          <OutlineRow
            key={row.edge.id}
            row={row}
            onToggleCollapse={(id) => controllerRef.current?.toggleCollapse(id)}
            onZoom={(id) => controllerRef.current?.zoomTo(id)}
          />
        ))}
      </div>
    </OutlineControllerContext.Provider>
  );
};
