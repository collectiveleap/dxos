//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { useObject } from '@dxos/react-client/echo';

import { Graph } from '../Graph';

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
// Per Q2 (deferred, F-Step-Versioning): currently reads from the
// LIVE Step's content on every render. If the Step is edited after
// the Run was created, the prompt the user sees changes too —
// wrong but documented as a known gap until 2c.3 lands. The Run
// Lens (F-Run-Lens, 2c.5) provides a partial workaround by making
// the prompt UI-read-only while the Lens is active.
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
  const stepNode = useRunStep(runNode);
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
          narrative. Sourced from the live Step Node (Q2 gap — see
          F-Step-Versioning). Falls back to "(no Step found)" when
          the `'is-run-of'` edge is missing or its target is
          unresolvable. */}
      <RunbookPrompt stepNode={stepNode} />
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
// Subscribes to the Step so edits during an in-flight Run propagate
// live (Q2 gap; see F-Step-Versioning).
const RunbookPrompt = ({ stepNode }: { stepNode: Bramble.Node | undefined }) => {
  useObject(stepNode);
  if (!stepNode) {
    return <div className='text-xs italic text-neutral-400 dark:text-neutral-500'>(no Step linked)</div>;
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
