//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Filter, Obj, Query } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { useQuery } from '@dxos/react-client/echo';

import { useOpenBeside } from './OpenBeside';
import { tryGetSource } from '../../model/edges';
import { Edge, type Node } from '../../types';

import './node-outline.css';

const labelOf = (n: Node): string => n.text?.target?.content || '(untitled)';

// A dangling edge (source Node deleted) is skipped rather than crashing the panel.
const sourcesOfKind = (edges: Edge[], kind: 'structural' | 'linked'): Node[] =>
  edges
    .filter((e) => e.kind === kind)
    .map((e) => tryGetSource(e))
    .filter((n): n is Node => !!n);

/**
 * The "Mentioned in" companion (UP-2.backlinks-view): a Node's inbound edges grouped by kind —
 * structural predecessors ("Appears under") and linked referrers ("Mentioned in"). Auto-populated by
 * reverse traversal (`targetOf`), live via `useQuery`; no author-created return edge. Click an entry to
 * open it beside (`useOpenBeside`, from the Surface — a no-op outside it).
 */
export const BacklinksPanel = ({ subject }: { subject: Node }) => {
  const db = Obj.getDatabase(subject) as EchoDatabase | undefined;
  const openBeside = useOpenBeside();
  const inbound = useQuery(db, Query.select(Filter.id(subject.id)).targetOf(Edge)) as Edge[];
  const structural = sourcesOfKind(inbound, 'structural');
  const linked = sourcesOfKind(inbound, 'linked');

  const group = (title: string, testId: string, nodes: Node[]) =>
    nodes.length > 0 ? (
      <div data-testid={testId} className='bramble-backlinks-group'>
        <div className='bramble-backlinks-heading'>{title}</div>
        {nodes.map((n) => (
          <div key={n.id} role='button' className='bramble-backlinks-entry' onClick={() => openBeside?.(n)}>
            {labelOf(n)}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div data-testid='bramble-backlinks' className='bramble-backlinks'>
      {group('Appears under', 'bramble-backlinks-structural', structural)}
      {group('Mentioned in', 'bramble-backlinks-linked', linked)}
      {structural.length === 0 && linked.length === 0 && (
        <div data-testid='bramble-backlinks-empty' className='bramble-backlinks-empty'>
          No backlinks
        </div>
      )}
    </div>
  );
};
