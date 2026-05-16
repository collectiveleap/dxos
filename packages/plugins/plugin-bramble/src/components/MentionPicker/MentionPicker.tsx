//
// Copyright 2025 DXOS.org
//

import * as Option from 'effect/Option';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { type Database, Filter, Obj, Query, Type } from '@dxos/echo';
import { EntityKind, SystemTypeAnnotation, getTypeAnnotation } from '@dxos/echo/internal';

import { getDisplayLabel } from '../labels';

export type MentionPickerProps = {
  db: Database.Database | undefined;
  query: string;
  // Viewport-relative bounding box of the @ cursor position.
  cursor: { left: number; top: number; bottom: number };
  // Object id to exclude from results — typically the Block being edited.
  // The current Block can't reference itself.
  excludeId?: string;
  onSelect: (target: Obj.Any) => void;
  onClose: () => void;
};

const POPOVER_GAP = 4;
const VIEWPORT_PADDING = 8;

// Increment 4: minimal mention-picker popover. Lifts the database query
// pattern from plugin-markdown's useLinkQuery (filter to non-system,
// non-relation typenames; substring match on label).
//
// F-4 keyboard nav: ArrowUp/ArrowDown move the active item, Enter
// commits the active item — mirrors F-6.Phase1.keyboard-nav for the
// `#` TagPicker. F-4.6: modified-Enter chords (Shift+Enter,
// Cmd+Shift+Enter, meta-Enter) are N/A while the picker is open and
// are swallowed as no-ops.
export const MentionPicker = ({ db, query, cursor, excludeId, onSelect, onClose }: MentionPickerProps) => {
  const [items, setItems] = useState<Obj.Any[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  // Initial guess: place top-left of popover just below-right of the cursor.
  // useLayoutEffect below measures the rendered popover and flips above if
  // there's no room below the cursor.
  const [placement, setPlacement] = useState<{ left: number; top: number }>({
    left: cursor.left,
    top: cursor.bottom + POPOVER_GAP,
  });

  // F-4 keyboard nav: active item tracked by index. Reset to first on
  // query change so the highlight never points outside the filtered list.
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);
  useEffect(() => {
    setActiveIndex((idx) => (idx >= items.length ? 0 : idx));
  }, [items.length]);

  // Share latest state with the window-capture keydown listener via a
  // ref so a single attached listener handles all keypresses without
  // re-binding on every state change.
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

  // Scroll the active item into view on nav move.
  useLayoutEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    if (!db) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const schemas = db.schemaRegistry.query({ location: ['database', 'runtime'] }).runSync() ?? [];
      const filter = Filter.or(
        ...schemas
          .filter((schema) => getTypeAnnotation(schema)?.kind !== EntityKind.Relation)
          .filter((schema) => !SystemTypeAnnotation.get(schema).pipe(Option.getOrElse(() => false)))
          .map((schema) => Filter.typename(Type.getTypename(schema))),
      );
      const results = (await db.query(Query.select(filter)).run()) ?? [];
      if (cancelled) {
        return;
      }
      const lowercaseQuery = query.toLowerCase();
      // Drop objects whose label is empty — typically Blocks with no text yet
      // and unnamed system rows. The substring match runs on the resolved
      // label so individual bullets are findable by their text content.
      // Also drop the current Block itself — a bullet can't reference itself.
      const matched = results
        .filter((object) => !excludeId || (object as any).id !== excludeId)
        .map((object) => ({ object, label: getDisplayLabel(object) }))
        .filter(({ label }) => label.length > 0)
        .filter(({ label }) => label.toLowerCase().includes(lowercaseQuery));
      setItems(matched.slice(0, 25).map(({ object }) => object));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, query, excludeId]);

  // Click-outside to close.
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    // Defer one tick so the @ keypress doesn't immediately fire this handler.
    const timeout = window.setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // F-4 keyboard nav: window-capture keydown handler mirrors
  // F-6.Phase1.keyboard-nav for the `#` picker. ArrowUp/ArrowDown move
  // the active item; bare Enter commits. Per F-4.6, modified Enter
  // chords (shift, meta) are swallowed as no-ops so the editor's
  // F-Shift-Enter / F-Cmd-Shift-Enter handlers don't fire mid-`@`-query.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { items, activeIndex, onSelect } = stateRef.current;
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
        // F-4.6: Shift+Enter and Cmd+Shift+Enter are N/A while the
        // picker is open — swallow as no-ops.
        if (event.shiftKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.altKey || event.ctrlKey) {
          return;
        }
        // Bare Enter: commit the active item. When there are no
        // matches, still swallow so the editor's Enter handler doesn't
        // split the bullet — this is the bug path the user hit when
        // typing `@happy` then pressing Enter (no candidate visible).
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
        onSelect(item);
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
        <div className='p-2 text-sm opacity-60'>No matches</div>
      ) : (
        <ul className='max-h-64 overflow-y-auto' role='listbox'>
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role='option'
                aria-selected={isActive}
              >
                <button
                  type='button'
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    // mousedown (not click) so the editor's blur handler doesn't
                    // race the click — also prevents losing focus.
                    event.preventDefault();
                    onSelect(item);
                  }}
                >
                  {getDisplayLabel(item) || `${Obj.getTypename(item) ?? 'object'}/${item.id.slice(0, 6)}`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
