//
// Copyright 2025 DXOS.org
//

import { useEffect, useMemo, useState } from 'react';

import { Filter, Obj } from '@dxos/echo';

import { collectTagTypes } from '../BlockEditor/tag-types';

import { createChildEdge } from './child-edges';

import { Block } from '#types';

// F-6 Phase 3 (system-node): the per-space "Schema" Block is the
// permanent parent of every tag-typename Block. Marker is stored on
// `Block.systemNode`; lookups go by that marker.
export const SCHEMA_NODE_KEY = 'schema';
export const SCHEMA_NODE_LABEL = 'Schema';

export const findSchemaBlock = (db: any): Block.Block | undefined => {
  if (!db) {
    return undefined;
  }
  const blocks = (db.query(Filter.typename(Block.Block.typename)).runSync() ?? []) as Array<{ object: Block.Block }>;
  for (const item of blocks) {
    const block = (item as any).object ?? item;
    if ((block as any).systemNode === SCHEMA_NODE_KEY) {
      return block as Block.Block;
    }
  }
  return undefined;
};

// Find or create the per-space Schema Block. Used as the parent for
// freshly-materialized tag Blocks so that zooming to a tag node lands
// the user in an outline tree (Schema → tag1, tag2, …) rather than a
// dangling top-level Block.
export const findOrCreateSchemaBlock = (db: any): Block.Block => {
  const existing = findSchemaBlock(db);
  if (existing) {
    return existing;
  }
  const schema = Block.make({
    content: [{ kind: 'text', text: SCHEMA_NODE_LABEL }] as any,
    systemNode: SCHEMA_NODE_KEY,
  });
  db.add(schema);
  return schema;
};

// F-6 Phase 3 (tag-node): per-space "tag Block" registry.
//
// For each tag-ready typename in the space we materialize exactly ONE
// Block carrying a `tagTypename` marker. That Block's `content` is the
// renameable label shown on every `#Foo` chip in this space, and the
// Block is the navigation target when the user clicks the chip.
//
// Parallels `tag-options.ts` but one level up: tag-options matter
// per-(typename, fieldName, literal); tag-supertags matter
// per-typename. Both live within the plugin and avoid editing ECHO,
// per `rule R-No-Echo-Changes` in PLUGIN.mdl.

// Process-global lock — same rationale as tag-options.ts: React's
// Strict Mode double-invokes the materialization effect, and both
// runs would otherwise create a tag Block before either's `db.add`
// reflects in the next render's query.
const createLocks = new WeakMap<object, Set<string>>();

const acquireLock = (db: any, typename: string): boolean => {
  let set = createLocks.get(db);
  if (!set) {
    set = new Set<string>();
    createLocks.set(db, set);
  }
  if (set.has(typename)) {
    return false;
  }
  set.add(typename);
  return true;
};

// Synchronous lookup. Returns the existing tag Block matching the
// typename in the given database, or undefined if none exists yet.
export const findTagBlock = (db: any, typename: string): Block.Block | undefined => {
  if (!db) {
    return undefined;
  }
  const blocks = (db.query(Filter.typename(Block.Block.typename)).runSync() ?? []) as Array<{ object: Block.Block }>;
  for (const item of blocks) {
    const block = (item as any).object ?? item;
    if ((block as any).tagTypename === typename) {
      return block as Block.Block;
    }
  }
  return undefined;
};

// Create-and-add a new tag Block in the given database. Seeds the
// content with `defaultLabel` (typically the schema-declared title for
// the typename) and writes the `tagTypename` marker so it's findable
// on next encounter. The tag Block is appended as a child of the
// per-space Schema Block (auto-materialized on first use) so the
// user can navigate the full set of tag types from one place.
//
// F-6 Phase 3b: also auto-creates a single query child whose
// `queryRef.typename === typename`. Per
// `F-6.Phase3.tag-node.children-are-queries`, a tag node's only
// allowed children are query nodes — by creating one at
// materialization time, we both enforce that invariant and give the
// user a working "show me all #Task instances" view the moment they
// land on the tag page.
export const createTagBlock = (db: any, typename: string, defaultLabel: string): Block.Block => {
  const block = Block.make({
    content: [{ kind: 'text', text: defaultLabel }] as any,
    tagTypename: typename,
  });
  db.add(block);

  const queryChild = Block.make({
    queryRef: { typename },
  });
  db.add(queryChild);
  // F-DAG Phase 2: tag node → query child as a ChildEdge.
  // `tagBlock.children` stays empty; readers use the merge hook.
  createChildEdge(db, block, queryChild);

  // F-DAG Phase 2: Schema → tag node as a ChildEdge.
  // `schemaBlock.children` stays empty across additions.
  const schemaBlock = findOrCreateSchemaBlock(db);
  createChildEdge(db, schemaBlock, block);
  return block;
};

// React hook: find the tag Block for `typename` and materialize it on
// first encounter. Returns the resolved Block (or undefined while
// resolution is in flight, or when `db` / `typename` is missing).
//
// Same shape as `useOptionBlock` in tag-options.ts: re-querying
// against a `tick` state ensures the new Block shows up after
// create; a lock-then-recheck guards against Strict Mode duplicate
// creates.
export const useTagBlock = (
  db: any,
  typename: string | undefined,
  defaultLabel: string | undefined,
): Block.Block | undefined => {
  const [tick, setTick] = useState(0);

  const existing = useMemo(() => {
    if (!db || !typename) {
      return undefined;
    }
    return findTagBlock(db, typename);
    // `tick` participates so the re-query runs after create.
  }, [db, typename, tick]);

  useEffect(() => {
    if (!db || !typename || existing || !defaultLabel) {
      return;
    }
    // Re-check synchronously before creating — another effect may
    // have created since this hook's memo last ran.
    const recheck = findTagBlock(db, typename);
    if (recheck) {
      setTick((value) => value + 1);
      return;
    }
    if (!acquireLock(db, typename)) {
      // Another effect in this session is already creating this tag
      // Block. Wait one tick and re-query; the lock-holder's
      // `db.add` will be visible by then.
      setTick((value) => value + 1);
      return;
    }
    createTagBlock(db, typename, defaultLabel);
    setTick((value) => value + 1);
  }, [db, typename, existing, defaultLabel]);

  return existing;
};

