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

// Return every ChildEdge fanning out of `parent`, sorted by `order`.
// Used by writers that need to compute fractional orders for new
// sibling inserts.
export const childEdgesOf = (db: any, parent: Block.Block): any[] => {
  if (!db) {
    return [];
  }
  const all = (db.query(Filter.typename(ChildEdge.ChildEdge.typename)).runSync() ?? []) as Array<{
    object: any;
  }>;
  const incident = all
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => (Relation.getSource(edge) as any)?.id === (parent as any)?.id);
  incident.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  return incident;
};

// Find the edge connecting `parent` to `child`, if any.
export const findChildEdge = (db: any, parent: Block.Block, child: Block.Block): any | undefined => {
  const edges = childEdgesOf(db, parent);
  for (const edge of edges) {
    if ((Relation.getTarget(edge) as any)?.id === (child as any)?.id) {
      return edge;
    }
  }
  return undefined;
};

// Delete every ChildEdge fanning out of `parent`. Used by the
// `ensureMigratedChildren` helper when porting a parent's legacy
// `Block.children` list onto edges with re-sequenced orders.
export const removeAllChildEdges = (db: any, parent: Block.Block): void => {
  const edges = childEdgesOf(db, parent);
  for (const edge of edges) {
    db.remove(edge);
  }
};

// One-time migration: if `parent.children` (legacy array) is
// non-empty, convert each entry to a `ChildEdge` with sequential
// `order` matching the merged view, then clear the array. Any
// already-existing edges are recreated in the same operation so the
// post-migration order matches the pre-migration merged order
// (legacy first, then existing edges by `order`).
//
// No-op when the parent has nothing in `Block.children` — its
// children are already edge-only.
export const ensureMigratedChildren = (db: any, parent: Block.Block): void => {
  const legacy = ((parent as any).children ?? []) as readonly any[];
  if (legacy.length === 0) {
    return;
  }
  // Snapshot the merged view BEFORE we tear anything down.
  const merged = getStructuralChildren(db, parent).filter((ref: any) => ref?.target);
  removeAllChildEdges(db, parent);
  Obj.update(parent, (parent: any) => {
    parent.children = [];
  });
  for (let i = 0; i < merged.length; i++) {
    const target = (merged[i] as any).target as Block.Block;
    if (target) {
      createChildEdge(db, parent, target, { order: i });
    }
  }
};

// Compute a new `order` value that places a child between two
// adjacent siblings under the same parent. Either neighbour may be
// undefined (insert at start / end). Caller is responsible for
// migrating the parent first (`ensureMigratedChildren`) so that all
// existing siblings carry explicit `order`s.
export const orderBetween = (before: any | undefined, after: any | undefined): number => {
  const beforeOrder = before ? (before.order ?? 0) : undefined;
  const afterOrder = after ? (after.order ?? 0) : undefined;
  if (beforeOrder === undefined && afterOrder === undefined) {
    return 0;
  }
  if (beforeOrder === undefined) {
    return (afterOrder as number) - 1;
  }
  if (afterOrder === undefined) {
    return beforeOrder + 1;
  }
  return (beforeOrder + (afterOrder as number)) / 2;
};
