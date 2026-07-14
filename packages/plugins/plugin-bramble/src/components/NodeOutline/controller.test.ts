//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';

import { Filter, Query, Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Text } from '@dxos/schema';

import { OutlineController } from './controller';
import { childEdges, createEdge } from '../../model/edges';
import { outlineRows } from '../../model/outline';
import { Edge, Node, makeNode } from '../../types';

describe('OutlineController (substrate half)', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;
  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase({ types: [Node, Edge, Text.Text] }));
  });
  afterEach(async () => { await builder.close(); });

  const add = (t: string) => db.add(makeNode({ text: t }));
  const allEdges = async () => (await db.query(Query.select(Filter.type(Edge))).run()) as Edge[];
  const make = (root: Node) => new OutlineController({ db, root, getRows: async () => outlineRows(await allEdges(), root) });

  test('exposes db (for editor extensions that need query access)', async ({ expect }) => {
    const root = add('root');
    await db.flush();
    expect(make(root).db).toBe(db);
  });

  test('createAfter adds a Node under the resolved parent with the tail text', async ({ expect }) => {
    const root = add('root'); const a = add('alpha');
    await createEdge(db, root, a, 1); await db.flush();
    await make(root).createAfter(a.id, 2); // split "al|pha"
    await db.flush();
    const rows = outlineRows(await allEdges(), root);
    // a is childless → new node is a sibling under root, after a
    const texts = rows.map((r) => r.node.text?.target?.content);
    expect(texts).toContain('pha');
    expect(rows.length).toBe(2);
  });

  test('mergeBackward removes a childless node and its edge', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await db.flush();
    await make(root).mergeBackward(b.id);
    await db.flush();
    const rows = outlineRows(await allEdges(), root);
    expect(rows.map((r) => r.node.id)).toEqual([a.id]); // b gone
  });

  test('createAfter leaves keepText in the source and puts the tail in the new node', async ({ expect }) => {
    const root = add('root'); const a = add('alpha');
    await createEdge(db, root, a, 1); await db.flush();
    await make(root).createAfter(a.id, 2); // split "al|pha"
    await db.flush();
    const rows = outlineRows(await allEdges(), root);
    const texts = rows.map((r) => r.node.text?.target?.content).sort();
    expect(texts).toEqual(['al', 'pha']); // source trimmed to 'al', new node holds 'pha'
  });

  test('mergeBackward appends the removed row text to the preceding node', async ({ expect }) => {
    const root = add('root'); const a = add('aa'); const b = add('bb');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await db.flush();
    await make(root).mergeBackward(b.id);
    await db.flush();
    const rows = outlineRows(await allEdges(), root);
    expect(rows.map((r) => r.node.id)).toEqual([a.id]);
    expect(rows[0].node.text?.target?.content).toBe('aabb'); // b's text appended to a
  });

  test('mergeBackward under one parent keeps a multi-predecessor node alive elsewhere', async ({ expect }) => {
    const root = add('root'); const p = add('p'); const shared = add('shared');
    // shared has TWO parents: root (order 2) and p (order 1); p is root's first child
    await createEdge(db, root, p, 1);
    await createEdge(db, p, shared, 1);
    await createEdge(db, root, shared, 2); await db.flush();
    // merge the root→shared occurrence (the last row) into the row above it
    const rows0 = outlineRows(await allEdges(), root);
    const rootShared = rows0.find((r) => r.node.id === shared.id && r.depth === 0)!;
    await make(root).mergeBackward(rootShared.node.id);
    await db.flush();
    // `shared` still exists (still a child of p); only the root→shared edge is gone
    const stillThere = (await db.query(Query.select(Filter.id(shared.id))).run()).length;
    expect(stillThere).toBe(1);
  });

  test('indent moves a row under its preceding sibling', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await db.flush();
    await make(root).indent(b.id); await db.flush();
    const rows = outlineRows(await allEdges(), root);
    expect(rows.map((r) => [r.node.id, r.depth])).toEqual([[a.id, 0], [b.id, 1]]); // b nested under a
  });

  test('reorder down swaps a row past its following sibling', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b');
    await createEdge(db, root, a, 1); await createEdge(db, root, b, 2); await db.flush();
    await make(root).reorder(a.id, 1); await db.flush();
    const rows = outlineRows(await allEdges(), root);
    expect(rows.map((r) => r.node.id)).toEqual([b.id, a.id]); // a now after b
  });
});

describe('OutlineController.applyDrag', () => {
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
  const controllerFor = (root: Node) =>
    new OutlineController({
      db,
      root,
      getRows: async () => outlineRows((await db.query(Query.select(Filter.type(Edge))).run()) as Edge[], root),
      notifyMutated: () => {},
    });
  const childIds = async (parent: Node) =>
    (await childEdges(db, parent)).map((e) => Relation.getTarget(e).id);

  test('reorder-below rewrites order among siblings (same parent)', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b');
    await createEdge(db, root, a, 0); await createEdge(db, root, b, 1); await db.flush();
    await controllerFor(root).applyDrag(a.id, b.id, 'reorder-below');
    expect(await childIds(root)).toEqual([b.id, a.id]);
  });

  test('make-child moves the node under the target and off its old parent', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b');
    await createEdge(db, root, a, 0); await createEdge(db, root, b, 1); await db.flush();
    await controllerFor(root).applyDrag(b.id, a.id, 'make-child'); await db.flush();
    expect(await childIds(root)).toEqual([a.id]);
    expect(await childIds(a)).toEqual([b.id]);
  });

  test('reorder onto a row under a different parent reparents to that parent', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const b = add('b'); const a1 = add('a1');
    await createEdge(db, root, a, 0); await createEdge(db, root, b, 1);
    await createEdge(db, a, a1, 0); await db.flush();
    await controllerFor(root).applyDrag(b.id, a1.id, 'reorder-below'); await db.flush();
    expect(await childIds(root)).toEqual([a.id]);
    expect(await childIds(a)).toEqual([a1.id, b.id]);
  });

  test('a cycle-creating drop is a no-op', async ({ expect }) => {
    const root = add('root'); const a = add('a'); const a1 = add('a1');
    await createEdge(db, root, a, 0); await createEdge(db, a, a1, 0); await db.flush();
    await controllerFor(root).applyDrag(a.id, a1.id, 'make-child');
    expect(await childIds(root)).toEqual([a.id]);
    expect(await childIds(a)).toEqual([a1.id]);
  });
});
