//
// Copyright 2025 DXOS.org
//

import type * as Schema from 'effect/Schema';
import { useEffect, useMemo, useState } from 'react';

import { Filter, Obj, Relation, Type } from '@dxos/echo';

import { initialPropsForTag } from '../Editor/tag-types';
import { createEdge, getStructuralChildren } from '../Node/edges';

import { Bramble } from '#types';

// Returns true iff `node` carries a supertag whose instance typename
// matches `typename` (e.g. `org.dxos.type.bramble.step`). Used by
// substrate-vocabulary UI components (F-New-Run-On-Step etc.) to
// gate themselves to the right kind of page Node.
export const hasSupertagOfTypename = (node: Bramble.Node | null | undefined, typename: string): boolean => {
  if (!node) {
    return false;
  }
  const supertags = ((node as any).supertags ?? []) as readonly any[];
  for (const ref of supertags) {
    const target = ref?.target;
    if (!target) {
      continue;
    }
    if (Obj.getTypename(target) === typename) {
      return true;
    }
  }
  return false;
};

// Resolve a registered ECHO Schema from the space's `schemaRegistry`
// by typename. Returns undefined if not registered (the caller is
// expected to fall back or surface an error).
const findSchemaByTypename = (db: any, typename: string): Schema.Schema.Any | undefined => {
  if (!db?.schemaRegistry?.query) {
    return undefined;
  }
  const schemas = (db.schemaRegistry.query({ location: ['database', 'runtime'] }).runSync() ?? []) as Schema.Schema.Any[];
  // `Type.getTypename` is typed against `AnyEntity` (RelationSchemaBase /
  // ObjSchemaBase), but the schemaRegistry returns `Schema.Schema.Any`
  // whose `Context` widens to `unknown`. The runtime call works on every
  // registered schema; the cast bridges the unknown-vs-never context gap.
  return schemas.find((schema) => Type.getTypename(schema as any) === typename);
};

// Apply a fresh supertag instance of `schema` to `node`. Mirrors
// `Editor.handleSelectTag`: make an instance with default props,
// add to db, push a Ref to it onto `node.supertags`. Returns the
// typed instance.
const applySupertag = (db: any, node: Bramble.Node, schema: Schema.Schema.Any): any => {
  const instance = Obj.make(schema as any, initialPropsForTag(schema) as any);
  db.add(instance);
  Obj.update(node, (n: any) => {
    const previous = ((n.supertags ?? []) as readonly any[]);
    n.supertags = [...previous, db.makeRef(Obj.getDXN(instance))];
  });
  return instance;
};

// F-New-Run-On-Step (Iteration 2c.1, revised): create a Run-Node
// for `stepNode`, tag it `#Run`, link it to the Step via an
// `'is-run-of'` edge, and recursively spawn child Run-Nodes for
// every `#Step`-tagged structural child (linking each via both
// `'is-run-of'` to its sub-Step AND `'parent-run'` to the current
// Run). Returns the parent Run-Node.
//
// Internal helper signature: pass `parentRunNode = undefined` for
// the top-level call. Recursive calls pass the just-created Run as
// the parent so the `'parent-run'` edge fans out from there.
export const createRunOfStep = (
  db: any,
  stepNode: Bramble.Node,
  parentRunNode?: Bramble.Node,
): Bramble.Node | undefined => {
  if (!db || !stepNode) {
    return undefined;
  }
  const runSchema = findSchemaByTypename(db, Bramble.Run.typename);
  if (!runSchema) {
    return undefined;
  }
  const runNode = Bramble.makeNode({ state: { expanded: false } });
  db.add(runNode);
  applySupertag(db, runNode, runSchema);
  createEdge(db, runNode, stepNode, { kind: 'is-run-of' });
  if (parentRunNode) {
    createEdge(db, runNode, parentRunNode, { kind: 'parent-run' });
  }
  // Recurse for every #Step-tagged structural child. Non-#Step
  // children of the Step (e.g. plain notes, other supertag kinds)
  // are NOT walked — only the Step subtree is reified into a Run
  // tree.
  const children = getStructuralChildren(db, stepNode).filter((ref: any) => ref?.target);
  for (const childRef of children) {
    const child = childRef.target as Bramble.Node;
    if (hasSupertagOfTypename(child, Bramble.Step.typename)) {
      createRunOfStep(db, child, runNode);
    }
  }
  return runNode;
};

// Resolve the Step that `runNode` is a Run of by following the
// outgoing `'is-run-of'` edge. Returns undefined if the Run has no
// such edge or the edge's target Node has been deleted.
export const getRunStep = (db: any, runNode: Bramble.Node): Bramble.Node | undefined => {
  if (!db || !runNode) {
    return undefined;
  }
  const all = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{ object: any }>;
  for (const item of all) {
    const edge = (item as any).object ?? item;
    if (edge?.kind !== 'is-run-of') {
      continue;
    }
    if ((Relation.getSource(edge) as any)?.id !== (runNode as any)?.id) {
      continue;
    }
    return Relation.getTarget(edge) as Bramble.Node | undefined;
  }
  return undefined;
};

