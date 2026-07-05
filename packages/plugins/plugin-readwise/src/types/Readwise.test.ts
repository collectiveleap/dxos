//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Obj, Ref } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';

import * as Highlight from './Highlight';
import * as Readwise from './Readwise';

describe('Readwise types', () => {
  test('constructs a Readwise container', ({ expect }) => {
    const readwise = Readwise.make({ name: 'My Reading' });
    expect(Readwise.instanceOf(readwise)).toBe(true);
    expect(readwise.name).toBe('My Reading');
  });

  test('constructs a Highlight referencing a source and container', ({ expect }) => {
    const readwise = Readwise.make({ name: 'My Reading' });
    const bookmark = Bookmark.make({ title: 'An Article', url: 'https://example.com/a' });
    const highlight = Highlight.make({
      text: 'a highlighted passage',
      tags: ['genai'],
      readwiseId: 'rw-1',
      updated: '2026-07-01T00:00:00.000Z',
      source: Ref.make(bookmark),
      container: Ref.make(readwise),
    });
    expect(Highlight.instanceOf(highlight)).toBe(true);
    expect(highlight.text).toBe('a highlighted passage');
    expect(highlight.source.target?.title).toBe('An Article');
    expect(highlight.container.target?.name).toBe('My Reading');
    expect(highlight.note).toBeUndefined();
    expect(Obj.instanceOf(Highlight.Highlight, highlight)).toBe(true);
  });
});
