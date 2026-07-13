//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';
import { Filter, Query } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Text } from '@dxos/schema';
import { OutlineController } from './controller';
import { createEdge } from '../../model/edges';
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
});
