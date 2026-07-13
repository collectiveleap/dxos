//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';

import { Filter, Query } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Text } from '@dxos/schema';

import { createEdge } from './edges';
import { outlineRows } from './outline';
import { Edge, Node, makeNode } from '../types';

describe('outlineRows', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase({ types: [Node, Edge, Text.Text] }));
  });
  afterEach(async () => {
    await builder.close();
  });

  const add = (t: string) => db.add(makeNode({ text: t }));
  const allEdges = async () => (await db.query(Query.select(Filter.type(Edge))).run()) as Edge[];

  // Shared seeding helper: Root → { a → a1, b }.
  const seedRootABTree = async () => {
    const root = add('root');
    const a = add('a');
    const a1 = add('a1');
    const b = add('b');
    await createEdge(db, root, a, 1);
    await createEdge(db, a, a1, 1);
    await createEdge(db, root, b, 2);
    await db.flush();
    return { edges: await allEdges(), root, a, a1, b };
  };

  test('a childless root yields no rows', async ({ expect }) => {
    const root = add('root');
    await db.flush();
    expect(outlineRows(await allEdges(), root)).toEqual([]);
  });

  test('children render at depth 0 in order', async ({ expect }) => {
    const root = add('root');
    const a = add('a');
    const b = add('b');
    const c = add('c');
    await createEdge(db, root, a, 1);
    await createEdge(db, root, b, 2);
    await createEdge(db, root, c, 3);
    await db.flush();

    const rows = outlineRows(await allEdges(), root);
    expect(rows.map((r) => r.node.id)).toEqual([a.id, b.id, c.id]);
    expect(rows.map((r) => r.depth)).toEqual([0, 0, 0]);
  });

  test('descendants are depth-annotated depth-first, with hasChildren', async ({ expect }) => {
    const { edges, root, a, a1, b } = await seedRootABTree();

    const rows = outlineRows(edges, root);
    expect(rows.map((r) => [r.node.id, r.depth])).toEqual([
      [a.id, 0],
      [a1.id, 1],
      [b.id, 0],
    ]);
    expect(rows.map((r) => r.hasChildren)).toEqual([true, false, false]);
  });

  test('a collapsed node emits its row but omits its successors', async ({ expect }) => {
    const { edges, root, a, a1 } = await seedRootABTree();
    const rows = outlineRows(edges, root, new Set([a.id]));
    const ids = rows.map((r) => r.node.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(a1.id); // a's subtree is hidden
    const aRow = rows.find((r) => r.node.id === a.id)!;
    expect(aRow.collapsed).toBe(true);
    expect(aRow.hasChildren).toBe(true); // still has children, just hidden
  });

  test('collapsed defaults to false and omits nothing when empty', async ({ expect }) => {
    const { edges, root, a1 } = await seedRootABTree();
    const rows = outlineRows(edges, root); // no collapsed arg
    expect(rows.map((r) => r.node.id)).toContain(a1.id);
    expect(rows.every((r) => r.collapsed === false)).toBe(true);
  });
});
