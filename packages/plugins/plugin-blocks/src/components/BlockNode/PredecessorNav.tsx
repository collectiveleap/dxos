//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { getDisplayLabel } from '../labels';

import { usePredecessors } from './child-edges';

import { Bramble } from '#types';

export type PredecessorNavProps = {
  // The Block currently rendered as the page block. The control
  // surfaces every structural predecessor of this Block (`ChildEdge`s
  // whose `target` is `pageBlock`).
  pageBlock: Bramble.Node;
  // Regular click on a predecessor option — F-DAG.Phase3e.predecessor-nav-switch.
  onSelect: (target: Bramble.Node) => void;
  // Shift+click on a predecessor option — F-DAG.Phase3e.predecessor-nav-open-pane.
  onShiftSelect: (target: Bramble.Node) => void;
};

// F-DAG.Phase3e.predecessor-nav-*: page-top control that lists every
// structural predecessor of the page block. Replaces the legacy
// F-Page-Header `← {parent label}` single-parent breadcrumb (which
// could only represent one parent and read via the tree walk).
//
// Render strategy:
// - When the page block has zero predecessors the control renders
//   nothing (so the page-top region stays empty when there's no "up").
// - When 1+, a small "↑ N" button shows. Clicking it toggles a list
//   below the button with one row per predecessor; each row commits
//   on `mousedown` so it wins over any blur the button might trigger.
export const PredecessorNav = ({ pageBlock, onSelect, onShiftSelect }: PredecessorNavProps) => {
  const predecessors = usePredecessors(pageBlock);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Click-outside to close. Defer one tick so the button's own
  // click that flipped `open=true` doesn't immediately re-close it.
  useEffect(() => {
    if (!open) {
      return;
    }
    const handle = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const timeout = window.setTimeout(() => {
      window.addEventListener('mousedown', handle);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('mousedown', handle);
    };
  }, [open]);

  if (predecessors.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className='inline-block relative'>
      <button
        type='button'
        onClick={() => setOpen((value) => !value)}
        className='inline-flex items-baseline gap-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer'
        title={
          predecessors.length === 1
            ? '1 predecessor — click to view list'
            : `${predecessors.length} predecessors — click to view list`
        }
      >
        <span>↑</span>
        <span>{predecessors.length}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <PredecessorList
          predecessors={predecessors}
          onSelect={(target) => {
            setOpen(false);
            onSelect(target);
          }}
          onShiftSelect={(target) => {
            setOpen(false);
            onShiftSelect(target);
          }}
        />
      )}
    </div>
  );
};

// Subscribes to each predecessor via `Obj.subscribe` so label
// renames re-flow into the sorted list immediately. The sort key
// follows the F-DAG.Phase3e.predecessor-nav-list spec exactly:
//
//   1. named predecessors first, alphabetical case-insensitive
//   2. `Block.id` lexicographic tiebreaker for equal labels
//   3. unnamed predecessors (`getDisplayLabel` -> '') at the end,
//      ordered among themselves by `Block.id`.
const PredecessorList = ({
  predecessors,
  onSelect,
  onShiftSelect,
}: {
  predecessors: Bramble.Node[];
  onSelect: (target: Bramble.Node) => void;
  onShiftSelect: (target: Bramble.Node) => void;
}) => {
  const [tick, setTick] = useState(0);

  // Re-render whenever any predecessor's fields change so a rename
  // re-flows into the sort order without waiting for an unrelated
  // tick.
  useEffect(() => {
    const unsubs = predecessors.map((predecessor) => Obj.subscribe(predecessor, () => setTick((value) => value + 1)));
    return () => {
      for (const unsub of unsubs) {
        try {
          unsub();
        } catch {
          /* noop */
        }
      }
    };
  }, [predecessors]);

  const sorted = useMemo(() => sortPredecessors(predecessors), [predecessors, tick]);

  return (
    <ul
      className='absolute z-10 mt-1 min-w-48 max-w-72 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden'
      role='listbox'
    >
      {sorted.map((predecessor) => (
        <li key={predecessor.id}>
          <PredecessorRow predecessor={predecessor} onSelect={onSelect} onShiftSelect={onShiftSelect} />
        </li>
      ))}
    </ul>
  );
};

const PredecessorRow = ({
  predecessor,
  onSelect,
  onShiftSelect,
}: {
  predecessor: Bramble.Node;
  onSelect: (target: Bramble.Node) => void;
  onShiftSelect: (target: Bramble.Node) => void;
}) => {
  // F-DAG.Phase3e.predecessor-nav-list: each row labels its
  // predecessor via the same resolver as the H1 header. Subscribe
  // to the predecessor (via useObject) so renames update the row
  // live without waiting for the parent list to re-render.
  const [snapshot] = useObject(predecessor);
  const label = getDisplayLabel(snapshot as any);
  const display = label.length > 0 ? label : '(unnamed)';

  // mousedown — not click — so any editor blur the button might
  // cause races AFTER the navigate fires (mirrors the same trick
  // the MentionPicker uses).
  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.shiftKey) {
      onShiftSelect(predecessor);
      return;
    }
    onSelect(predecessor);
  };

  return (
    <button
      type='button'
      onMouseDown={handleMouseDown}
      className='block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'
      title='Click to switch · Shift+click to open in new pane'
    >
      {display}
    </button>
  );
};

const sortPredecessors = (predecessors: readonly Bramble.Node[]): Bramble.Node[] => {
  const list = predecessors.slice();
  list.sort((a, b) => {
    const labelA = getDisplayLabel(a);
    const labelB = getDisplayLabel(b);
    const unnamedA = labelA.length === 0;
    const unnamedB = labelB.length === 0;
    if (unnamedA && unnamedB) {
      return a.id.localeCompare(b.id);
    }
    if (unnamedA) {
      return 1;
    }
    if (unnamedB) {
      return -1;
    }
    const cmp = labelA.toLowerCase().localeCompare(labelB.toLowerCase());
    if (cmp !== 0) {
      return cmp;
    }
    return a.id.localeCompare(b.id);
  });
  return list;
};

