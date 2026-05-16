//
// Copyright 2025 DXOS.org
//

import React, { useCallback } from 'react';

import { Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { createRunOfStep, hasSupertagOfTypename } from './substrate-ops';

import { Bramble } from '#types';

export type StepActionsProps = {
  // The page Node of the current pane. F-New-Run-On-Step.1: this
  // component is a no-op for Nodes that don't carry `#Step`.
  node: Bramble.Node | null | undefined;
  // Called with the new Run-Node's id after creation. Article uses
  // this to (a) zoom the pane into the new Run (`setPageNodeId`) AND
  // (b) activate the Run Lens for that pane (F-Run-Lens, 2c.5) —
  // since the user clicked "+ New Run" they're about to do the work,
  // so the Lens should be on by default.
  onCreateRun: (runNodeId: string) => void;
};

// F-New-Run-On-Step (Iteration 2c.1): renders a "+ New Run" button
// on Step-tagged page Nodes. Hidden on Nodes without `#Step` so the
// existing pages (notes, supertag instances of other kinds, the
// system Schema / Library Nodes, etc.) are unaffected.
//
// Subscribes to the page Node so the button appears/disappears live
// as the user tags / untags it during the same session.
export const StepActions = ({ node, onCreateRun }: StepActionsProps) => {
  useObject(node ?? undefined);
  const isStep = hasSupertagOfTypename(node, Bramble.Step.typename);

  const handleNewRun = useCallback(() => {
    if (!node) {
      return;
    }
    const db = Obj.getDatabase(node);
    if (!db) {
      return;
    }
    const runNode = createRunOfStep(db, node);
    if (!runNode) {
      return;
    }
    onCreateRun(runNode.id);
  }, [node, onCreateRun]);

  if (!isStep) {
    return null;
  }

  return (
    <div className='mb-3'>
      <button
        type='button'
        onClick={handleNewRun}
        className='inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors select-none'
        data-action='new-run-on-step'
      >
        <span aria-hidden>+</span>
        <span>New Run</span>
      </button>
    </div>
  );
};
