//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { useObject } from '@dxos/react-client/echo';

import { getDisplayLabel } from '../labels';

import { hasSupertagOfTypename, useRunsOfStep } from './substrate-ops';

import { Bramble } from '#types';

export type StepRunsListProps = {
  // The Step-Node whose Runs we're listing. Caller is responsible
  // for confirming this Node carries `#Step` — the component
  // renders nothing when there are no Runs anyway.
  stepNode: Bramble.Node;
  // Switch the current pane to `target` (zoom). Same semantics as
  // PredecessorNav / RunNav.
  onSelect: (target: Bramble.Node) => void;
  // Open `target` in a new pane (shift-click).
  onShiftSelect: (target: Bramble.Node) => void;
};

// F-Step-Runs-List (Iteration 2d): on a `#Step` page, list every
// Run-Node that has an `'is-run-of'` edge pointing at this Step.
// Click → zoom into the Run (its F-Run-Execution-View). Shift+click
// → open in new pane.
//
// Order: chronological (ULIDs sort by time; oldest first). When
// Step-versioning lands (2c.3), this list will also be the place
// to surface "this run was executed against version V" decorations.
//
// Per substrate-principles Principle #17 ("the substrate must be
// useful as a journal alone"): this is the journal payoff — Steve
// reviewing his past 30 runs of `reconcile_line` happens here.
export const StepRunsList = ({ stepNode, onSelect, onShiftSelect }: StepRunsListProps) => {
  const runs = useRunsOfStep(stepNode);

  // Subscribe to the Step so renames re-flow into the "Run N of …"
  // label below (which references the Step's display label).
  useObject(stepNode);

  if (runs.length === 0) {
    return null;
  }

  return (
    <div className='mb-4'>
      <div className='text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1'>
        Runs ({runs.length})
      </div>
      <ul className='space-y-1'>
        {runs.map((run, index) => (
          <RunRow
            key={run.id}
            run={run}
            index={index + 1}
            onSelect={onSelect}
            onShiftSelect={onShiftSelect}
          />
        ))}
      </ul>
    </div>
  );
};

// One row in the Runs list. Subscribes to the Run-Node so any later
// changes to its content (e.g. a started/completed timestamp on the
// supertag instance) propagate live.
const RunRow = ({
  run,
  index,
  onSelect,
  onShiftSelect,
}: {
  run: Bramble.Node;
  index: number;
  onSelect: (target: Bramble.Node) => void;
  onShiftSelect: (target: Bramble.Node) => void;
}) => {
  useObject(run);
  // Parent Run-Nodes are typically empty (the user fills in child
  // Runs for sub-Steps); show a fallback label keyed by index so the
  // rows are still scannable.
  const label = getDisplayLabel(run);
  const isRun = hasSupertagOfTypename(run, Bramble.Run.typename);
  const display = label.length > 0 ? label : isRun ? `Run ${index}` : `(node ${index})`;
  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.shiftKey) {
      onShiftSelect(run);
      return;
    }
    onSelect(run);
  };
  return (
    <li>
      <button
        type='button'
        onMouseDown={handleMouseDown}
        className='block w-full text-left text-sm px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer'
        title='Click to open this Run · Shift+click to open in new pane'
      >
        {display}
      </button>
    </li>
  );
};
