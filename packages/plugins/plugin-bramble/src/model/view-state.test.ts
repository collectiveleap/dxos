//
// Copyright 2026 DXOS.org
//

import { expect, test } from 'vitest';

import { EMPTY_VIEW_STATE, resolveZoomRoot, toggleCollapsed, zoomOut, zoomTo } from './view-state';

test('toggleCollapsed flips membership immutably', () => {
  const s1 = toggleCollapsed(EMPTY_VIEW_STATE, 'n1');
  expect(s1.collapsed.has('n1')).toBe(true);
  expect(EMPTY_VIEW_STATE.collapsed.has('n1')).toBe(false); // original untouched
  const s2 = toggleCollapsed(s1, 'n1');
  expect(s2.collapsed.has('n1')).toBe(false);
});

test('zoomTo sets root and un-collapses the target; zoomOut clears', () => {
  const collapsed = toggleCollapsed(EMPTY_VIEW_STATE, 'n1');
  const zoomed = zoomTo(collapsed, 'n1');
  expect(zoomed.zoomRootId).toBe('n1');
  expect(zoomed.collapsed.has('n1')).toBe(false);
  expect(zoomOut(zoomed).zoomRootId).toBeNull();
});

test('resolveZoomRoot falls back to the subject', () => {
  expect(resolveZoomRoot(null, 'subj')).toBe('subj');
  expect(resolveZoomRoot('n1', 'subj')).toBe('n1');
});
