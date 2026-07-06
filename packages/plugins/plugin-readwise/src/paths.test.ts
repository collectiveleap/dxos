//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import {
  getHighlightsId,
  getReadwiseAccountPath,
  getReadwiseSectionId,
  getReadwiseSectionPath,
  getSourcesId,
} from './paths';

// Graph node segment ids are split on '/'; a slash in a synthetic id throws an invariant at render
// time (the Task-12 regression). These helpers back the navtree section, so guard the invariant.
describe('readwise paths', () => {
  test('synthetic segment ids contain no slash', ({ expect }) => {
    for (const id of [getReadwiseSectionId(), getSourcesId(), getHighlightsId()]) {
      expect(id).not.toContain('/');
    }
  });

  test('account path nests the account under the section', ({ expect }) => {
    const spaceId = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const accountId = 'ABCDEF';
    const sectionPath = getReadwiseSectionPath(spaceId);
    const accountPath = getReadwiseAccountPath(spaceId, accountId);
    expect(sectionPath.endsWith(getReadwiseSectionId())).toBe(true);
    expect(accountPath).toBe(`${sectionPath}/${accountId}`);
  });
});