// F-Supertag.eager-materialization: walk the qualifying-type set from
// `collectTagTypes` and ensure a tag-node Block exists for each.
// Re-uses `createTagBlock` for the creation path (which also wires
// the query-node child + Schema → tag-node ChildEdge), and
// `acquireLock` for race-free concurrent calls from multiple panes.
//
// Idempotent on every dimension: re-runs against the same registry
// state produce zero writes (the `findTagBlock` short-circuit fires
// for every already-materialized typename).
export const ensureAllSupertagNodes = (db: any): void => {
  if (!db) {
    return;
  }
  const entries = collectTagTypes(db);
  for (const entry of entries) {
    if (findTagBlock(db, entry.typename)) {
      continue;
    }
    if (!acquireLock(db, entry.typename)) {
      // Another effect is mid-create for this typename; the lock
      // holder's `db.add` will be visible on the next render and
      // the next `ensureAllSupertagNodes` call will see it.
      continue;
    }
    createTagBlock(db, entry.typename, entry.title);
  }
};

// F-Supertag.uniqueness: one-time-per-space normalisation sweep.
// Groups every Ref in every Block's `supertags` array by
// `(targetId, targetTypename)`. For every group with more than one
// distinct holding Block, the lowest-`Block.id` member is canonical
// and the supertag Ref is removed from the rest.
//
// (The spec also calls for a schema-ancestry-based canonical
// preference — "parented under Schema → supertag-node-for-T" wins
// over lowest-Block.id. That walk is non-trivial and deferred; the
// lowest-`Block.id` fallback satisfies the invariant on its own.)
const uniquenessSweepLocks = new WeakMap<object, boolean>();

export const normalizeSupertagUniqueness = (db: any): void => {
  if (!db) {
    return;
  }
  if (uniquenessSweepLocks.get(db)) {
    return;
  }
  uniquenessSweepLocks.set(db, true);

  const items = (db.query(Filter.typename(Block.Block.typename)).runSync() ?? []) as Array<{ object: any }>;
  const blocks = items.map((item) => (item as any).object ?? item);

  // Map<"instanceId|typename", Block[]>.
  const groups = new Map<string, any[]>();
  for (const block of blocks) {
    const supertags = ((block as any).supertags ?? []) as readonly any[];
    for (const ref of supertags) {
      const target = ref?.target;
      if (!target) {
        continue;
      }
      const typename = Obj.getTypename(target);
      if (!typename) {
        continue;
      }
      const key = `${target.id}|${typename}`;
      const arr = groups.get(key) ?? [];
      if (!arr.find((b) => b.id === block.id)) {
        arr.push(block);
      }
      groups.set(key, arr);
    }
  }

  for (const [key, members] of groups) {
    if (members.length <= 1) {
      continue;
    }
    members.sort((a, b) => a.id.localeCompare(b.id));
    const duplicates = members.slice(1);
    const separator = key.indexOf('|');
    const targetId = key.slice(0, separator);
    const targetTypename = key.slice(separator + 1);
    for (const duplicate of duplicates) {
      Obj.update(duplicate, (duplicate: any) => {
        const supertags = ((duplicate as any).supertags ?? []) as any[];
        duplicate.supertags = supertags.filter((ref: any) => {
          const target = ref?.target;
          return !(target && target.id === targetId && Obj.getTypename(target) === targetTypename);
        });
      });
    }
  }
};

// React hook wrapper for `normalizeSupertagUniqueness`. Runs once
// per (db, session) on outline mount. The lock inside the helper
// makes redundant calls from concurrent panes harmless.
export const useNormalizeSupertagUniqueness = (db: any): void => {
  useEffect(() => {
    normalizeSupertagUniqueness(db);
  }, [db]);
};

// React hook wrapper for `ensureAllSupertagNodes`. Runs on mount,
// then subscribes to the schemaRegistry so new types registered
// during the article surface's lifetime materialize without a
// remount. Cleanup unsubscribes on unmount.
//
// Multiple panes will each call this hook independently; the lock
// inside `ensureAllSupertagNodes` prevents duplicate creates.
export const useEnsureAllSupertagNodes = (db: any): void => {
  useEffect(() => {
    if (!db?.schemaRegistry?.query) {
      return;
    }
    ensureAllSupertagNodes(db);
    const query: any = db.schemaRegistry.query({ location: ['database', 'runtime'] });
    const sub = query?.subscribe?.(() => ensureAllSupertagNodes(db));
    return () => {
      try {
        sub?.();
      } catch {
        /* noop */
      }
    };
  }, [db]);
};

// Read the displayed label for a tag Block. Pulls plain text from
// the Block's `content`; ref segments are ignored because tag Blocks
// are intended to hold simple text labels (with `#` prefix added at
// render time).
export const tagLabelOf = (block: Block.Block | undefined): string | undefined => {
  if (!block) {
    return undefined;
  }
  const segments = ((block as any).content ?? []) as readonly any[];
  const text = segments
    .map((segment) => (segment?.kind === 'text' ? (segment.text ?? '') : ''))
    .join('')
    .trim();
  return text.length > 0 ? text : undefined;
};
