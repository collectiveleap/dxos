//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { useObject } from '@dxos/react-client/echo';

import { getDisplayLabel } from '../labels';

import { hasSupertagOfTypename, useParentRunOf, useRunStep } from './substrate-ops';

import { Bramble } from '#types';

export type RunNavProps = {
  // The Run-Node being viewed (the page node when the page is a #Run).
  runNode: Bramble.Node;
  // Switch the current pane to `target` (zoom). Same semantics as the
  // existing predecessor-nav onSelect callback.
  onSelect: (target: Bramble.Node) => void;
  // Open `target` in a new pane (shift-click). Same semantics as the
  // existing predecessor-nav onShiftSelect callback.
  onShiftSelect: (target: Bramble.Node) => void;
};

// F-Run-Nav (Iteration 2c.2 follow-up): page-top navigation for
// Run-Nodes. Surfaces the two outgoing edges every Run has:
//
// - `'is-run-of'` → "← Step: {label}" — primary navigation back to
//   the Step this Run is executing. Always shown (every Run has
//   exactly one).
// - `'parent-run'` → "↑ Parent run" — secondary navigation up one
//   level in a nested runbook tree. Only shown when the Run is a
//   nested child Run (top-level Runs have no parent-run edge).
//
// Click = switch in pane. Shift+click = open in new pane. Mirrors
// the existing PredecessorNav semantics for consistency.
//
// Why not extend PredecessorNav? PredecessorNav reads incoming
// `'child'` edges (the F-DAG predecessor concept). Runs have no
// `'child'` predecessors — their navigation targets are along
// OUTGOING `'is-run-of'` / `'parent-run'` edges. Different reverse
// direction, different edge-kind filter; a dedicated component is
// clearer than overloading PredecessorNav.
export const RunNav = ({ runNode, onSelect, onShiftSelect }: RunNavProps) => {
  const stepNode = useRunStep(runNode);
  const parentRunNode = useParentRunOf(runNode);

  if (!stepNode && !parentRunNode) {
    return null;
  }

  return (
    <div className='mb-3 flex flex-wrap items-baseline gap-x-4'>
      {stepNode && (
        <NavLink
          target={stepNode}
          icon='←'
          prefix='Step:'
          onSelect={onSelect}
          onShiftSelect={onShiftSelect}
        />
      )}
      {parentRunNode && (
        <NavLink
          target={parentRunNode}
          icon='↑'
          prefix='Parent run:'
          onSelect={onSelect}
          onShiftSelect={onShiftSelect}
        />
      )}
    </div>
  );
};

const NavLink = ({
  target,
  icon,
  prefix,
  onSelect,
  onShiftSelect,
}: {
  target: Bramble.Node;
  icon: string;
  prefix: string;
  onSelect: (target: Bramble.Node) => void;
  onShiftSelect: (target: Bramble.Node) => void;
}) => {
  // Subscribe so renames of the target propagate live into the link
  // label without waiting for an unrelated re-render.
  useObject(target);
  const label = getDisplayLabel(target);
  // Parent Run-Nodes commonly have no content — show a friendlier
  // fallback than "(unnamed)" so the user knows what they're
  // clicking on.
  const isRun = hasSupertagOfTypename(target, Bramble.Run.typename);
  const display = label.length > 0 ? label : isRun ? '(untitled run)' : '(unnamed)';
  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.shiftKey) {
      onShiftSelect(target);
      return;
    }
    onSelect(target);
  };
  return (
    <button
      type='button'
      onMouseDown={handleMouseDown}
      className='inline-flex items-baseline gap-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer'
      title='Click to switch · Shift+click to open in new pane'
    >
      <span aria-hidden>{icon}</span>
      <span className='font-medium'>{prefix}</span>
      <span>{display}</span>
    </button>
  );
};
