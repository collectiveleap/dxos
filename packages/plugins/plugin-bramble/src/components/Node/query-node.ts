//
// Copyright 2025 DXOS.org
//

import { Filter, Obj } from '@dxos/echo';

import { createEdge } from './edges';

import { Bramble } from '#types';

// F-6 Phase 3b: per-space "Library" Block — catch-all parent for
// wrapper Blocks promoted from query results. Analogous to the
// Schema Block from Phase 3a (one per space, persistent, marker
// stored on `systemNode`).
export const LIBRARY_NODE_KEY = 'library';
export const LIBRARY_NODE_LABEL = 'Library';

export const findLibraryBlock = (db: any): Bramble.Node | undefined => {
  if (!db) {
    return undefined;
  }
  const blocks = (db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? []) as Array<{ object: Bramble.Node }>;
  for (const item of blocks) {
    const block = (item as any).object ?? item;
    if ((block as any).systemNode === LIBRARY_NODE_KEY) {
      return block as Bramble.Node;
    }
  }
  return undefined;
};

export const findOrCreateLibraryBlock = (db: any): Bramble.Node => {
  const existing = findLibraryBlock(db);
  if (existing) {
    return existing;
  }
  const library = Bramble.makeNode({
    content: [{ kind: 'text', text: LIBRARY_NODE_LABEL }] as any,
    systemNode: LIBRARY_NODE_KEY,
  });
  db.add(library);
  return library;
};

// Build a sync index of "which Block, if any, wraps each instance".
// A Block wraps an instance when its `supertags` array contains a
// Ref to that instance. Walked once per query render; cheap enough
// for the spaces we expect at this stage. Returns Map<instanceId,
// wrapperBlock>.
export const buildWrapperIndex = (db: any): Map<string, Bramble.Node> => {
  const index = new Map<string, Bramble.Node>();
  if (!db) {
    return index;
  }
  const blocks = (db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? []) as Array<{ object: Bramble.Node }>;
  for (const item of blocks) {
    const block = (item as any).object ?? item;
    const supertags = ((block as any).supertags ?? []) as readonly any[];
    for (const ref of supertags) {
      const target = ref?.target;
      if (target?.id && !index.has(target.id)) {
        index.set(target.id, block as Bramble.Node);
      }
    }
  }
  return index;
};

// Query all ECHO instances of a given typename. Returns the raw
// objects from the synchronous query. Caller is responsible for
// subscribing to changes if reactivity is wanted.
export const queryInstancesByTypename = (db: any, typename: string): any[] => {
  if (!db || !typename) {
    return [];
  }
  const results = (db.query(Filter.typename(typename)).runSync() ?? []) as Array<{ object: any }>;
  return results.map((item) => (item as any).object ?? item);
};

// Promote a wrapper-less instance: create a fresh node-tagged-with-
// supertag, link it to the instance via `supertags`, and attach the
// node to the per-space Library via a `ChildEdge` relation. Returns
// the newly-created node.
//
// F-Supertag.title-sync (externally-originated seeding): the node's
// content is seeded from `Obj.getLabel(instance)` as a single text
// segment. The steady-state subscriber installed by `Editor`
// keeps the two in sync from there on; if a later external write
// changes the instance's label, the subscriber reflects the change
// into `block.content`.
//
// F-DAG: parent/child for system Blocks (Library, Schema, …)
// migrated to first-class edges. `Library.children` is no longer
// written; readers merge both representations via
// `useStructuralChildren`.
export const promoteToWrapper = (db: any, instance: any): Bramble.Node => {
  const library = findOrCreateLibraryBlock(db);
  let initialLabel = '';
  try {
    const got = Obj.getLabel(instance);
    if (typeof got === 'string') {
      initialLabel = got;
    }
  } catch {
    /* schema declares no usable LabelAnnotation — start with empty label */
  }
  const wrapper = Bramble.makeNode({
    content: [{ kind: 'text', text: initialLabel }] as any,
    supertags: [db.makeRef(Obj.getDXN(instance))] as any,
  });
  db.add(wrapper);
  createEdge(db, library, wrapper);
  return wrapper;
};
