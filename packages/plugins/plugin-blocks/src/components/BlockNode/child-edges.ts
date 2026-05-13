//
// Copyright 2025 DXOS.org
//

import { useEffect, useMemo, useState } from 'react';

import { Filter, Obj, Relation } from '@dxos/echo';

import { Bramble } from '#types';

// F-DAG Phase 5 / Bramble: edge-kind taxonomy. 'child' is the only kind
// that renders as an outline child today; other kinds (reserved for
// future expansion — see CONCEPTS.md §8.1 — like 'reference',
// 'tag-applies', 'cause', 'co-occurs-with') will coexist in the same
// Edge schema but be filtered out of the structural-children read
// paths.
export const EDGE_KIND_CHILD = 'child';

// An edge counts as a child-kind edge when its `kind` is unset (legacy
// before the kind taxonomy landed) or explicitly 'child'. Future
// non-child kinds are excluded.
const isChildKindEdge = (edge: any): boolean => {
  const kind = (edge as any)?.kind;
  return kind === undefined || kind === EDGE_KIND_CHILD;
};

// F-DAG: read + write the structural-children edges of a Node via
// the `Bramble.Edge` relation entity.
//
// Migration policy is incremental — `Node.children` is still the
// authoritative store for most outline writers today, and edges are
// only used where a writer has been ported (currently: the F-Supertag
// Phase 3b promote flow that adds wrappers under Library). To stay
// safe during the transition, every reader uses
// `useStructuralChildren` (or `getStructuralChildren`) which MERGES
// both representations: `Node.children` entries first (preserving
// their array order), then Edge entries sorted by `order`.
//
// Once `Node.children` is fully migrated for a given Node, that
// Node's `children` field will remain in the schema but always be
// empty in the database for that Node; the merge degenerates to the
// pure-edges read.

// Compute the next `order` value to assign when appending a new
// child edge under `parent`. Linear in the number of existing edges
// out of `parent` — fine for the volumes we expect at this stage.
export const nextOrderFor = (db: any, parent: Bramble.Node): number => {
  if (!db) {
    return 0;
  }
  const edges = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{
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
// an array of plain Refs (matching the shape of `Node.children` so
// existing readers don't have to branch). Merges `Node.children`
// entries (kept in their array position) with Edges-out-of-this
// parent (sorted by `order`, appended after).
export const getStructuralChildren = (db: any, parent: Bramble.Node): any[] => {
  const fromChildren = ((parent as any)?.children ?? []) as readonly any[];
  if (!db) {
    return [...fromChildren];
  }
  const allEdges = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{
    object: any;
  }>;
  const incidentEdges = allEdges
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => (Relation.getSource(edge) as any)?.id === (parent as any)?.id)
    .filter((edge: any) => isChildKindEdge(edge));
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

const acquireMigrationLock = (db: any, parent: Bramble.Node): boolean => {
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
// when the parent's `Node.children` (via useObject upstream) or any
// Edge changes. Caller passes the LIVE parent so we can resolve
// `Obj.getDatabase` against it; the snapshot received via useObject
// upstream supplies reactivity for the in-Node children list.
//
// F-DAG Phase 3d: backstop migration. The first time a parent is
// READ in this client session, if its legacy `Node.children` array
// is non-empty, the migration runs (`ensureMigratedChildren`). After
// that, every read returns purely from edges. Graphs that pre-date
// the F-DAG writer migrations get drained without the user having
// to make an explicit edit.
export const useStructuralChildren = (parent: Bramble.Node): any[] => {
  const db = parent ? Obj.getDatabase(parent) : undefined;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!db) {
      return;
    }
    const query: any = db.query(Filter.typename(Bramble.Edge.typename));
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
    // The migration writes new Edges; the existing subscription bumps
    // `tick`, so we don't need to bump it here.
  }, [db, parent]);

  return useMemo(() => {
    if (!parent) {
      return [];
    }
    return getStructuralChildren(db, parent);
    // `tick` participates so edge-add / edge-delete refresh.
  }, [db, parent, tick]);
};

