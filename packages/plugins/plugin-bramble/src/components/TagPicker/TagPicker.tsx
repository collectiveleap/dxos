//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { findTagBlock, tagLabelOf } from '../Node/tag-supertags';
import { type TagTypeEntry, useTagTypes } from '../Editor/tag-types';

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

// F-6.Phase3.all-echo-types: tag-picker popover. Reads its set of
// type options directly from the database's schemaRegistry (via
// `useTagTypes`) so every non-Relation, non-System ECHO type
// registered in the space appears — no static allowlist. Each
// displayed label is then resolved against the per-space tag Block
// so renaming `#Task` to `#Job` in this space surfaces the rename
// when the picker re-opens.
export const TagPicker = ({ query, cursor, db, onSelect, onClose }: TagPickerProps) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [placement, setPlacement] = useState<{ left: number; top: number }>({
    left: cursor.left,
    top: cursor.bottom + POPOVER_GAP,
  });

  const tagTypes = useTagTypes(db);
  const items = useMemo<DisplayItem[]>(() => {
    const lowercaseQuery = query.toLowerCase();
    return tagTypes
      .map((entry) => {
        const tagBlock = db ? findTagBlock(db, entry.typename) : undefined;
        const label = tagLabelOf(tagBlock) ?? entry.title;
        return { entry, label };
      })
      .filter((item) => item.label.toLowerCase().includes(lowercaseQuery));
  }, [query, db, tagTypes]);

  // F-6.Phase1.keyboard-nav: active item tracked by index. Reset to
  // the first entry whenever the filter narrows (query change) so
  // the highlight never points outside the now-smaller list.
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);
  // If the list shrinks for non-query reasons (schemaRegistry churn),
  // clamp the active index so it stays in bounds.
  useEffect(() => {
    setActiveIndex((idx) => (idx >= items.length ? 0 : idx));
  }, [items.length]);

  // Latest state is shared with the keydown listener via a ref so a
  // single listener handles everything across re-renders.
  const stateRef = useRef({ items, activeIndex, onSelect });
  stateRef.current = { items, activeIndex, onSelect };

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

  // F-6.Phase1.keyboard-nav: scroll the active item into the
  // popover's overflow viewport when nav moves outside the visible
  // portion of the list (`max-h-64 overflow-y-auto`).
  useLayoutEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

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

  // F-6.Phase1.keyboard-nav: ArrowDown/Up/Enter on `window` in the
  // capture phase, so the editor's ProseMirror keymap (attached to
  // the contenteditable element) never sees these keys while the
  // picker is open. Escape is intentionally left to the editor's
  // keymap (F-6.Phase1.escape) so the cursor stays adjacent to the
  // typed `#`.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { items, activeIndex, onSelect } = stateRef.current;
      // Bare ArrowDown / ArrowUp: nav. Cmd+ArrowUp/Down (F-V2.8/2.9
      // collapse-expand) and other modified arrows fall through to the
      // editor.
      const bareKey = !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (event.key === 'ArrowDown' && bareKey) {
        if (items.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((idx) => (idx + 1) % items.length);
        return;
      }
      if (event.key === 'ArrowUp' && bareKey) {
        if (items.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((idx) => (idx - 1 + items.length) % items.length);
        return;
      }
      if (event.key === 'Enter') {
        // Per user clarification 2026-05-14: Shift+Enter and
        // Cmd+Shift+Enter (and any meta-Enter chord) are N/A while the
        // picker is open — swallow them as no-ops so the editor's
        // F-Shift-Enter / F-Cmd-Shift-Enter handlers don't fire and
        // accidentally create a sibling while the user is mid-`#`-query.
        // Plain Alt/Ctrl combos with Enter aren't Bramble gestures, so
        // we leave them alone (fall through).
        if (event.shiftKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.altKey || event.ctrlKey) {
          return;
        }
        // Bare Enter: commit (or swallow when no matches so the editor
        // doesn't split the bullet on an empty filter result).
        if (items.length === 0) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const item = items[activeIndex];
        if (!item) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onSelect(item.entry);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <div
      ref={popoverRef}
      className='fixed z-50 min-w-48 max-w-72 rounded border bg-white shadow-lg dark:bg-neutral-900'
      style={{ left: placement.left, top: placement.top }}
    >
      {items.length === 0 ? (
        <div className='p-2 text-sm opacity-60'>No matching tag types</div>
      ) : (
        <ul className='max-h-64 overflow-y-auto' role='listbox'>
          {items.map(({ entry, label }, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={entry.typename}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role='option'
                aria-selected={isActive}
              >
                <button
                  type='button'
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
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
            );
          })}
        </ul>
      )}
    </div>
  );
};
