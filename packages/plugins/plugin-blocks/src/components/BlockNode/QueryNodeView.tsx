//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useMemo, useState } from 'react';

import { Filter, Obj } from '@dxos/echo';

import { useZoom } from '../backlinks';
import { getDisplayLabel } from '../labels';

import { buildWrapperIndex, promoteToWrapper, queryInstancesByTypename } from './query-node';

import { Block } from '#types';

// F-6 Phase 3b: render a query Block as a list of all ECHO instances
// of the queried typename (regardless of whether each has a wrapping
// Block). Rows whose instance has a wrapper navigate to that wrapper
// on click; rows whose instance is wrapper-less promote-then-navigate
// — exactly what `F-6.Phase3.promote` describes.
//
// Subscribes both to the Block query (so newly-added Blocks update
// the wrapper index) and to the typename query (so newly-added
// instances appear in the list). Re-renders by bumping a tick when
// either subscription fires.
export type QueryNodeViewProps = {
  // Accepts a live Block or its snapshot — we only read fields and
  // resolve the database, never mutate this argument. The
  // dispatching BlockNode passes its `useObject` snapshot so query
  // rows react to typename / Block changes without our own
  // subscriber here.
  block: any;
};

export const QueryNodeView = ({ block }: QueryNodeViewProps) => {
  const typename = ((block as any).queryRef?.typename ?? '') as string;
  const db = Obj.getDatabase(block);
  const zoom = useZoom();
  const [tick, setTick] = useState(0);

  // Re-query both Blocks (for the wrapper index) and instances
  // whenever a relevant subscription fires.
  useEffect(() => {
    if (!db) {
      return;
    }
    const bump = () => setTick((value) => value + 1);
    const blockQuery: any = db.query(Filter.typename(Block.Block.typename));
    const instanceQuery: any = typename ? db.query(Filter.typename(typename)) : null;
    const blockSub = blockQuery?.subscribe?.(bump);
    const instanceSub = instanceQuery?.subscribe?.(bump);
    return () => {
      try {
        blockSub?.();
      } catch {
        /* noop */
      }
      try {
        instanceSub?.();
      } catch {
        /* noop */
      }
    };
  }, [db, typename]);

  const rows = useMemo(() => {
    if (!db || !typename) {
      return [];
    }
    const instances = queryInstancesByTypename(db, typename);
    const wrapperIndex = buildWrapperIndex(db);
    return instances.map((instance: any) => {
      const wrapper = wrapperIndex.get(instance.id);
      const label = wrapper ? getDisplayLabel(wrapper) : getDisplayLabel(instance);
      return { instance, wrapper, label: label || '(unnamed)' };
    });
    // `tick` participates so subscription bumps recompute.
  }, [db, typename, tick]);

  const handleRowClick = (row: { instance: any; wrapper: Block.Block | undefined }) => {
    if (!db) {
      return;
    }
    const target = row.wrapper ?? promoteToWrapper(db, row.instance);
    zoom(target.id);
  };

  if (!typename) {
    return null;
  }

  return (
    <div
      className='rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 px-2 py-1'
      data-query-typename={typename}
    >
      <div className='pb-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400'>
        Query — {typename}
      </div>
      {rows.length === 0 ? (
        <div className='text-sm text-neutral-400 dark:text-neutral-600 italic px-1 py-1'>
          No instances yet
        </div>
      ) : (
        <ul className='space-y-0.5'>
          {rows.map((row) => (
            <li key={row.instance.id}>
              <button
                type='button'
                onClick={() => handleRowClick(row)}
                className='flex w-full items-baseline gap-2 text-left text-sm px-1 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'
                title={row.wrapper ? 'Open wrapper' : 'Create wrapper and open'}
              >
                <span
                  aria-hidden
                  className={
                    'shrink-0 inline-block w-2 h-2 rounded-full ' +
                    (row.wrapper
                      ? 'bg-neutral-500 dark:bg-neutral-400'
                      : 'border border-dashed border-neutral-400 dark:border-neutral-500 bg-transparent')
                  }
                />
                <span className='flex-1 min-w-0 truncate text-neutral-700 dark:text-neutral-200'>
                  {row.label}
                </span>
                {!row.wrapper && (
                  <span className='shrink-0 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500'>
                    no wrapper
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