// Create a new Edge from `parent` to `child` with `order` set to one
// past the current maximum among `parent`'s outgoing edges. The edge
// is added to the database; callers must run this inside a change
// context if other mutations need to be batched alongside
// (`Relation.make` doesn't need to be wrapped in `Obj.update` /
// `Relation.update`; it's idempotent on creation).
//
// F-DAG Phase 5 / Bramble:
// - Defaults `kind` to `'child'` so the edge participates in every
//   structural read path. Callers can pass another kind to create
//   non-rendering edges (reserved for future expansion — see
//   CONCEPTS.md §8.1).
// - For 'child'-kind edges, runs cycle detection (`wouldCreateCycle`)
//   and returns `undefined` instead of creating the edge when the
//   write would close a loop. Callers can branch on the return value
//   to surface a UI error or fall back to an alternative.
//   Non-'child' edges are not cycle-checked.
export const createEdge = (
  db: any,
  parent: Bramble.Node,
  child: Bramble.Node,
  options: { order?: number; kind?: string } = {},
): Bramble.Edge | undefined => {
  const kind = options.kind ?? EDGE_KIND_CHILD;
  if (kind === EDGE_KIND_CHILD && wouldCreateCycle(db, parent, child)) {
    return undefined;
  }
  const order = options.order ?? nextOrderFor(db, parent);
  const edge = Relation.make(Bramble.Edge, {
    [Relation.Source]: parent as any,
    [Relation.Target]: child as any,
    order,
    kind,
  });
  db.add(edge as any);
  return edge as any;
};

// Return every 'child'-kind Edge fanning out of `parent`, sorted by
// `order`. Non-'child' kinds (reserved for future expansion) are
// filtered out; the structural read path is the outline tree the
// user sees. Writers that need to see every edge regardless of kind
// can pass `{ includeAllKinds: true }`.
export const childEdgesOf = (
  db: any,
  parent: Bramble.Node,
  options: { includeAllKinds?: boolean } = {},
): any[] => {
  if (!db) {
    return [];
  }
  const all = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{
    object: any;
  }>;
  const incident = all
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => (Relation.getSource(edge) as any)?.id === (parent as any)?.id)
    .filter((edge: any) => (options.includeAllKinds ? true : isChildKindEdge(edge)));
  incident.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  return incident;
};

// Find the edge connecting `parent` to `child`, if any.
export const findEdge = (db: any, parent: Bramble.Node, child: Bramble.Node): any | undefined => {
  const edges = childEdgesOf(db, parent);
  for (const edge of edges) {
    if ((Relation.getTarget(edge) as any)?.id === (child as any)?.id) {
      return edge;
    }
  }
  return undefined;
};

// Delete every Edge fanning out of `parent`. Used by the
// `ensureMigratedChildren` helper when porting a parent's legacy
// `Node.children` list onto edges with re-sequenced orders.
export const removeAllEdges = (db: any, parent: Bramble.Node): void => {
  const edges = childEdgesOf(db, parent);
  for (const edge of edges) {
    db.remove(edge);
  }
};

// One-time migration: if `parent.children` (legacy array) is
// non-empty, convert each entry to an Edge with sequential `order`
// matching the merged view, then clear the array. Any already-
// existing edges are recreated in the same operation so the
// post-migration order matches the pre-migration merged order
// (legacy first, then existing edges by `order`).
//
// No-op when the parent has nothing in `Node.children` — its
// children are already edge-only.
export const ensureMigratedChildren = (db: any, parent: Bramble.Node): void => {
  const legacy = ((parent as any).children ?? []) as readonly any[];
  if (legacy.length === 0) {
    return;
  }
  // Snapshot the merged view BEFORE we tear anything down.
  const merged = getStructuralChildren(db, parent).filter((ref: any) => ref?.target);
  removeAllEdges(db, parent);
  Obj.update(parent, (parent: any) => {
    parent.children = [];
  });
  for (let i = 0; i < merged.length; i++) {
    const target = (merged[i] as any).target as Bramble.Node;
    if (target) {
      createEdge(db, parent, target, { order: i });
    }
  }
};

// Sync reader: returns every 'child'-kind Edge whose target is
// `child` — i.e. every structural parent of `child`. Used by the
// multi-parent indicator and (eventually) the breadcrumb-with-N-
// parents UX. Pass `{ includeAllKinds: true }` to inspect every
// incoming edge regardless of kind.
export const parentEdgesOf = (
  db: any,
  child: Bramble.Node,
  options: { includeAllKinds?: boolean } = {},
): any[] => {
  if (!db) {
    return [];
  }
  const all = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{
    object: any;
  }>;
  return all
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => (Relation.getTarget(edge) as any)?.id === (child as any)?.id)
    .filter((edge: any) => (options.includeAllKinds ? true : isChildKindEdge(edge)));
};

