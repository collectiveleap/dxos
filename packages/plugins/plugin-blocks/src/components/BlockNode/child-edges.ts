//
// Copyright 2025 DXOS.org
//

import { useEffect, useMemo, useState } from 'react';

import { Filter, Obj, Relation } from '@dxos/echo';

import { Block, ChildEdge } from '#types';

// F-DAG Phase 5: edge-kind taxonomy. 'structural' is the only kind
// that renders as an outline child today; other kinds (reserved
// for future expansions like 'embed', 'linked', 'mirror' à la
// Tana) coexist in the same ChildEdge schema but are filtered out
// of the structural-children read paths.
export const EDGE_KIND_STRUCTURAL = 'structural';

// An edge counts as structural when its `kind` is unset (legacy
// before Phase 5) or explicitly 'structural'. Future non-structural
// kinds are excluded.
const isStructuralEdge = (edge: any): boolean => {
  const kind = (edge as any)?.kind;
  return kind === undefined || kind === EDGE_KIND_STRUCTURAL;
};

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
    .filter((edge: any) => (Relation.getSource(edge) as any)?.id === (parent as any)?.id)
    .filter((edge: any) => isStructuralEdge(edge));
  incidentEdges.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const fromEdges = incidentEdges
    .map((edge: any) => {
      const target = Relation.getTarget(edge) as any;
      return target ? db.makeRef(Obj.getDXN(target)) : undefined;
    })
    .filter((ref): ref is any => Boolean(ref?.target));
  return [...fromChildren, ...fromEdges];
};

// Process-global lock for the F-DAG Phase 3d backstop migration —
// each (db, parent) pair is migrated at most once per session even
// when many BlockNodes mount concurrently and all call
// `useStructuralChildren(parent)` on the same parent.
const migrationLocks = new WeakMap<object, Set<string>>();

const acquireMigrationLock = (db: any, parent: Block.Block): boolean => {
  if (!db || !parent?.id) {
    return false;
  }
  let set = migrationLocks.get(db);
  if (!set) {
    set = new Set<string>();
    migrationLocks.set(db, set);
  }
  if (set.has(parent.id)) {
    return false;
  }
  set.add(parent.id);
  return true;
};

// React hook variant of `getStructuralChildren`. Re-runs the merge
// when the parent's `Block.children` (via useObject upstream) or any
// ChildEdge changes. Caller passes the LIVE parent so we can
// resolve `Obj.getDatabase` against it; the snapshot received via
// useObject upstream supplies reactivity for the in-Block children
// list.
//
// F-DAG Phase 3d: backstop migration. The first time a parent is
// READ in this client session, if its legacy `Block.children` array
// is non-empty, the migration runs (`ensureMigratedChildren`). After
// that, every read returns purely from edges. Outlines that pre-date
// the F-DAG writer migrations get drained without the user having
// to make an explicit edit.
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

  useEffect(() => {
    if (!db || !parent) {
      return;
    }
    const legacy = ((parent as any).children ?? []) as readonly any[];
    if (legacy.length === 0) {
      return;
    }
    if (!acquireMigrationLock(db, parent)) {
      return;
    }
    ensureMigratedChildren(db, parent);
    // The migration writes new ChildEdges; the existing
    // subscription bumps `tick`, so we don't need to bump it here.
  }, [db, parent]);

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
//
// F-DAG Phase 5:
// - Defaults `kind` to `'structural'` so the edge participates in
//   every structural read path. Callers can pass another kind to
//   create non-rendering edges (reserved for future expansion).
// - For structural edges, runs cycle detection (`wouldCreateCycle`)
//   and returns `undefined` instead of creating the edge when the
//   write would close a loop. Callers can branch on the return
//   value to surface a UI error or fall back to an alternative.
//   Non-structural edges are not cycle-checked.
export const createChildEdge = (
  db: any,
  parent: Block.Block,
  child: Block.Block,
  options: { order?: number; kind?: string } = {},
): ChildEdge.ChildEdge | undefined => {
  const kind = options.kind ?? EDGE_KIND_STRUCTURAL;
  if (kind === EDGE_KIND_STRUCTURAL && wouldCreateCycle(db, parent, child)) {
    return undefined;
  }
  const order = options.order ?? nextOrderFor(db, parent);
  const edge = Relation.make(ChildEdge.ChildEdge, {
    [Relation.Source]: parent as any,
    [Relation.Target]: child as any,
    order,
    kind,
  });
  db.add(edge as any);
  return edge as any;
};

