//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { useObject } from '@dxos/react-client/echo';

import { Graph } from '../Graph';

import { isRemoved } from '../Node/edge-pinning';
import { useChildRunsOf, useRunStep } from './substrate-ops';

import { Bramble } from '#types';

export type RunExecutionViewProps = {
  // The Run-Node to render. Required.
  runNode: Bramble.Node;
  // Pane-level focus state (passed through from Article so all the
  // nested Graphs share the same focus pointer — only one editable
  // is focused at a time across the whole runbook walkthrough).
  focusId: string | null;
  focusAtEnd: boolean;
  setFocusId: (id: string | null) => void;
  setFocusIdAtEnd: (id: string | null) => void;
  // Render-time depth — caller passes 0 for the root; recursive
  // children pass `depth + 1` so the view indents.
  depth?: number;
  // F-Run-Lens: when the Run Lens wizard sets this to the id of
  // a Run-Node in the tree, that section gets a visual highlight
  // (a ring + slightly brighter background). Undefined means no
  // wizard-active marker — plain rendering.
  activeRunId?: string;
};

// F-Run-Execution-View (Iteration 2c.2, revised by 2c.5):
// structured walkthrough of a Run-Node. Per substrate-principles
// S1/S2: the substrate shows the human executor the Step's
// description (the "runbook prompt") and a place to "fill in" their
// response. Sub-Steps render the same way, indented within the
// parent's view.
//
// The "fill-in" is a full Bramble outline rooted at the Run-Node —
// the user can add bullets, refs, marks, and (when 2f lands) PDF
// attachments to record their journal of doing this step. Child
// Runs of sub-Steps are tracked via `'parent-run'` edges (a separate
// semantic axis from structural `'child'` edges) and rendered
// recursively below this Run-Node's outline.
//
// Per Q1 (recursive as far as needed): renders child Run-Nodes
// recursively, one level of indentation per depth.
//
// Per Q2 (resolved by F-Versioning, not yet implemented in this
// code): once F-Versioning ships, this view will resolve the Step
// via `resolveEdgeTarget` on the auto-pinned `'is-run-of'` edge
// so the rendered prompt reflects the Step at Run-creation time,
// not the live Step. Today, this view reads from the LIVE Step on
// every render — pre-F-Versioning edges have no `targetVersion`,
// so live-rendering is also the correct greenfield behavior for
// them per `F-Versioning.unpinned-edges-render-live`. The Run
// Lens (F-Run-Lens, 2c.5) UI-locks the prompt as a partial in-
// flight mitigation.
export const RunExecutionView = ({
  runNode,
  focusId,
  focusAtEnd,
  setFocusId,
  setFocusIdAtEnd,
  depth = 0,
  activeRunId,
}: RunExecutionViewProps) => {
  // Subscribe to the Run-Node so child-Run additions / removals
  // re-render this branch.
  useObject(runNode);
  // F-Versioning: useRunStep returns BOTH the live target (for
  // reactive subscription per F-4b — only relevant for unpinned
  // greenfield edges) AND the resolved view (live for unpinned,
  // pinned snapshot for `'is-run-of'` edges created post-
  // F-Versioning). Subscribe to live; render rendered.
  const stepResolution = useRunStep(runNode);
  const childRuns = useChildRunsOf(runNode);

  const indentClass = depth > 0 ? 'ml-6 mt-3 pl-3 border-l border-neutral-200 dark:border-neutral-700' : '';
  // F-Run-Lens active marker. When the Lens wizard's current focus
  // matches this Run, a subtle ring + tint highlights the section
  // so the user can see where they are in the walkthrough.
  const activeClass =
    activeRunId === runNode.id
      ? 'ring-2 ring-sky-400/60 dark:ring-sky-500/50 rounded-md p-2 -m-2 bg-sky-100/40 dark:bg-sky-900/20'
      : '';

  return (
    <div className={`${indentClass} ${activeClass}`} data-run-view={runNode.id}>
      {/* Runbook prompt: the Step's content rendered as read-only
          narrative. Sourced via F-Versioning's `resolveEdgeTarget`
          on the `'is-run-of'` edge — pinned snapshot for edges
          auto-pinned by F-Versioning.auto-pin-on-create; live
          target for pre-versioning greenfield edges. Falls back to
          "(no Step linked)" when the edge is missing, and to a
          "[removed]" placeholder when a pinned target can't be
          reconstructed (privacy-deletion edge case, v2). */}
      <RunbookPrompt stepResolution={stepResolution} />
      {/* Response area: full Bramble outline rooted at the Run-Node.
          The user adds bullets, refs, marks, attachments here to
          journal the work of this step. Child Runs (for sub-Steps)
          are NOT rendered as bullets — they live on a separate
          edge axis (`'parent-run'`) and surface below as nested
          RunExecutionViews. */}
      <div className='my-2'>
        <Graph
          rootBlock={runNode}
          focusId={focusId}
          focusAtEnd={focusAtEnd}
          setFocusId={setFocusId}
          setFocusIdAtEnd={setFocusIdAtEnd}
        />
      </div>
      {/* Recurse into child Run-Nodes (sub-Steps' Runs). */}
      {childRuns.map((childRun) => (
        <RunExecutionView
          key={childRun.id}
          runNode={childRun}
          focusId={focusId}
          focusAtEnd={focusAtEnd}
          setFocusId={setFocusId}
          setFocusIdAtEnd={setFocusIdAtEnd}
          depth={depth + 1}
          activeRunId={activeRunId}
        />
      ))}
    </div>
  );
};

// Read-only render of a Step Node's content as the runbook prompt.
// Subscribes to the LIVE Step so rename / content edits propagate
// in real time when the `'is-run-of'` edge is UNPINNED (greenfield
// pre-F-Versioning edges per F-Versioning.unpinned-edges-render-
// live). For PINNED edges the rendered field set is frozen at pin
// time — the subscription on `live` fires when the Step changes
// upstream but `rendered` doesn't change (so the user sees no
// drift), matching F-Versioning.live-target-edits-do-not-disturb-
// pinned-view.
const RunbookPrompt = ({ stepResolution }: { stepResolution: import('./substrate-ops').RunStepResolution }) => {
  // Subscribe to the live target for greenfield reactivity. Safe on
  // undefined (useObject is a no-op).
  useObject(stepResolution.live);
  const stepNode = stepResolution.rendered;
  if (!stepNode) {
    return <div className='text-xs italic text-neutral-400 dark:text-neutral-500'>(no Step linked)</div>;
  }
  if (isRemoved(stepNode)) {
    return <div className='text-xs italic text-neutral-400 dark:text-neutral-500'>(Step removed)</div>;
  }
  const segments = ((stepNode.content ?? []) as readonly any[]).filter((seg) => seg?.kind === 'text');
  const text = segments.map((seg) => seg.text ?? '').join('');
  if (text.length === 0) {
    return (
      <div className='text-sm italic text-neutral-400 dark:text-neutral-500'>
        (Step has no description yet)
      </div>
    );
  }
  return (
    <div className='text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap'>
      {text}
    </div>
  );
};