// F-DAG Phase 5: detect whether creating an edge `parent → child`
// would close a cycle in the structural DAG. Returns true when
// `parent === child` (self-loop) OR when `parent` is reachable from
// `child` by walking outgoing 'child'-kind edges. The walk is
// bounded by a `visited` set so cycles already present in the graph
// (shouldn't happen, but defensive) terminate cleanly.
export const wouldCreateCycle = (db: any, parent: Bramble.Node, child: Bramble.Node): boolean => {
  if (!db || !parent || !child) {
    return false;
  }
  if ((parent as any)?.id === (child as any)?.id) {
    return true;
  }
  const visited = new Set<string>();
  const stack: Bramble.Node[] = [child];
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
// `child` — i.e. one entry per distinct Node that owns an Edge whose
// `target` is `child`. Subscribes to the Edge query so the list
// updates when a predecessor edge is added or removed.
//
// The returned array is UNSORTED — callers that render the list for
// users (e.g. F-DAG.Phase3e.predecessor-nav-list) apply the spec's
// sort (alphabetical case-insensitive by display label, `Node.id`
// tiebreaker, `(unnamed)` last) themselves so this hook stays a
// pure-data reader.
export const usePredecessors = (child: Bramble.Node | undefined): Bramble.Node[] => {
  const db = child ? Obj.getDatabase(child) : undefined;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!db) {
      return;
    }
    const query: any = db.query(Filter.typename(Bramble.Edge.typename));
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
    const predecessors: Bramble.Node[] = [];
    for (const edge of edges) {
      const source = Relation.getSource(edge) as Bramble.Node | undefined;
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
// fanning IN to `child`). Subscribes to the Edge query so the count
// updates when a Node becomes multi-parent (or stops).
//
// NOTE: legacy `Node.children` entries that haven't migrated are NOT
// counted here — only Edges. For Phase 3e this is the right
// behavior: the multi-parent badge surfaces NEW behaviour enabled by
// edges, and a Node that still lives only under a legacy parent
// stays single-parent until that parent gets written-to.
export const useParentEdgeCount = (child: Bramble.Node | undefined): number => {
  const db = child ? Obj.getDatabase(child) : undefined;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!db) {
      return;
    }
    const query: any = db.query(Filter.typename(Bramble.Edge.typename));
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
// node`, with a fallback to the legacy `node.state.expanded` when no
// edge has yet been created (pre-migration). Default is `true`
// (visible / expanded).
//
// F-DAG Phase 4: collapse state lives PER OCCURRENCE — when a Node
// has multiple parents (Cmd+Tab link from Phase 3e), each edge
// tracks its own `expanded`, so the user can collapse the Node in
// one place and leave it open in another.
//
// Subscribes both to the Edge query (for edge add/remove) AND to
// each edge object individually via `Obj.subscribe` (for field-level
// changes like the `expanded` toggle). Without the per-edge
// subscription the result-set listener never fires for an in-place
// field write and the UI would not refresh.
export const useEdgeExpanded = (parent: Bramble.Node, node: Bramble.Node): boolean => {
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
      const all = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{
        object: any;
      }>;
      for (const item of all) {
        const edge = (item as any).object ?? item;
        const unsub = Obj.subscribe(edge, () => setTick((value) => value + 1));
        edgeSubs.push(unsub);
      }
    };
    resubscribe();
    const query: any = db.query(Filter.typename(Bramble.Edge.typename));
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
    if (db && parent && node) {
      const edge = findEdge(db, parent, node);
      if (edge && typeof (edge as any).expanded === 'boolean') {
        return (edge as any).expanded as boolean;
      }
    }
    // Fall back to the legacy per-Node flag.
    const nodeState = (node as any)?.state as { expanded?: boolean } | undefined;
    return nodeState?.expanded !== false;
    // `tick` participates so edge mutations refresh.
  }, [db, parent, node, tick]);
};

// Writer counterpart to `useEdgeExpanded`. Persists the collapse
// state ON the edge if one exists, falling back to the legacy
// `Node.state.expanded` if not (which is harmless even after the
// fallback path becomes unreachable post-3d).
export const setEdgeExpanded = (
  db: any,
  parent: Bramble.Node,
  node: Bramble.Node,
  expanded: boolean,
): void => {
  if (!db) {
    return;
  }
  const edge = findEdge(db, parent, node);
  if (edge) {
    Relation.update(edge as any, (edge: any) => {
      edge.expanded = expanded;
    });
    return;
  }
  Obj.update(node, (node: any) => {
    node.state = { ...(node.state ?? {}), expanded };
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
