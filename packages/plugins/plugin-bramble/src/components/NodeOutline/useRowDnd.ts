//
// Copyright 2026 DXOS.org
//

import {
  type Instruction,
  type ItemMode,
  attachInstruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { type RefCallback, useCallback, useEffect, useRef, useState } from 'react';

import { type OutlineRow as OutlineRowModel } from '../../model/outline';

const INDENT_PER_LEVEL = 32; // must equal OutlineRow's INDENT_PX

/**
 * Registers a row's bullet as a Pragmatic-dnd drag handle and the row itself as a drop target
 * with the tree-item hitbox. The drop target attaches the resolved `Instruction` to its drag
 * data (read back by `NodeOutline`'s monitor on drop) and exposes the live instruction for the
 * drop indicator. `reparent` (far-left dedent) is blocked — this plan does not implement it.
 * `listId` (the owning `NodeOutline` instance's id) rides along on the shared `data` object so
 * the monitor can reject drops that originated from a different mounted outline.
 * Registration waits for BOTH refs; detaching either tears the bindings down (no dnd leaks).
 */
export const useRowDnd = ({ row, mode, listId }: { row: OutlineRowModel; mode: ItemMode; listId: string }) => {
  const rowEl = useRef<HTMLDivElement | null>(null);
  const handleEl = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [instruction, setInstruction] = useState<Instruction | null>(null);

  const nodeId = row.node.id;
  const level = row.depth;

  const register = useCallback(() => {
    if (!rowEl.current || !handleEl.current) {
      return;
    }
    cleanupRef.current?.();
    const data = { id: nodeId, listId };
    cleanupRef.current = combine(
      draggable({
        element: handleEl.current,
        getInitialData: () => data,
      }),
      dropTargetForElements({
        element: rowEl.current,
        getData: ({ input, element }) =>
          attachInstruction(data, {
            input,
            element,
            indentPerLevel: INDENT_PER_LEVEL,
            currentLevel: level,
            mode,
            block: ['reparent'],
          }),
        canDrop: ({ source }) => source.data.id !== nodeId,
        getIsSticky: () => true,
        onDrag: ({ self }) => setInstruction(extractInstruction(self.data)),
        onDragLeave: () => setInstruction(null),
        onDrop: () => setInstruction(null),
      }),
    );
  }, [nodeId, level, mode, listId]);

  const teardown = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setInstruction(null);
  }, []);

  useEffect(() => {
    register();
    return teardown;
  }, [register, teardown]);

  const rowRef = useCallback<RefCallback<HTMLDivElement>>(
    (node) => {
      rowEl.current = node;
      if (node) {
        register();
      } else {
        teardown();
      }
    },
    [register, teardown],
  );
  const handleRef = useCallback<RefCallback<HTMLElement>>(
    (node) => {
      handleEl.current = node;
      if (node) {
        register();
      } else {
        teardown();
      }
    },
    [register, teardown],
  );

  return { rowRef, handleRef, instruction };
};
