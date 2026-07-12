//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';

import { Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Text } from '@dxos/schema';

import { Edge, Node, makeEdge, makeNode } from '../types';
import { childEdges, orderBetween, parentEdges } from './edges';

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
});
