//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Ref, Relation } from '@dxos/echo';

import * as Capture from './Capture';
import * as ConnectedTo from './ConnectedTo';
import * as DerivedFrom from './DerivedFrom';
import * as Result from './Result';

describe('sensemaking relations', () => {
  test('DerivedFrom traces a Result back to its Capture', ({ expect }) => {
    const referent = Result.make({ kind: 'todo', body: 'Referent' });
    const capture = Capture.make({ source: Ref.make(referent), flaggedAt: '2026-07-06T00:00:00Z' });
    const result = Result.make({ kind: 'todo', body: 'Do it' });

    const derivedFrom = DerivedFrom.make({ [Relation.Source]: result, [Relation.Target]: capture });

    expect(Relation.isRelation(derivedFrom)).to.be.true;
    expect(Relation.getSource(derivedFrom)).to.eq(result);
    expect(Relation.getTarget(derivedFrom)).to.eq(capture);
  });

  test('ConnectedTo connects a Capture to any target object', ({ expect }) => {
    const referent = Result.make({ kind: 'todo', body: 'Referent' });
    const capture = Capture.make({ source: Ref.make(referent), flaggedAt: '2026-07-06T00:00:00Z' });
    const target = Result.make({ kind: 'question', body: 'What is this about?' });

    const connectedTo = ConnectedTo.make({ [Relation.Source]: capture, [Relation.Target]: target });

    expect(Relation.isRelation(connectedTo)).to.be.true;
    expect(Relation.getSource(connectedTo)).to.eq(capture);
    expect(Relation.getTarget(connectedTo)).to.eq(target);
  });
});
