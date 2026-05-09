//
// Copyright 2025 DXOS.org
//

import * as Option from 'effect/Option';
import React, { useEffect, useRef, useState } from 'react';

import { type Database, Filter, Obj, Query, Type } from '@dxos/echo';
import { EntityKind, SystemTypeAnnotation, getTypeAnnotation } from '@dxos/echo/internal';

export type MentionPickerProps = {
  db: Database.Database | undefined;
  query: string;
  position: { left: number; top: number };
  onSelect: (target: Obj.Any) => void;
  onClose: () => void;
};

// Increment 4: minimal mention-picker popover. Lifts the database query
// pattern from plugin-markdown's useLinkQuery (filter to non-system,
// non-relation typenames; substring match on label). Mouse-only selection
// for the spike — keyboard navigation can land in a polish increment.
export const MentionPicker = ({ db, query, position, onSelect, onClose }: MentionPickerProps) => {
  const [items, setItems] = useState<Obj.Any[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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
      const matched = results.filter((object) => {
        const label = readLabel(object).toLowerCase();
        return label.includes(lowercaseQuery);
      });
      setItems(matched.slice(0, 12));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, query]);

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
      className='absolute z-50 min-w-48 max-w-72 rounded border bg-white shadow-lg dark:bg-neutral-900'
      style={{ left: position.left, top: position.top + 20 }}
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
                {readLabel(item) || `${Obj.getTypename(item) ?? 'object'}/${item.id.slice(0, 6)}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const readLabel = (object: any): string => {
  const label = Obj.getLabel(object);
  if (typeof label === 'string') {
    return label;
  }
  // Fallbacks for objects without a string label — names of fields commonly used.
  return object?.name ?? object?.title ?? '';
};
