//
// Copyright 2025 DXOS.org
//

import { createContext, useContext, useEffect, useState } from 'react';

import { Filter, Obj } from '@dxos/echo';

import { getDisplayLabel } from './labels';

import { Bramble } from '#types';

export type Backlink = {
  sourceId: string;
  sourceLabel: string;
  targetId: string;
  targetLabel: string;
};

export type BacklinkData = {
  list: Backlink[];
  countByTargetId: Map<string, number>;
};

const empty: BacklinkData = { list: [], countByTargetId: new Map() };

// F-5 + F-V4: scans all Nodes in the graph's database and finds those whose
// inline ref segments point at any Node in this graph's tree (or the
// graph's root). Produces both a flat list (for the BacklinksPanel) and a
// count map keyed by target Node id (for the per-bullet badge).
//
// Self-references — a bullet inside this graph pointing at another bullet
// inside it — are excluded from both the list and the counts. They're visible
// in the tree itself.
//
// ECHO's referencedBy() doesn't traverse refs nested inside StructuredContent
// union segments, so the scan reads each Node's `content` array directly.
// For perf at scale, populate a typed `Node.references: Array<Ref<Obj.Unknown>>`
// sidecar at save and switch to db.query.referencedBy(Node, 'references').
export const useBacklinks = (graph: Bramble.Graph | undefined): BacklinkData => {
  const [data, setData] = useState<BacklinkData>(empty);

  useEffect(() => {
    if (!graph) {
      setData(empty);
      return;
    }
    const db = Obj.getDatabase(graph);
    if (!db) {
      return;
    }
    let cancelled = false;

    const compute = () => {
      if (cancelled) {
        return;
      }

      // Walk the graph's tree to collect every Node id "inside" the
      // graph. Read live from `graph` (not a snapshot) so the most
      // recent structure is reflected on every recompute.
      const innerIds = new Set<string>();
      const collectIds = (node: any): void => {
        if (!node || innerIds.has(node.id)) {
          return;
        }
        innerIds.add(node.id);
        const childRefs = (node.children ?? []) as readonly any[];
        for (const ref of childRefs) {
          collectIds(ref?.target);
        }
      };
      const root = (graph as any)?.root?.target;
      if (root) {
        collectIds(root);
      }

      const allNodes = db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? [];

      const list: Backlink[] = [];
      const counts = new Map<string, number>();
      const seenSourceForTarget = new Set<string>();

      for (const node of allNodes) {
        const sourceId = (node as any).id as string;
        const sourceIsInsideGraph = innerIds.has(sourceId);
        const content = ((node as any).content ?? []) as readonly any[];
        if (!Array.isArray(content)) {
          continue;
        }
        for (const segment of content) {
          if (segment?.kind !== 'ref') {
            continue;
          }
          const target = segment.target?.target;
          const targetId = target?.id as string | undefined;
          if (!targetId || !innerIds.has(targetId)) {
            continue;
          }
          // F-V4: count ALL incoming refs (including self-references within
          // the graph) so the per-bullet badge matches Tana's behaviour.
          counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
          // F-5: the panel lists only EXTERNAL sources — refs from inside
          // the same graph are already visible in the tree.
          if (sourceIsInsideGraph) {
            continue;
          }
          const key = `${sourceId}->${targetId}`;
          if (!seenSourceForTarget.has(key)) {
            seenSourceForTarget.add(key);
            list.push({
              sourceId,
              sourceLabel: getDisplayLabel(node) || '(unnamed bullet)',
              targetId,
              targetLabel: getDisplayLabel(target) || '(unnamed bullet)',
            });
          }
        }
      }

      if (!cancelled) {
        setData({ list, countByTargetId: counts });
      }
    };

    // Per-Node subscriptions. db.query(...).subscribe only fires when the
    // result SET changes — not when a result's fields mutate. So we
    // subscribe to each Node individually via Obj.subscribe, which fires
    // on any field-level change. The query subscription still fires when
    // Nodes are created or deleted, at which point we re-bind the
    // per-Node subs to the new set.
    let nodeSubs: Array<() => void> = [];

    const refreshNodeSubs = () => {
      for (const unsub of nodeSubs) {
        try {
          unsub();
        } catch {
          /* noop */
        }
      }
      nodeSubs = [];
      const allNodes = db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? [];
      for (const node of allNodes) {
        const unsub = Obj.subscribe(node as any, () => compute());
        nodeSubs.push(unsub);
      }
    };

    refreshNodeSubs();
    compute();

    const queryResult = db.query(Filter.typename(Bramble.Node.typename));
    const querySub = (queryResult as any).subscribe?.(() => {
      // Node set may have changed — re-bind per-Node subs and recompute.
      refreshNodeSubs();
      compute();
    });

    return () => {
      cancelled = true;
      for (const unsub of nodeSubs) {
        try {
          unsub();
        } catch {
          /* noop */
        }
      }
      if (typeof querySub === 'function') {
        try {
          querySub();
        } catch {
          /* noop */
        }
      } else if (querySub && typeof querySub.unsubscribe === 'function') {
        try {
          querySub.unsubscribe();
        } catch {
          /* noop */
        }
      }
    };
  }, [graph]);

  return data;
};

// React context that propagates the per-target count map to BlockNode without
// prop drilling through every level of the recursive tree.
export const BacklinkCountContext = createContext<Map<string, number>>(new Map());

export const useBacklinkCount = (nodeId: string): number => {
  const counts = useContext(BacklinkCountContext);
  return counts.get(nodeId) ?? 0;
};

// React context that lets any BlockNode request a zoom into a Node by id.
// Provided by BlockArticle. Default is a no-op so BlockNode renders cleanly
// even when no provider is mounted (storybook stories, etc.).
export const ZoomContext = createContext<(nodeId: string) => void>(() => {});

export const useZoom = () => useContext(ZoomContext);

// F-Open-Pane: lets any BlockNode request that a Node be opened in a NEW
// pane (sibling plank) to the right of the current pane. Provided by
// BlockArticle, which wires this through `LayoutOperation.Open` with the
// pane's `attendableId` as `pivotId` so the new plank lands next to the
// current one. Takes the live Node object (not just an id) so the
// handler can derive the canonical qualified path via
// `getObjectPathFromObject`. Default is a no-op for storybook / standalone
// renders.
export const OpenPaneContext = createContext<(node: Bramble.Node) => void>(() => {});

export const useOpenPane = () => useContext(OpenPaneContext);