// Return every STRUCTURAL ChildEdge fanning out of `parent`, sorted
// by `order`. Non-structural kinds (Phase 5 reserved values) are
// filtered out; the structural read path is the outline tree the
// user sees. Writers that need to see every edge regardless of
// kind can pass `{ includeAllKinds: true }`.
export const childEdgesOf = (
  db: any,
  parent: Block.Block,
  options: { includeAllKinds?: boolean } = {},
): any[] => {
  if (!db) {
    return [];
  }
  const all = (db.query(Filter.typename(ChildEdge.ChildEdge.typename)).runSync() ?? []) as Array<{
    object: any;
  }>;
  const incident = all
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => (Relation.getSource(edge) as any)?.id === (parent as any)?.id)
    .filter((edge: any) => (options.includeAllKinds ? true : isStructuralEdge(edge)));
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

// Sync reader: returns every STRUCTURAL ChildEdge whose target is
// `child` — i.e. every structural parent of `child`. Used by the
// multi-parent indicator and (eventually) the breadcrumb-with-N-
// parents UX. Pass `{ includeAllKinds: true }` to inspect every
// incoming edge regardless of kind.
export const parentEdgesOf = (
  db: any,
  child: Block.Block,
  options: { includeAllKinds?: boolean } = {},
): any[] => {
  if (!db) {
    return [];
  }
  const all = (db.query(Filter.typename(ChildEdge.ChildEdge.typename)).runSync() ?? []) as Array<{
    object: any;
  }>;
  return all
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => (Relation.getTarget(edge) as any)?.id === (child as any)?.id)
    .filter((edge: any) => (options.includeAllKinds ? true : isStructuralEdge(edge)));
};

// F-DAG Phase 5: detect whether creating an edge `parent → child`
// would close a cycle in the structural DAG. Returns true when
// `parent === child` (self-loop) OR when `parent` is reachable
// from `child` by walking outgoing structural edges. The walk is
// bounded by a `visited` set so cycles already present in the
// graph (shouldn't happen, but defensive) terminate cleanly.
export const wouldCreateCycle = (db: any, parent: Block.Block, child: Block.Block): boolean => {
  if (!db || !parent || !child) {
    return false;
  }
  if ((parent as any)?.id === (child as any)?.id) {
    return true;
  }
  const visited = new Set<string>();
  const stack: Block.Block[] = [child];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const currentId = (current as any)?.id;
    if (!currentId || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    const edges = childEdgesOf(db, current);
    for (const edge of edges) {
      const target = Relation.getTarget(edge) as any;
      if (!target) {
        continue;
      }
      if (target.id === (parent as any)?.id) {
        return true;
      }
      stack.push(target);
    }
  }
  return false;
};

// React hook: returns the live SET of structural predecessors of
// `child` — i.e. one entry per distinct Block that owns a
// `ChildEdge` whose `target` is `child`. Subscribes to the
// ChildEdge query so the list updates when a predecessor edge is
// added or removed.
//
// The returned array is UNSORTED — callers that render the list
// for users (e.g. F-DAG.Phase3e.predecessor-nav-list) apply the
// spec's sort (alphabetical case-insensitive by display label,
// `Block.id` tiebreaker, `(unnamed)` last) themselves so this hook
// stays a pure-data reader.
export const usePredecessors = (child: Block.Block | undefined): Block.Block[] => {
  const db = child ? Obj.getDatabase(child) : undefined;
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
    if (!db || !child) {
      return [];
    }
    const edges = parentEdgesOf(db, child);
    const seen = new Set<string>();
    const predecessors: Block.Block[] = [];
    for (const edge of edges) {
      const source = Relation.getSource(edge) as Block.Block | undefined;
      const id = (source as any)?.id as string | undefined;
      if (source && id && !seen.has(id)) {
        seen.add(id);
        predecessors.push(source);
      }
    }
    return predecessors;
    // `tick` participates so edge add/remove refreshes the list.
  }, [db, child, tick]);
};