// React hook variant of `getRunStep`. Re-runs when any Edge in the
// db changes — keeps the runbook view live when edges are added /
// removed during a session.
export const useRunStep = (runNode: Bramble.Node | null | undefined): Bramble.Node | undefined => {
  const db = runNode ? Obj.getDatabase(runNode) : undefined;
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
    if (!runNode) {
      return undefined;
    }
    return getRunStep(db, runNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, runNode, tick]);
};

// Resolve the parent Run-Node of `runNode` (if any) by following the
// outgoing `'parent-run'` edge. Returns undefined for a top-level Run
// (one with no parent-run edge — i.e. the root of a runbook tree).
export const getParentRunOf = (db: any, runNode: Bramble.Node): Bramble.Node | undefined => {
  if (!db || !runNode) {
    return undefined;
  }
  const all = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{ object: any }>;
  for (const item of all) {
    const edge = (item as any).object ?? item;
    if (edge?.kind !== 'parent-run') {
      continue;
    }
    if ((Relation.getSource(edge) as any)?.id !== (runNode as any)?.id) {
      continue;
    }
    return Relation.getTarget(edge) as Bramble.Node | undefined;
  }
  return undefined;
};

// React hook variant of `getParentRunOf`.
export const useParentRunOf = (runNode: Bramble.Node | null | undefined): Bramble.Node | undefined => {
  const db = runNode ? Obj.getDatabase(runNode) : undefined;
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
    if (!runNode) {
      return undefined;
    }
    return getParentRunOf(db, runNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, runNode, tick]);
};

// Find every Run-Node that has a `'parent-run'` edge pointing at
// `parentRunNode`. Sorted by edge `order`. Used by
// F-Run-Execution-View to render child Runs in stable order.
export const getChildRunsOf = (db: any, parentRunNode: Bramble.Node): Bramble.Node[] => {
  if (!db || !parentRunNode) {
    return [];
  }
  const all = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{ object: any }>;
  const matching = all
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => edge?.kind === 'parent-run')
    .filter((edge: any) => (Relation.getTarget(edge) as any)?.id === (parentRunNode as any)?.id);
  matching.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  return matching
    .map((edge: any) => Relation.getSource(edge) as Bramble.Node | undefined)
    .filter((node): node is Bramble.Node => Boolean(node));
};

// Find every Run-Node whose `'is-run-of'` edge points at `stepNode`.
// I.e. every Run that has executed (or is executing) this Step.
// Used by F-Step-Runs-List on `#Step` pages to surface the journal.
// Sorted by Node.id ascending — since ids are ULIDs, this is
// chronological order (oldest first). Callers that want newest-first
// reverse the array.
export const getRunsOfStep = (db: any, stepNode: Bramble.Node): Bramble.Node[] => {
  if (!db || !stepNode) {
    return [];
  }
  const all = (db.query(Filter.typename(Bramble.Edge.typename)).runSync() ?? []) as Array<{ object: any }>;
  const matching = all
    .map((item) => (item as any).object ?? item)
    .filter((edge: any) => edge?.kind === 'is-run-of')
    .filter((edge: any) => (Relation.getTarget(edge) as any)?.id === (stepNode as any)?.id);
  // Map to source (the Run-Node) and de-dupe in case an edge was
  // double-created. Order by ULID for chronological view.
  const seen = new Set<string>();
  const runs: Bramble.Node[] = [];
  for (const edge of matching) {
    const source = Relation.getSource(edge) as Bramble.Node | undefined;
    const id = (source as any)?.id as string | undefined;
    if (source && id && !seen.has(id)) {
      seen.add(id);
      runs.push(source);
    }
  }
  runs.sort((a, b) => (a as any).id.localeCompare((b as any).id));
  return runs;
};

// React hook variant of `getRunsOfStep`. Subscribes to edge changes
// so the journal list re-renders when new Runs are created or old
// ones are deleted.
export const useRunsOfStep = (stepNode: Bramble.Node | null | undefined): Bramble.Node[] => {
  const db = stepNode ? Obj.getDatabase(stepNode) : undefined;
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
    if (!stepNode) {
      return [];
    }
    return getRunsOfStep(db, stepNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, stepNode, tick]);
};

// React hook variant of `getChildRunsOf`. Subscribes to all edge
// changes so the runbook view re-renders when child Runs are added
// or removed.
export const useChildRunsOf = (parentRunNode: Bramble.Node | null | undefined): Bramble.Node[] => {
  const db = parentRunNode ? Obj.getDatabase(parentRunNode) : undefined;
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
    if (!parentRunNode) {
      return [];
    }
    return getChildRunsOf(db, parentRunNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, parentRunNode, tick]);
};
