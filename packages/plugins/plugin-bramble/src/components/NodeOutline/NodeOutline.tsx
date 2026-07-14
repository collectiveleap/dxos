//
// Copyright 2026 DXOS.org
//

import { type Instruction, type ItemMode, extractInstruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import React, { useEffect, useId, useMemo, useReducer, useRef } from 'react';

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
  // Scopes drag/drop to this mounted instance: every row's draggable/drop-target tags its data
  // with `listId`, and the monitor below rejects drops whose source carries a foreign listId. This
  // prevents a drop in one mounted NodeOutline from also firing another instance's `onDrop` (e.g.
  // two Bramble outlines mounted on the same space) and double-applying a move against ids that
  // may not even resolve in this instance's db.
  const listId = useId();

  // Use the live `subject` (a Node entity) for the view-model root and the header
  // editor; reactivity comes from `useQuery` (rows) and RowEditor's own text binding,
  // so the `useObject` snapshot (a `Snapshot<Node>`, not assignable to `Node`) isn't needed.
  const db = Obj.getDatabase(subject) as EchoDatabase | undefined;
  const edges = useQuery(db, Query.select(Filter.type(Edge))) as Edge[];
  // The outline is the STRUCTURAL tree; linked edges (mentions) never nest or re-root it.
  const structuralEdges = useMemo(() => edges.filter((e) => e.kind === 'structural'), [edges]);
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
    zoomRootId === subject.id ? subject : (structuralEdges.map((e) => Relation.getTarget(e) as Node).find((n) => n.id === zoomRootId) ?? subject);
  const rows = useMemo(
    () => outlineRows(structuralEdges, zoomRootNode, collapsed),
    [structuralEdges, zoomRootNode, renderTick, collapsed, zoomRootId],
  );
  controllerRef.current?.setCtx({ db: db!, root: subject, getRows: () => rows, notifyMutated: forceRerender });

  // `mode` per row for the tree-item hitbox: `last-in-group` if no later row shares its parent,
  // `expanded` if it's an open branch, else `standard`. Keyed by edge id (rows are edge-keyed).
  const modeByEdge = useMemo(() => {
    const lastIndexByParent = new Map<string, number>();
    rows.forEach((r, i) => lastIndexByParent.set(Relation.getSource(r.edge).id, i));
    const map = new Map<string, ItemMode>();
    rows.forEach((r, i) => {
      const isLast = lastIndexByParent.get(Relation.getSource(r.edge).id) === i;
      map.set(r.edge.id, isLast ? 'last-in-group' : r.hasChildren && !r.collapsed ? 'expanded' : 'standard');
    });
    return map;
  }, [rows]);

  useEffect(() => {
    return monitorForElements({
      // Reject foreign payloads before they even reach `onDrop` — mirrors `useReorderList`'s
      // `canMonitor` guard so a drop in a different mounted NodeOutline never triggers this one.
      canMonitor: ({ source }) => source.data.listId === listId,
      onDrop: ({ location, source }) => {
        if (source.data.listId !== listId) {
          return; // belongs to a different mounted NodeOutline instance; ignore
        }
        const target = location.current.dropTargets[0];
        if (!target) {
          return;
        }
        const instruction = extractInstruction(target.data) as Instruction | null;
        const sourceId = source.data.id as string;
        const targetId = target.data.id as string;
        if (!instruction || instruction.type === 'instruction-blocked') {
          return;
        }
        if (instruction.type !== 'reorder-above' && instruction.type !== 'reorder-below' && instruction.type !== 'make-child') {
          return; // `reparent` is blocked; ignore anything else defensively
        }
        void controllerRef.current?.applyDrag(sourceId, targetId, instruction.type);
      },
    });
  }, [listId]);

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
            mode={modeByEdge.get(row.edge.id) ?? 'standard'}
            listId={listId}
            onToggleCollapse={(id) => controllerRef.current?.toggleCollapse(id)}
            onZoom={(id) => controllerRef.current?.zoomTo(id)}
          />
        ))}
      </div>
    </OutlineControllerContext.Provider>
  );
};