// React hook: returns the live count of structural parents (edges
// fanning IN to `child`). Subscribes to the ChildEdge query so the
// count updates when a Block becomes multi-parent (or stops).
//
// NOTE: legacy `Block.children` entries that haven't migrated are
// NOT counted here — only ChildEdges. For Phase 3e this is the right
// behavior: the multi-parent badge surfaces NEW behaviour enabled by
// edges, and a Block that still lives only under a legacy parent
// stays single-parent until that parent gets written-to.
export const useParentEdgeCount = (child: Block.Block | undefined): number => {
  const db = child ? Obj.getDatabase(child) : undefined;
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
    if (!db || !child) {
      return 0;
    }
    return parentEdgesOf(db, child).length;
    // `tick` participates so subscription bumps recompute.
  }, [db, child, tick]);
};

// React hook: returns the `expanded` flag for the edge `parent →
// block`, with a fallback to the legacy `block.state.expanded`
// when no edge has yet been created (pre-migration). Default is
// `true` (visible / expanded).
//
// F-DAG Phase 4: collapse state lives PER OCCURRENCE — when a
// Block has multiple parents (Cmd+Tab link from Phase 3e), each
// edge tracks its own `expanded`, so the user can collapse the
// Block in one place and leave it open in another.
//
// Subscribes both to the ChildEdge query (for edge add/remove) AND
// to each edge object individually via `Obj.subscribe` (for field-
// level changes like the `expanded` toggle). Without the per-edge
// subscription the result-set listener never fires for an in-place
// field write and the UI would not refresh.
export const useEdgeExpanded = (parent: Block.Block, block: Block.Block): boolean => {
  const db = parent ? Obj.getDatabase(parent) : undefined;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!db) {
      return;
    }
    let edgeSubs: Array<() => void> = [];
    const resubscribe = () => {
      for (const unsub of edgeSubs) {
        try {
          unsub();
        } catch {
          /* noop */
        }
      }
      edgeSubs = [];
      const all = (db.query(Filter.typename(ChildEdge.ChildEdge.typename)).runSync() ?? []) as Array<{
        object: any;
      }>;
      for (const item of all) {
        const edge = (item as any).object ?? item;
        const unsub = Obj.subscribe(edge, () => setTick((value) => value + 1));
        edgeSubs.push(unsub);
      }
    };
    resubscribe();
    const query: any = db.query(Filter.typename(ChildEdge.ChildEdge.typename));
    const querySub = query?.subscribe?.(() => {
      // Set may have changed (edge created/deleted) — re-bind per-
      // edge subscriptions and refresh.
      resubscribe();
      setTick((value) => value + 1);
    });
    return () => {
      for (const unsub of edgeSubs) {
        try {
          unsub();
        } catch {
          /* noop */
        }
      }
      try {
        querySub?.();
      } catch {
        /* noop */
      }
    };
  }, [db]);

  return useMemo(() => {
    if (db && parent && block) {
      const edge = findChildEdge(db, parent, block);
      if (edge && typeof (edge as any).expanded === 'boolean') {
        return (edge as any).expanded as boolean;
      }
    }
    // Fall back to the legacy per-Block flag.
    const blockState = (block as any)?.state as { expanded?: boolean } | undefined;
    return blockState?.expanded !== false;
    // `tick` participates so edge mutations refresh.
  }, [db, parent, block, tick]);
};

// Writer counterpart to `useEdgeExpanded`. Persists the collapse
// state ON the edge if one exists, falling back to the legacy
// `Block.state.expanded` if not (which is harmless even after the
// fallback path becomes unreachable post-3d).
export const setEdgeExpanded = (
  db: any,
  parent: Block.Block,
  block: Block.Block,
  expanded: boolean,
): void => {
  if (!db) {
    return;
  }
  const edge = findChildEdge(db, parent, block);
  if (edge) {
    Relation.update(edge as any, (edge: any) => {
      edge.expanded = expanded;
    });
    return;
  }
  Obj.update(block, (block: any) => {
    block.state = { ...(block.state ?? {}), expanded };
  });
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
