//
// Copyright 2025 DXOS.org
//

import { useEffect, useMemo, useState } from 'react';

import { Filter, Obj, Relation } from '@dxos/echo';

import { Block, ChildEdge } from '#types';

// F-DAG: read + write the structural-children edges of a Block via
// the `ChildEdge` relation entity.
//
// Migration policy is incremental — `Block.children` is still the
// authoritative store for most outline writers today, and edges are
// only used where a writer has been ported (currently: the F-6
// Phase 3b promote flow that adds wrappers under Library). To stay
// safe during the transition, every reader uses
// `useStructuralChildren` (or `getStructuralChildren`) which MERGES
// both representations: `Block.children` entries first (preserving
// their array order), then ChildEdge entries sorted by `order`.
//
// Once `Block.children` is fully migrated for a given Block, that
// Block's `children` field will remain in the schema but always be
// empty in the database for that Block; the merge degenerates to the
// pure-edges read.

// Compute the next `order` value to assign when appending a new
// child edge under `parent`. Linear in the number of existing edges
// out of `parent` — fine for the volumes we expect at this stage.
export const nextOrderFor = (db: any, parent: Block.Block): number => {
  if (!db) {
    return 0;
  }
  const edges = (db.query(Filter.typename(ChildEdge.ChildEdge.typename)).runSync() ?? []) as Array<{
    object: any;
  }>;
  let max = -1;
  for (const item of edges) {
    const edge = (item as any).object ?? item;
    const source = Relation.getSource(edge);
    if ((source as any)?.id === (parent as any)?.id) {
      const order = typeof (edge as any).order === 'number' ? (edge as any).order : 0;
      if (order > max) {
        max = order;
      }
    }
  }
  return max + 1;
};

// Synchronous reader: returns the structural children of `parent` as
// an array of plain Refs (matching the shape of `Block.children` so
// existing readers don't have to branch). Merges `Block.children`
// entries (kept in their array position) with ChildEdges-out-of-this
// parent (sorted by `order`, appended after).
export const getStructuralChildren = (db: any, parent: Block.Block): any[] => {
  const fromChildren = ((parent as any)?.children ?? []) as readonly any[];
  if (!db) {
    return [...fromChildren];
  }
  const allEdges = (db.query(Filter.typename(ChildEdge.ChildEdge.typename)).runSync() ?? []) as Array<{
    object: any;
  }>;
  const incidentEdges = allEdges
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => (Relation.getSource(edge) as any)?.id === (parent as any)?.id);
  incidentEdges.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const fromEdges = incidentEdges
    .map((edge: any) => {
      const target = Relation.getTarget(edge) as any;
      return target ? db.makeRef(Obj.getDXN(target)) : undefined;
    })
    .filter((ref): ref is any => Boolean(ref?.target));
  return [...fromChildren, ...fromEdges];
};

// React hook variant of `getStructuralChildren`. Re-runs the merge
// when the parent's `Block.children` (via useObject upstream) or any
// ChildEdge changes. Caller passes the LIVE parent so we can
// resolve `Obj.getDatabase` against it; the snapshot received via
// useObject upstream supplies reactivity for the in-Block children
// list.
export const useStructuralChildren = (parent: Block.Block): any[] => {
  const db = parent ? Obj.getDatabase(parent) : undefined;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!db) {
      return;
    }
    const query: any = db.query(Filter.typename(ChildEdge.ChildEdge.typename));
    const sub = query?.subscribe?.(() => setTick((value) => value + 1));
    return () => {
      try {
        sub?.();
      } catch {
        /* noop */
      }
    };
  }, [db]);

  return useMemo(() => {
    if (!parent) {
      return [];
    }
    return getStructuralChildren(db, parent);
    // `tick` participates so edge-add / edge-delete refresh.
  }, [db, parent, tick]);
};

// Create a new ChildEdge from `parent` to `child` with `order` set
// to one past the current maximum among `parent`'s outgoing edges.
// The edge is added to the database; callers must run this inside
// a change context if other mutations need to be batched alongside
// (`Relation.make` doesn't need to be wrapped in `Obj.update` /
// `Relation.update`; it's idempotent on creation).
export const createChildEdge = (
  db: any,
  parent: Block.Block,
  child: Block.Block,
  options: { order?: number; kind?: string } = {},
): ChildEdge.ChildEdge => {
  const order = options.order ?? nextOrderFor(db, parent);
  const edge = Relation.make(ChildEdge.ChildEdge, {
    [Relation.Source]: parent as any,
    [Relation.Target]: child as any,
    order,
    ...(options.kind ? { kind: options.kind } : {}),
  });
  db.add(edge as any);
  return edge as any;
};
