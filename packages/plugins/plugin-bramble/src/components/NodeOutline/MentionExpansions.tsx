//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Filter, Query, Relation } from '@dxos/echo';
import { useQuery } from '@dxos/react-client/echo';

import { useOutlineController } from './controller';
import { useExpansionPath } from './ExpansionPath';
import { NodeOutline } from './NodeOutline';
import { Edge, type Node } from '../../types';

/**
 * The inline secondary views for a node's expanded mentions — rendered below the node's own row (or
 * header) and above its subtree. A target already on the expansion path renders a cycle stub instead of
 * recursing (IP-3.may-cycle, on-demand). A dangling linked edge (target removed) is skipped.
 */
export const MentionExpansions = ({ node }: { node: Node }) => {
  const controller = useOutlineController();
  const expansionPath = useExpansionPath();
  const linkedEdges = (
    useQuery(controller?.db, Query.select(Filter.id(node.id)).sourceOf(Edge)) as Edge[]
  ).filter((e) => e.kind === 'linked');
  const expanded = controller?.getViewState().expandedMentions ?? new Set<string>();
  const expandedTargets = linkedEdges
    .filter((e) => expanded.has(e.id))
    .map((e) => ({ edgeId: e.id, target: Relation.getTarget(e) as Node | undefined }))
    .filter((x): x is { edgeId: string; target: Node } => !!x.target);

  return (
    <>
      {expandedTargets.map(({ edgeId, target }) =>
        expansionPath.has(target.id) ? (
          <div
            key={edgeId}
            data-testid='bramble-secondary-cycle'
            className='bramble-secondary bramble-secondary-cycle'
          >
            ↩ already expanded above
          </div>
        ) : (
          <div key={edgeId} data-testid='bramble-secondary' className='bramble-secondary'>
            <NodeOutline subject={target} />
          </div>
        ),
      )}
    </>
  );
};
