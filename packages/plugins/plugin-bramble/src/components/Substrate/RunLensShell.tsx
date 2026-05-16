//
// Copyright 2025 DXOS.org
//

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Filter, Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { getDisplayLabel } from '../labels';

import { getStructuralChildren } from '../Node/edges';

import { RunExecutionView } from './RunExecutionView';
import { getChildRunsOf, useRunStep } from './substrate-ops';

import { Bramble } from '#types';

export type RunLensShellProps = {
  // The root Run-Node the Lens is active on (the page Node).
  runNode: Bramble.Node;
  // Pane-level focus state, passed through to the underlying
  // RunExecutionView so its nested Graphs share the pane's focus
  // pointer.
  focusId: string | null;
  focusAtEnd: boolean;
  setFocusId: (id: string | null) => void;
  setFocusIdAtEnd: (id: string | null) => void;
  // Called when the user clicks Stop or Done — Article uses this
  // to switch the page back to the plain (non-Lens) view of the
  // same Run-Node.
  onExit: () => void;
};

// F-Run-Lens (Iteration 2c.5): the first concrete instantiation of
// the Lens primitive from CONCEPTS.md §9. A Lens is a named
// perspective on the substrate that maps its own vocabulary,
// property schemas, and visibility rules onto shared underlying
// identities (substrate-principles Principle #11 / CONCEPTS.md §9.6).
//
// The Run Lens, applied to a Run-Node, transforms the view into a
// guided runbook walkthrough with:
//   - read-only Step prompts (the schema as seen by the executor)
//   - read/write response areas (each Run-Node's outline)
//   - wizard controls (Start / Next / Previous / Stop / Done)
//
// Lens activation is per-pane in-session state (not persisted to
// ECHO yet) — see F-Run-Lens-Activation deferred work.
//
// Q1 (recursive as far as needed) is honored — the wizard's
// document-order traversal walks every Run-Node in the tree.
//
// Q2 (snapshot semantics, deferred to F-Step-Versioning) is
// partially addressed here: while the Lens is active, Step
// prompts are presented read-only — the user can't edit them
// from inside the Lens, so accidental schema edits during a run
// are impossible. The data itself is still live (a separate edit
// from outside the Lens would still update past Runs' prompts);
// only the editing surface is locked.
export const RunLensShell = ({
  runNode,
  focusId,
  focusAtEnd,
  setFocusId,
  setFocusIdAtEnd,
  onExit,
}: RunLensShellProps) => {
  const stepNode = useRunStep(runNode);
  useObject(stepNode);
  const stepLabel = stepNode ? (getDisplayLabel(stepNode) || '(untitled step)') : '(no step)';

  // Walk the Run-Node tree in document order so the wizard can
  // step through each response area. Re-flatten on edge changes
  // so newly-added child Runs show up in the wizard.
  const db = Obj.getDatabase(runNode);
  const [edgeTick, setEdgeTick] = useState(0);
  useEffect(() => {
    if (!db) {
      return;
    }
    const query: any = db.query(Filter.typename(Bramble.Edge.typename));
    const sub = query?.subscribe?.(() => setEdgeTick((value) => value + 1));
    return () => {
      try {
        sub?.();
      } catch {
        /* noop */
      }
    };
  }, [db]);
  // Also re-evaluate when a Node's content changes — the
  // hasFilledResponse check walks structural children's content,
  // so a typed-in bullet needs to bump the tick. The cheapest way:
  // subscribe to the Bramble.Node query (which fires when any
  // Node's content updates).
  useEffect(() => {
    if (!db) {
      return;
    }
    const query: any = db.query(Filter.typename(Bramble.Node.typename));
    const sub = query?.subscribe?.(() => setEdgeTick((value) => value + 1));
    return () => {
      try {
        sub?.();
      } catch {
        /* noop */
      }
    };
  }, [db]);

  const flatRuns = useMemo(
    () => flattenRunTree(db, runNode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, runNode, edgeTick],
  );

  // Wizard state — local to the Shell. Re-entering the Lens
  // (Stop → Resume → re-mount) resets it.
  const [started, setStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Done-enablement: every Run-Node in the tree must have at
  // least one structural child Node carrying non-empty text
  // content. Recomputes whenever any Node or Edge changes via the
  // edgeTick subscription above.
  const allFilled = useMemo(
    () => flatRuns.length > 0 && flatRuns.every((run) => hasFilledResponse(db, run)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, flatRuns, edgeTick],
  );

  const handleStart = useCallback(() => {
    setStarted(true);
    setActiveIndex(0);
  }, []);

  const handleNext = useCallback(() => {
    setActiveIndex((index) => Math.min(index + 1, flatRuns.length - 1));
  }, [flatRuns.length]);

  const handlePrevious = useCallback(() => {
    setActiveIndex((index) => Math.max(index - 1, 0));
  }, []);

  const handleStop = useCallback(() => {
    onExit();
  }, [onExit]);

  const handleDone = useCallback(() => {
    // Mark completion: write an ISO timestamp to the Run supertag
    // instance's `completed` field. The supertag instance is the
    // first ref in `Run-Node.supertags` whose typename matches.
    if (db) {
      const supertags = ((runNode as any).supertags ?? []) as readonly any[];
      for (const ref of supertags) {
        const instance = ref?.target;
        if (instance && Obj.getTypename(instance) === Bramble.Run.typename) {
          Obj.update(instance, (inst: any) => {
            inst.completed = new Date().toISOString();
          });
          break;
        }
      }
    }
    onExit();
  }, [db, runNode, onExit]);

  // Scroll the active Run-Node into view when activeIndex changes.
  useEffect(() => {
    if (!started) {
      return;
    }
    const active = flatRuns[activeIndex];
    if (!active) {
      return;
    }
    const el = document.querySelector(`[data-run-view='${active.id}']`);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [started, activeIndex, flatRuns]);

  const activeRunId = started ? flatRuns[activeIndex]?.id : undefined;

  return (
    <div className='rounded-lg border border-sky-400/40 dark:border-sky-700/40 bg-sky-50/40 dark:bg-sky-950/20 p-3'>
      {/* Lens banner: identifies the Lens + the Step it's running.
          The visual treatment (sky-tinted ring + bg) is the
          "you are in the Lens" cue. */}
      <div className='mb-3 flex items-baseline justify-between gap-3'>
        <div className='text-sm font-medium text-sky-900 dark:text-sky-200'>
          <span className='uppercase tracking-wide text-xs mr-2 opacity-70'>Run Lens</span>
          <span>{stepLabel}</span>
        </div>
        <div className='flex items-baseline gap-2'>
          {!started && (
            <ControlButton onClick={handleStart} variant='primary'>
              Start
            </ControlButton>
          )}
          {started && (
            <>
              <ControlButton onClick={handlePrevious} disabled={activeIndex === 0}>
                Previous
              </ControlButton>
              <ControlButton onClick={handleNext} disabled={activeIndex >= flatRuns.length - 1}>
                Next
              </ControlButton>
            </>
          )}
          <ControlButton onClick={handleStop} variant='neutral'>
            Stop
          </ControlButton>
          <ControlButton
            onClick={handleDone}
            disabled={!allFilled}
            variant='primary'
            title={allFilled ? 'Mark this Run complete and exit the Lens' : 'Fill in every response to enable Done'}
          >
            Done
          </ControlButton>
        </div>
      </div>
      <RunExecutionView
        runNode={runNode}
        focusId={focusId}
        focusAtEnd={focusAtEnd}
        setFocusId={setFocusId}
        setFocusIdAtEnd={setFocusIdAtEnd}
        activeRunId={activeRunId}
      />
    </div>
  );
};

const ControlButton = ({
  onClick,
  disabled,
  variant = 'neutral',
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'neutral';
  title?: string;
  children: React.ReactNode;
}) => {
  const baseClass = 'px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const variantClass =
    variant === 'primary'
      ? 'bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-700 dark:hover:bg-sky-600 disabled:hover:bg-sky-600'
      : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700';
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseClass} ${variantClass}`}
    >
      {children}
    </button>
  );
};

// Depth-first flatten of the Run tree starting at `root`. Order:
// root, root's first child, root's first child's first grandchild,
// …, root's first child's last subtree, root's second child, …
const flattenRunTree = (db: any, root: Bramble.Node): Bramble.Node[] => {
  if (!db || !root) {
    return [];
  }
  const out: Bramble.Node[] = [root];
  const children = getChildRunsOf(db, root);
  for (const child of children) {
    out.push(...flattenRunTree(db, child));
  }
  return out;
};

// True iff `runNode` has at least one structural child carrying
// non-empty text content. The wizard's "Done" button enables only
// when this is true for every Run-Node in the tree. A user who
// adds an empty bullet doesn't count — the bullet must have text.
//
// Walks `getStructuralChildren` (the same merge of legacy
// `Node.children` + 'child'-kind edges that RunExecutionView's
// Graph uses) so the check stays consistent with what's rendered.
const hasFilledResponse = (db: any, runNode: Bramble.Node): boolean => {
  if (!db || !runNode) {
    return false;
  }
  const childRefs = getStructuralChildren(db, runNode);
  for (const ref of childRefs) {
    const child = (ref as any)?.target as Bramble.Node | undefined;
    if (child && nodeHasText(child)) {
      return true;
    }
  }
  return false;
};

// True iff a Node's `content` includes at least one non-empty text
// segment. Same shape RunbookPrompt uses to read Step content.
const nodeHasText = (node: Bramble.Node): boolean => {
  const segments = ((node?.content ?? []) as readonly any[]).filter((seg: any) => seg?.kind === 'text');
  return segments.some((seg: any) => (seg?.text ?? '').length > 0);
};
