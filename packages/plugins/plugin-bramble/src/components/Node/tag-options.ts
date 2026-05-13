//
// Copyright 2025 DXOS.org
//

import { useEffect, useMemo, useState } from 'react';

import { Filter, Obj } from '@dxos/echo';

import { Bramble } from '#types';

// Per-database lock: keys we've already kicked off a create for in
// this client session. Without this, React Strict Mode's
// double-invoked effect mounts both run a create before either's
// `db.add` reflects in the next render's query — yielding duplicate
// option Blocks for the same (typename, fieldName, literal). The
// lock is intentionally process-global (one map across all hook
// instances) because the find-or-create contract is "exactly one
// Block per key in the space", which spans component trees.
const createLocks = new WeakMap<object, Set<string>>();

const lockKey = (key: OptionKey): string =>
  `${key.typename} ${key.fieldName} ${key.literal}`;

const acquireLock = (db: any, key: OptionKey): boolean => {
  let set = createLocks.get(db);
  if (!set) {
    set = new Set<string>();
    createLocks.set(db, set);
  }
  const k = lockKey(key);
  if (set.has(k)) {
    return false;
  }
  set.add(k);
  return true;
};

// F-6 Phase 2: per-space "option Block" registry.
//
// For each enum-style field on a tagged-typename (e.g. Task.priority,
// Task.status), we materialize ONE Block per declared literal in the
// space. The Block's `content` is the user-visible label and can be
// renamed; the `tagOption` marker carries the schema-declared
// identity tuple (typename, fieldName, literal) so lookups stay
// stable across renames.
//
// The typed instance's field still stores the literal string
// (`task.priority === 'high'`). This module never edits the schema —
// it only layers a per-space wrapper over the existing literal —
// per `rule R-No-Echo-Changes` in PLUGIN.mdl.

export type OptionKey = {
  typename: string;
  fieldName: string;
  literal: string;
};

// Synchronous lookup. Returns the existing option Block matching the
// key in the given database, or undefined if none exists yet. Walks
// the typename-filtered Block set with a structural match on the
// tag-option marker.
export const findOptionBlock = (db: any, key: OptionKey): Bramble.Node | undefined => {
  if (!db) {
    return undefined;
  }
  const blocks = (db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? []) as Array<{ object: Bramble.Node }>;
  for (const item of blocks) {
    const block = (item as any).object ?? item;
    const marker = (block as any).tagOption as OptionKey | undefined;
    if (
      marker &&
      marker.typename === key.typename &&
      marker.fieldName === key.fieldName &&
      marker.literal === key.literal
    ) {
      return block as Bramble.Node;
    }
  }
  return undefined;
};

// Create-and-add a new option Block in the given database. Seeds the
// content with `defaultLabel` (typically the schema-declared title for
// the literal) and writes the marker so it's findable on next
// encounter. Caller is responsible for ensuring this is wrapped in
// the appropriate change context (db.add handles its own).
export const createOptionBlock = (db: any, key: OptionKey, defaultLabel: string): Bramble.Node => {
  const block = Bramble.makeNode({
    content: [{ kind: 'text', text: defaultLabel }] as any,
    tagOption: { ...key },
  });
  db.add(block);
  return block;
};

// React hook: find the option Block for `key` and materialize it on
// first encounter. Returns the resolved Block (or undefined while
// resolution is in flight or `key` / `db` is missing).
//
// Resolution rules:
// - If `key` is null (e.g. the field isn't set on the typed instance),
//   no Block is returned and none is created.
// - On the first render where a non-null `key` doesn't match any
//   existing Block, an effect runs that creates one with
//   `defaultLabel`. The next render sees the new Block via the
//   re-query and returns it.
// - The hook re-queries when `(typename, fieldName, literal)` change.
//   Subscribing to live label rename is the caller's responsibility
//   via `useObject` once they have the returned Block.
export const useOptionBlock = (
  db: any,
  key: OptionKey | null,
  defaultLabel: string | undefined,
): Bramble.Node | undefined => {
  // Re-render tick: bump when we create a Block so the next render's
  // synchronous lookup sees it. Without this, the create-effect's new
  // Block wouldn't show up until something else triggers a re-render.
  const [tick, setTick] = useState(0);

  const existing = useMemo(() => {
    if (!db || !key) {
      return undefined;
    }
    return findOptionBlock(db, key);
    // `tick` participates so the re-query runs after create.
  }, [db, key?.typename, key?.fieldName, key?.literal, tick]);

  useEffect(() => {
    if (!db || !key || existing || !defaultLabel) {
      return;
    }
    // Re-check synchronously before creating: another effect (e.g.
    // Strict Mode's second invocation, or another FieldGroup
    // rendering the same value) may already have created the Block
    // since this hook's memo last ran.
    const recheck = findOptionBlock(db, key);
    if (recheck) {
      setTick((value) => value + 1);
      return;
    }
    if (!acquireLock(db, key)) {
      // Another effect in this client session is already creating
      // (or has created) this option Block. Wait one tick and
      // re-query; the lock-holder's `db.add` will be visible by
      // then.
      setTick((value) => value + 1);
      return;
    }
    createOptionBlock(db, key, defaultLabel);
    setTick((value) => value + 1);
  }, [db, key?.typename, key?.fieldName, key?.literal, existing, defaultLabel]);

  return existing;
};

// Walk the typename-filtered Block set and return every option Block
// for the given (typename, fieldName) pair. Used by the picker to
// surface user-renamed labels alongside any schema-declared literals
// that haven't been materialized yet.
export const listOptionBlocks = (db: any, typename: string, fieldName: string): Bramble.Node[] => {
  if (!db) {
    return [];
  }
  const blocks = (db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? []) as Array<{ object: Bramble.Node }>;
  const result: Bramble.Node[] = [];
  for (const item of blocks) {
    const block = (item as any).object ?? item;
    const marker = (block as any).tagOption as OptionKey | undefined;
    if (marker && marker.typename === typename && marker.fieldName === fieldName) {
      result.push(block as Bramble.Node);
    }
  }
  return result;
};

// Read the displayed label for an option Block. Pulls plain text from
// the Block's `content` (ref segments are ignored for an option label
// — option Blocks are intended to hold simple text labels).
export const optionLabelOf = (block: Bramble.Node | undefined): string | undefined => {
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

// Avoid unused-import warning if Obj is imported above but unused at
// runtime in some build modes (Obj is referenced via Bramble.makeNode above).
void Obj;
