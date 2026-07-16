//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';

import { Filter, Query, Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Text } from '@dxos/schema';

import { Edge, Node, makeEdge, makeLinkedEdge, makeNode } from './index';

describe('Bramble schema', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase({ types: [Node, Edge, Text.Text] }));
  });

  afterEach(async () => {
    await builder.close();
  });

  test('an Edge relation connects two Nodes and is queryable by endpoint', async ({ expect }) => {
    const parent = db.add(makeNode({ text: 'parent' }));
    const child = db.add(makeNode({ text: 'child' }));
    const edge = db.add(makeEdge({ source: parent, target: child, order: 0 }));
    await db.flush();

    const out = await db.query(Query.select(Filter.id(parent.id)).sourceOf(Edge)).run();
    expect(out).toEqual([edge]);
    expect(Relation.getSource(edge).id).toBe(parent.id);
    expect(Relation.getTarget(edge).id).toBe(child.id);
  });

  test('an Edge can span a Node and a non-Node object, queryable by endpoint id', async ({ expect }) => {
    const node = db.add(makeNode({ text: 'node' }));
    // A foreign, non-Node ECHO object standing in for any typed Composer object.
    const foreign = db.add(Text.make({ content: 'foreign object' }));
    const edge = db.add(makeEdge({ source: node, target: foreign, order: 0 }));
    await db.flush();

    const out = await db.query(Query.select(Filter.id(node.id)).sourceOf(Edge)).run();
    expect(out).toEqual([edge]);
    // The relation resolves its foreign endpoint by identity — no Node type required.
    expect(Relation.getSource(edge).id).toBe(node.id);
    expect(Relation.getTarget(edge).id).toBe(foreign.id);
  });

  test('makeNode always creates a Text so every Node is editable (incl. the create-menu path)', async ({ expect }) => {
    const node = db.add(makeNode()); // no text — the Composer create-object path
    await db.flush();
    expect(node.text).toBeDefined();
    expect(node.text!.target?.content).toBe('');
  });

  test('a structural edge carries kind=structural and an order', async ({ expect }) => {
    const p = db.add(makeNode({ text: 'p' }));
    const c = db.add(makeNode({ text: 'c' }));
    const e = db.add(makeEdge({ source: p, target: c, order: 0 }));
    await db.flush();
    expect(e.kind).toBe('structural');
    expect(e.order).toBe(0);
  });

  test('a linked edge carries kind=linked and no order', async ({ expect }) => {
    const a = db.add(makeNode({ text: 'a' }));
    const t = db.add(makeNode({ text: 't' }));
    const e = db.add(makeLinkedEdge({ source: a, target: t }));
    await db.flush();
    expect(e.kind).toBe('linked');
    expect(e.order).toBeUndefined();
  });
});
