//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { findTagBlock, tagLabelOf } from '../BlockNode/tag-supertags';
import { TAG_TYPES, type TagTypeEntry } from '../BlockEditor/tag-types';

export type TagPickerProps = {
  // Query text typed after the `#` (excluding the `#` itself).
  query: string;
  // Viewport-relative bounding box of the `#` cursor position.
  cursor: { left: number; top: number; bottom: number };
  // Database the picker is being shown in. Used to look up per-space
  // tag Blocks so the picker shows the user's renamed labels (e.g.
  // "Job" instead of the schema-declared "Task").
  db?: any;
  onSelect: (entry: TagTypeEntry) => void;
  onClose: () => void;
};

const POPOVER_GAP = 4;
const VIEWPORT_PADDING = 8;

type DisplayItem = {
  entry: TagTypeEntry;
  // Live label — comes from the per-space tag Block's `content` when
  // it's materialized, falling back to the schema-declared title
  // when the tag hasn't been used in this space yet.
  label: string;
};

// F-6 Phase 1 + Phase 3 clarification: minimal tag-picker popover.
// Reads from the static `TAG_TYPES` allowlist for the set of typename
// options, but every displayed label is resolved against the
// per-space tag Block — so renaming `#Task` to `#Job` in this space
// is reflected when the user re-opens the picker.
export const TagPicker = ({ query, cursor, db, onSelect, onClose }: TagPickerProps) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<{ left: number; top: number }>({
    left: cursor.left,
    top: cursor.bottom + POPOVER_GAP,
  });

  const items = useMemo<DisplayItem[]>(() => {
    const lowercaseQuery = query.toLowerCase();
    return TAG_TYPES.map((entry) => {
      const tagBlock = db ? findTagBlock(db, entry.typename) : undefined;
      const label = tagLabelOf(tagBlock) ?? entry.title;
      return { entry, label };
    }).filter((item) => item.label.toLowerCase().includes(lowercaseQuery));
  }, [query, db]);

  useLayoutEffect(() => {
    const node = popoverRef.current;
    if (!node) {
      return;
    }
    const rect = node.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const fitsBelow = cursor.bottom + rect.height + POPOVER_GAP + VIEWPORT_PADDING <= viewportHeight;
    const top = fitsBelow
      ? cursor.bottom + POPOVER_GAP
      : Math.max(VIEWPORT_PADDING, cursor.top - rect.height - POPOVER_GAP);
    const left = Math.min(cursor.left, Math.max(VIEWPORT_PADDING, viewportWidth - rect.width - VIEWPORT_PADDING));
    setPlacement({ left, top });
  }, [cursor.left, cursor.top, cursor.bottom, items.length]);

  // Click-outside to close. Defer one tick so the `#` keypress doesn't
  // immediately fire this handler.
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const timeout = window.setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className='fixed z-50 min-w-48 max-w-72 rounded border bg-white shadow-lg dark:bg-neutral-900'
      style={{ left: placement.left, top: placement.top }}
    >
      {items.length === 0 ? (
        <div className='p-2 text-sm opacity-60'>No matching tag types</div>
      ) : (
        <ul className='max-h-64 overflow-y-auto'>
          {items.map(({ entry, label }) => (
            <li key={entry.typename}>
              <button
                type='button'
                className='flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800'
                onMouseDown={(event) => {
                  // mousedown (not click) so the editor's blur handler
                  // doesn't race the click and lose focus.
                  event.preventDefault();
                  onSelect(entry);
                }}
              >
                <span className='text-neutral-400'>#</span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
