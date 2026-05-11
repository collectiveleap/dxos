//
// Copyright 2025 DXOS.org
//

import { Filter, Obj } from '@dxos/echo';

import { createChildEdge } from './child-edges';

import { Block } from '#types';

// F-6 Phase 3b: per-space "Library" Block — catch-all parent for
// wrapper Blocks promoted from query results. Analogous to the
// Schema Block from Phase 3a (one per space, persistent, marker
// stored on `systemNode`).
export const LIBRARY_NODE_KEY = 'library';
export const LIBRARY_NODE_LABEL = 'Library';

export const findLibraryBlock = (db: any): Block.Block | undefined => {
  if (!db) {
    return undefined;
  }
  const blocks = (db.query(Filter.typename(Block.Block.typename)).runSync() ?? []) as Array<{ object: Block.Block }>;
  for (const item of blocks) {
    const block = (item as any).object ?? item;
    if ((block as any).systemNode === LIBRARY_NODE_KEY) {
      return block as Block.Block;
    }
  }
  return undefined;
};

export const findOrCreateLibraryBlock = (db: any): Block.Block => {
  const existing = findLibraryBlock(db);
  if (existing) {
    return existing;
  }
  const library = Block.make({
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
export const buildWrapperIndex = (db: any): Map<string, Block.Block> => {
  const index = new Map<string, Block.Block>();
  if (!db) {
    return index;
  }
  const blocks = (db.query(Filter.typename(Block.Block.typename)).runSync() ?? []) as Array<{ object: Block.Block }>;
  for (const item of blocks) {
    const block = (item as any).object ?? item;
    const supertags = ((block as any).supertags ?? []) as readonly any[];
    for (const ref of supertags) {
      const target = ref?.target;
      if (target?.id && !index.has(target.id)) {
        index.set(target.id, block as Block.Block);
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

// Promote a wrapper-less instance: create a fresh Block, link it to
// the instance via `supertags` and `content` (the content carries a
// Ref so the bullet displays the instance's live label), and attach
// the wrapper to the per-space Library Block via a `ChildEdge`
// relation. Returns the newly-created wrapper.
//
// F-DAG: parent/child for system Blocks (Library, Schema, …)
// migrated to first-class edges. `Library.children` is no longer
// written; readers merge both representations via
// `useStructuralChildren`.
export const promoteToWrapper = (db: any, instance: any): Block.Block => {
  const library = findOrCreateLibraryBlock(db);
  const wrapper = Block.make({
    content: [{ kind: 'ref', target: db.makeRef(Obj.getDXN(instance)) }] as any,
    supertags: [db.makeRef(Obj.getDXN(instance))] as any,
  });
  db.add(wrapper);
  createChildEdge(db, library, wrapper);
  return wrapper;
};
