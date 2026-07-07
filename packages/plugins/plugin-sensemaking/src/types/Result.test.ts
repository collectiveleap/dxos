//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Obj } from '@dxos/echo';

import * as Result from './Result';

describe('Result', () => {
  test('makes a to-do result with a body', ({ expect }) => {
    const result = Result.make({ kind: 'todo', body: 'Draft the post' });
    expect(Result.instanceOf(result)).toBe(true);
    expect(result.kind).toBe('todo');
    expect(result.body).toBe('Draft the post');
    expect(Obj.instanceOf(Result.Result, result)).toBe(true);
  });
});
