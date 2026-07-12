//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';

import { Filter, Query, Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Text } from '@dxos/schema';

import { Edge, makeEdge, Node, makeNode } from './index';

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
});
