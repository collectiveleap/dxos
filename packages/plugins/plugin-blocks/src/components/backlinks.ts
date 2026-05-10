//
// Copyright 2025 DXOS.org
//

import { createContext, useContext, useEffect, useState } from 'react';

import { Filter, Obj } from '@dxos/echo';

import { getDisplayLabel } from './labels';

import { Block, type BlockOutline } from '#types';

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

// F-5 + F-V4: scans all Blocks in the outline's database and finds those whose
// inline ref segments point at any Block in this outline's tree (or the
// outline's root). Produces both a flat list (for the BacklinksPanel) and a
// count map keyed by target Block id (for the per-bullet badge).
//
// Self-references — a bullet inside this outline pointing at another bullet
// inside it — are excluded from both the list and the counts. They're visible
// in the tree itself.
//
// ECHO's referencedBy() doesn't traverse refs nested inside StructuredContent
// union segments, so the scan reads each Block's `content` array directly.
// For perf at scale, populate a typed `Block.references: Array<Ref<Obj.Unknown>>`
// sidecar at save and switch to db.query.referencedBy(Block, 'references').
export const useBacklinks = (outline: BlockOutline.BlockOutline | undefined): BacklinkData => {
  const [data, setData] = useState<BacklinkData>(empty);

  useEffect(() => {
    if (!outline) {
      setData(empty);
      return;
    }
    const db = Obj.getDatabase(outline);
    if (!db) {
      return;
    }
    let cancelled = false;

    const compute = () => {
      if (cancelled) {
        return;
      }

      // Walk the outline's tree to collect every Block id "inside" the
      // outline. Read live from `outline` (not a snapshot) so the most
      // recent structure is reflected on every recompute.
      const innerIds = new Set<string>();
      const collectIds = (block: any): void => {
        if (!block || innerIds.has(block.id)) {
          return;
        }
        innerIds.add(block.id);
        const childRefs = (block.children ?? []) as readonly any[];
        for (const ref of childRefs) {
          collectIds(ref?.target);
        }
      };
      const root = (outline as any)?.root?.target;
      if (root) {
        collectIds(root);
      }

      const allBlocks = db.query(Filter.typename(Block.Block.typename)).runSync() ?? [];

      const list: Backlink[] = [];
      const counts = new Map<string, number>();
      const seenSourceForTarget = new Set<string>();

      for (const block of allBlocks) {
        const sourceId = (block as any).id as string;
        const sourceIsInsideOutline = innerIds.has(sourceId);
        const content = ((block as any).content ?? []) as readonly any[];
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
          // the outline) so the per-bullet badge matches Tana's behaviour.
          counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
          // F-5: the panel lists only EXTERNAL sources — refs from inside
          // the same outline are already visible in the tree.
          if (sourceIsInsideOutline) {
            continue;
          }
          const key = `${sourceId}->${targetId}`;
          if (!seenSourceForTarget.has(key)) {
            seenSourceForTarget.add(key);
            list.push({
              sourceId,
              sourceLabel: getDisplayLabel(block) || '(unnamed bullet)',
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

    // Per-Block subscriptions. db.query(...).subscribe only fires when the
    // result SET changes — not when a result's fields mutate. So we
    // subscribe to each Block individually via Obj.subscribe, which fires
    // on any field-level change. The query subscription still fires when
    // Blocks are created or deleted, at which point we re-bind the
    // per-Block subs to the new set.
    let blockSubs: Array<() => void> = [];

    const refreshBlockSubs = () => {
      for (const unsub of blockSubs) {
        try {
          unsub();
        } catch {
          /* noop */
        }
      }
      blockSubs = [];
      const allBlocks = db.query(Filter.typename(Block.Block.typename)).runSync() ?? [];
      for (const block of allBlocks) {
        const unsub = Obj.subscribe(block as any, () => compute());
        blockSubs.push(unsub);
      }
    };

    refreshBlockSubs();
    compute();

    const queryResult = db.query(Filter.typename(Block.Block.typename));
    const querySub = (queryResult as any).subscribe?.(() => {
      // Block set may have changed — re-bind per-Block subs and recompute.
      refreshBlockSubs();
      compute();
    });

    return () => {
      cancelled = true;
      for (const unsub of blockSubs) {
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
  }, [outline]);

  return data;
};

// React context that propagates the per-target count map to BlockNode without
// prop drilling through every level of the recursive tree.
export const BacklinkCountContext = createContext<Map<string, number>>(new Map());

export const useBacklinkCount = (blockId: string): number => {
  const counts = useContext(BacklinkCountContext);
  return counts.get(blockId) ?? 0;
};

// React context that lets any BlockNode request a zoom into a Block by id.
// Provided by BlockArticle. Default is a no-op so BlockNode renders cleanly
// even when no provider is mounted (storybook stories, etc.).
export const ZoomContext = createContext<(blockId: string) => void>(() => {});

export const useZoom = () => useContext(ZoomContext);

// F-Open-Pane: lets any BlockNode request that a Block be opened in a NEW
// pane (sibling plank) to the right of the current pane. Provided by
// BlockArticle, which wires this through `LayoutOperation.Open` with the
// pane's `attendableId` as `pivotId` so the new plank lands next to the
// current one. Takes the live Block object (not just an id) so the
// handler can derive the canonical qualified path via
// `getObjectPathFromObject`. Default is a no-op for storybook / standalone
// renders.
export const OpenPaneContext = createContext<(block: Block.Block) => void>(() => {});

export const useOpenPane = () => useContext(OpenPaneContext);
