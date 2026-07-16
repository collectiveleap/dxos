//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';

import { Filter, Query, Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Text } from '@dxos/schema';

import { Edge, Node, makeEdge, makeLinkedEdge, makeNode } from '../types';
import { backlinks, childEdges, createEdge, createLinkedEdge, orderBetween, parentEdges, reparentEdge, wouldCreateCycle } from './edges';

describe('orderBetween', () => {
  test('midpoints and open ends', ({ expect }) => {
    expect(orderBetween(undefined, undefined)).toBe(0);
    expect(orderBetween({ order: 5 } as any, undefined)).toBe(6);
    expect(orderBetween(undefined, { order: 5 } as any)).toBe(4);
    expect(orderBetween({ order: 2 } as any, { order: 4 } as any)).toBe(3);
  });
});

describe('traversal', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase({ types: [Node, Edge, Text.Text] }));
  });
  afterEach(async () => {
    await builder.close();
  });

  test('childEdges returns children ordered by `order`', async ({ expect }) => {
    const p = db.add(makeNode({}));
    const a = db.add(makeNode({ text: 'a' }));
    const b = db.add(makeNode({ text: 'b' }));
    db.add(makeEdge({ source: p, target: b, order: 1 }));
    db.add(makeEdge({ source: p, target: a, order: 0 }));
    await db.flush();

    const kids = await childEdges(db, p);
    expect(kids.map((e) => Relation.getTarget(e).id)).toEqual([a.id, b.id]);
  });

  test('parentEdges returns every predecessor (multi-location)', async ({ expect }) => {
    const p1 = db.add(makeNode({ text: 'p1' }));
    const p2 = db.add(makeNode({ text: 'p2' }));
    const c = db.add(makeNode({ text: 'c' }));
    db.add(makeEdge({ source: p1, target: c, order: 0 }));
    db.add(makeEdge({ source: p2, target: c, order: 0 }));
    await db.flush();

    const parents = await parentEdges(db, c);
    expect(parents.map((e) => Relation.getSource(e).id).sort()).toEqual([p1.id, p2.id].sort());
  });

  test('childEdges and parentEdges ignore linked edges (structural only)', async ({ expect }) => {
    const p = db.add(makeNode({ text: 'p' }));
    const c = db.add(makeNode({ text: 'c' }));
    db.add(makeEdge({ source: p, target: c, order: 0 }));   // structural p→c
    db.add(makeLinkedEdge({ source: p, target: c }));         // linked p→c (a mention)
    await db.flush();

    const kids = await childEdges(db, p);
    expect(kids).toHaveLength(1);
    expect(kids[0].kind).toBe('structural');
    const parents = await parentEdges(db, c);
    expect(parents).toHaveLength(1);
    expect(parents[0].kind).toBe('structural');
  });

  test('createLinkedEdge links a Node to a non-Node object; reachable by reverse traversal', async ({ expect }) => {
    const node = db.add(makeNode({ text: 'node' }));
    const foreign = db.add(Text.make({ content: 'foreign object' }));
    await db.flush();

    const edge = createLinkedEdge(db, node, foreign);
    await db.flush();

    expect(edge.kind).toBe('linked');
    expect(Relation.getTarget(edge).id).toBe(foreign.id);
    // Reverse-traversable by endpoint id, type-agnostically.
    const inbound = await db.query(Query.select(Filter.id(foreign.id)).targetOf(Edge)).run();
    expect(inbound).toEqual([edge]);
  });
});

describe('mutation + acyclicity', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase({ types: [Node, Edge, Text.Text] }));
  });
  afterEach(async () => {
    await builder.close();
  });

  test('createEdge nests a child and appends its order', async ({ expect }) => {
    const p = db.add(makeNode({}));
    const a = db.add(makeNode({ text: 'a' }));
    const b = db.add(makeNode({ text: 'b' }));
    await createEdge(db, p, a);
    const eb = await createEdge(db, p, b);
    await db.flush();

    expect(eb.order).toBe(1);
    const kids = await childEdges(db, p);
    expect(kids.map((e) => Relation.getTarget(e).id)).toEqual([a.id, b.id]);
  });

  test('createEdge rejects a cycle', async ({ expect }) => {
    const a = db.add(makeNode({ text: 'a' }));
    const b = db.add(makeNode({ text: 'b' }));
    await createEdge(db, a, b); // a → b
    await db.flush();
    expect(await wouldCreateCycle(db, b, a)).toBe(true); // b → a would cycle
    await expect(createEdge(db, b, a)).rejects.toThrow(/cycle/);
  });

  test('reparentEdge moves an occurrence to a new parent', async ({ expect }) => {
    const p1 = db.add(makeNode({ text: 'p1' }));
    const p2 = db.add(makeNode({ text: 'p2' }));
    const c = db.add(makeNode({ text: 'c' }));
    const e = await createEdge(db, p1, c);
    await db.flush();
    await reparentEdge(db, e, p2);
    await db.flush();

    expect((await parentEdges(db, c)).map((x) => Relation.getSource(x).id)).toEqual([p2.id]);
  });

  test('reparentEdge rejects reparenting under a descendant, leaving the original edge intact', async ({
    expect,
  }) => {
    const a = db.add(makeNode({ text: 'a' }));
    const b = db.add(makeNode({ text: 'b' }));
    const c = db.add(makeNode({ text: 'c' }));
    const ab = await createEdge(db, a, b); // a → b
    await createEdge(db, b, c); // b → c
    await db.flush();

    // Reparenting a→b under c (a descendant of b) would create a cycle: reject atomically.
    await expect(reparentEdge(db, ab, c)).rejects.toThrow(/cycle/);
    await db.flush();

    const parents = await parentEdges(db, b);
    expect(parents.map((e) => Relation.getSource(e).id)).toEqual([a.id]);
    expect(Relation.getTarget(parents[0]).id).toBe(b.id);
  });

  test('createLinkedEdge adds a linked edge and admits cycles', async ({ expect }) => {
    const a = db.add(makeNode({ text: 'a' }));
    const b = db.add(makeNode({ text: 'b' }));
    createLinkedEdge(db, a, b);
    createLinkedEdge(db, b, a); // reciprocal — must be admitted (no cycle rejection)
    await db.flush();
    const outA = (await db.query(Query.select(Filter.id(a.id)).sourceOf(Edge)).run()).filter((e) => e.kind === 'linked');
    const outB = (await db.query(Query.select(Filter.id(b.id)).sourceOf(Edge)).run()).filter((e) => e.kind === 'linked');
    expect(outA).toHaveLength(1);
    expect(outB).toHaveLength(1);
  });

  test('backlinks group inbound edges by kind (structural + linked)', async ({ expect }) => {
    const t = db.add(makeNode({ text: 't' }));
    const p = db.add(makeNode({ text: 'p' }));  // structural parent (co-located under p)
    const a = db.add(makeNode({ text: 'a' }));  // linked referrer (a mentions t)
    db.add(makeEdge({ source: p, target: t, order: 0 }));
    createLinkedEdge(db, a, t);
    await db.flush();

    const bl = await backlinks(db, t);
    expect(bl.structural.map((n) => n.id)).toEqual([p.id]);
    expect(bl.linked.map((n) => n.id)).toEqual([a.id]);
  });
});
