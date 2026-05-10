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
// non-relation typenames; substring match on label). Mouse-only selection
// for the spike — keyboard navigation can land in a polish increment.
export const MentionPicker = ({ db, query, cursor, excludeId, onSelect, onClose }: MentionPickerProps) => {
  const [items, setItems] = useState<Obj.Any[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // Initial guess: place top-left of popover just below-right of the cursor.
  // useLayoutEffect below measures the rendered popover and flips above if
  // there's no room below the cursor.
  const [placement, setPlacement] = useState<{ left: number; top: number }>({
    left: cursor.left,
    top: cursor.bottom + POPOVER_GAP,
  });

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

  return (
    <div
      ref={popoverRef}
      className='fixed z-50 min-w-48 max-w-72 rounded border bg-white shadow-lg dark:bg-neutral-900'
      style={{ left: placement.left, top: placement.top }}
    >
      {items.length === 0 ? (
        <div className='p-2 text-sm opacity-60'>No matches</div>
      ) : (
        <ul className='max-h-64 overflow-y-auto'>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type='button'
                className='block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800'
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
          ))}
        </ul>
      )}
    </div>
  );
};

