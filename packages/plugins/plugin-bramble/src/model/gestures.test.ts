//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';
import { Filter, Query } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Text } from '@dxos/schema';
import { createEdge } from './edges';
import { dragPlan, indentPlan, mergePlan, outdentPlan, reorderPlan, splitPlan } from './gestures';
import { outlineRows } from './outline';
import { Edge, Node, makeNode } from '../types';

describe('gestures', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;
  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase({ types: [Node, Edge, Text.Text] }));
  });
  afterEach(async () => { await builder.close(); });

  const add = (t: string) => db.add(makeNode({ text: t }));
  const rowsOf = async (root: Node) => outlineRows((await db.query(Query.select(Filter.type(Edge))).run()) as Edge[], root);

  test('splitPlan on a childless node makes a next sibling with the tail text', async ({ expect }) => {
    const root = add('root'); const a = add('alpha'); const b = add('bravo');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await db.flush();
    const rows = await rowsOf(root);
    const plan = splitPlan(rows, root, a.id, 2); // caret after "al"
    expect(plan.keepText).toBe('al');
    expect(plan.newText).toBe('pha');
    expect(plan.parentId).toBe(root.id);        // sibling of a → same parent (root)
    expect(plan.order).toBeGreaterThan(1);       // between a(1) and b(2)
    expect(plan.order).toBeLessThan(2);
  });

  test('splitPlan on a node with children makes a first child', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const a1 = add('a1');
    await createEdge(db, root, a, 1); await createEdge(db, a, a1, 5); await db.flush();
    const rows = await rowsOf(root);
    const plan = splitPlan(rows, root, a.id, 1);
    expect(plan.parentId).toBe(a.id);            // first child of a
    expect(plan.order).toBeLessThan(5);          // before a1(5)
  });

  test('splitPlan on the root (header) makes a first child of root', async ({ expect }) => {
    const root = add('title');
    await db.flush();
    const rows = await rowsOf(root);
    const plan = splitPlan(rows, root, root.id, 5);
    expect(plan.parentId).toBe(root.id);
    expect(plan.keepText).toBe('title');
    expect(plan.newText).toBe('');
  });

  test('mergePlan merges a childless node into the row above', async ({ expect }) => {
    const root = add('root'); const a = add('aa'); const b = add('bb');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await db.flush();
    const rows = await rowsOf(root);
    const plan = mergePlan(rows, root, b.id);
    expect(plan).not.toBeNull();
    expect(plan!.precedingId).toBe(a.id);
    expect(plan!.nodeText).toBe('bb');
    expect(plan!.mergeOffset).toBe(2); // caret lands after "aa"
  });

  test('mergePlan is a no-op for the first row (merges into root header) and for a node with children', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const a1 = add('a1');
    await createEdge(db, root, a, 1); await createEdge(db, a, a1, 1); await db.flush();
    const rows = await rowsOf(root);
    expect(mergePlan(rows, root, a.id)).toBeNull();          // a has a child → deferred
    expect(mergePlan(rows, root, a1.id)!.precedingId).toBe(a.id); // a1 merges into a
  });

  test('indentPlan nests a row under its preceding sibling (appended)', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await db.flush();
    const rows = await rowsOf(root);
    const plan = indentPlan(rows, root, b.id);
    expect(plan).toEqual({ newParentId: a.id, order: 0 }); // a has no children → appended at 0
  });

  test('indentPlan is a no-op for a first child (no preceding sibling)', async ({ expect }) => {
    const root = add('root'); const a = add('a');
    await createEdge(db, root, a, 1); await db.flush();
    expect(indentPlan(await rowsOf(root), root, a.id)).toBeNull();
  });

  test('outdentPlan lifts a nested row to be its parent’s following sibling', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const a1 = add('a1'); const b = add('b');
    await createEdge(db, root, a, 1); await createEdge(db, a, a1, 1); await createEdge(db, root, b, 2); await db.flush();
    const plan = outdentPlan(await rowsOf(root), root, a1.id);
    expect(plan!.newParentId).toBe(root.id);   // grandparent
    expect(plan!.order).toBeGreaterThan(1);      // after a(1), before b(2)
    expect(plan!.order).toBeLessThan(2);
  });

  test('outdentPlan is a no-op at the top level', async ({ expect }) => {
    const root = add('root'); const a = add('a');
    await createEdge(db, root, a, 1); await db.flush();
    expect(outdentPlan(await rowsOf(root), root, a.id)).toBeNull();
  });

  test('reorderPlan up moves a row before its preceding sibling', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b'); const c = add('c');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await createEdge(db, root, c, 3); await db.flush();
    const rows = await rowsOf(root);
    const plan = reorderPlan(rows, root, c.id, -1); // c up → between a(1) and b(2)
    expect(plan!.order).toBeGreaterThan(1);
    expect(plan!.order).toBeLessThan(2);
  });
  test('reorderPlan is a no-op at the ends', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await db.flush();
    const rows = await rowsOf(root);
    expect(reorderPlan(rows, root, a.id, -1)).toBeNull(); // a is first
    expect(reorderPlan(rows, root, b.id, 1)).toBeNull();  // b is last
  });

  describe('dragPlan', () => {
    test('reorder-below among siblings stays same-parent → reorder', async ({ expect }) => {
      const root = add('root'); const a = add('a'); const b = add('b');
      await createEdge(db, root, a, 0); await createEdge(db, root, b, 1); await db.flush();
      const rows = await rowsOf(root);
      const plan = dragPlan(rows, root, a.id, b.id, 'reorder-below');
      expect(plan).toEqual({ kind: 'reorder', order: expect.any(Number) });
      expect((plan as any).order).toBeGreaterThan(1); // after b(1)
    });

    test('reorder-above among siblings stays same-parent → reorder', async ({ expect }) => {
      const root = add('root'); const a = add('a'); const b = add('b');
      await createEdge(db, root, a, 0); await createEdge(db, root, b, 1); await db.flush();
      const rows = await rowsOf(root);
      const plan = dragPlan(rows, root, b.id, a.id, 'reorder-above');
      expect(plan).toEqual({ kind: 'reorder', order: expect.any(Number) });
      expect((plan as any).order).toBeLessThan(0); // before a(0)
    });

    test('reorder onto a row under a different parent → reparent to that parent', async ({ expect }) => {
      const root = add('root'); const a = add('a'); const b = add('b'); const a1 = add('a1');
      await createEdge(db, root, a, 0); await createEdge(db, root, b, 1);
      await createEdge(db, a, a1, 0); await db.flush();
      const rows = await rowsOf(root);
      const plan = dragPlan(rows, root, b.id, a1.id, 'reorder-below');
      expect(plan).toEqual({ kind: 'reparent', newParentId: a.id, order: expect.any(Number) });
    });

    test('make-child nests under the target as its last child', async ({ expect }) => {
      const root = add('root'); const a = add('a'); const b = add('b');
      await createEdge(db, root, a, 0); await createEdge(db, root, b, 1); await db.flush();
      const rows = await rowsOf(root);
      const plan = dragPlan(rows, root, b.id, a.id, 'make-child');
      expect(plan).toEqual({ kind: 'reparent', newParentId: a.id, order: expect.any(Number) });
    });

    test('make-child onto own current parent → reorder to end (no parent change)', async ({ expect }) => {
      const root = add('root'); const a = add('a'); const a1 = add('a1'); const a2 = add('a2');
      await createEdge(db, root, a, 0);
      await createEdge(db, a, a1, 0); await createEdge(db, a, a2, 1); await db.flush();
      const rows = await rowsOf(root);
      const plan = dragPlan(rows, root, a1.id, a.id, 'make-child');
      expect(plan).toEqual({ kind: 'reorder', order: expect.any(Number) });
      expect((plan as any).order).toBeGreaterThan(1); // after a2(1)
    });

    test('dropping a node onto itself is a no-op', async ({ expect }) => {
      const root = add('root'); const a = add('a');
      await createEdge(db, root, a, 0); await db.flush();
      const rows = await rowsOf(root);
      expect(dragPlan(rows, root, a.id, a.id, 'make-child')).toBeNull();
    });

    test('dropping a node into its own subtree is rejected (cycle guard)', async ({ expect }) => {
      const root = add('root'); const a = add('a'); const a1 = add('a1');
      await createEdge(db, root, a, 0); await createEdge(db, a, a1, 0); await db.flush();
      const rows = await rowsOf(root);
      expect(dragPlan(rows, root, a.id, a1.id, 'make-child')).toBeNull();
      expect(dragPlan(rows, root, a.id, a1.id, 'reorder-below')).toBeNull();
    });

    test('make-child onto a nonexistent target is a no-op', async ({ expect }) => {
      const root = add('root'); const a = add('a');
      await createEdge(db, root, a, 0); await db.flush();
      const rows = await rowsOf(root);
      expect(dragPlan(rows, root, a.id, 'no-such-node-id', 'make-child')).toBeNull();
    });

    test('make-child onto own parent when source is already the last child → reorder past the true last other sibling', async ({ expect }) => {
      const root = add('root'); const a = add('a'); const a1 = add('a1'); const a2 = add('a2');
      await createEdge(db, root, a, 0);
      await createEdge(db, a, a1, 0); await createEdge(db, a, a2, 1); await db.flush();
      const rows = await rowsOf(root);
      // a2 is already a's last child; make-child onto a orders it after a1 (the last OTHER sibling,
      // order 0) → exactly 1. With the source unfiltered (the pre-fix bug) it would order off a2's
      // own edge (order 1) → 2, so this exact bound is what pins the fix.
      const plan = dragPlan(rows, root, a2.id, a.id, 'make-child');
      expect(plan).toEqual({ kind: 'reorder', order: expect.any(Number) });
      expect((plan as any).order).toBe(1);
    });
  });
});
