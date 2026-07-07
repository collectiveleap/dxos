//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Ref, Relation } from '@dxos/echo';

import { TestLayer } from '../test/test-layer';
import { Capture, Result } from '../types';

import { connect, createResult } from './triage';

describe('triage operations', () => {
  test('createResult persists a Result and traces it to the capture via DerivedFrom', async ({ expect }) => {
    const { db, close } = await TestLayer();
    try {
      const source = db.add(Result.make({ kind: 'todo', body: 'Source' }));
      const capture = db.add(Capture.make({ source: Ref.make(source), flaggedAt: '2026-07-06T00:00:00Z' }));

      const { result, relation } = createResult(db, capture, 'todo', 'Draft it');

      expect(result.kind).to.eq('todo');
      expect(result.body).to.eq('Draft it');
      expect(Relation.getSource(relation)).to.eq(result);
      expect(Relation.getTarget(relation)).to.eq(capture);
    } finally {
      await close();
    }
  });

  test('connect creates a ConnectedTo relation from the capture to the target', async ({ expect }) => {
    const { db, close } = await TestLayer();
    try {
      const source = db.add(Result.make({ kind: 'todo', body: 'Source' }));
      const capture = db.add(Capture.make({ source: Ref.make(source), flaggedAt: '2026-07-06T00:00:00Z' }));
      const target = db.add(Result.make({ kind: 'question', body: 'What is this about?' }));

      const { relation } = connect(db, capture, target);

      expect(Relation.getSource(relation)).to.eq(capture);
      expect(Relation.getTarget(relation)).to.eq(target);
    } finally {
      await close();
    }
  });
});
