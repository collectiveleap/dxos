//
// Copyright 2026 DXOS.org
//

import { type Bookmark } from '@dxos/plugin-bookmarks';

import { type Highlight } from '../types';

export interface SourceGroup {
  readonly source: Bookmark.Bookmark;
  readonly highlights: readonly Highlight.Highlight[];
  readonly latestUpdated: string;
}

/** The maximum (most recent) ISO timestamp in `updated`, or '' when empty. */
export const latestUpdated = (updated: readonly string[]): string =>
  updated.reduce((max, value) => (value > max ? value : max), '');

/** Orders items by `latestUpdated`, most recent first. Stable, non-mutating. */
export const orderGroups = <T extends { latestUpdated: string }>(groups: readonly T[]): T[] =>
  [...groups].sort((a, b) => (a.latestUpdated < b.latestUpdated ? 1 : a.latestUpdated > b.latestUpdated ? -1 : 0));

/**
 * Groups highlights under their source `Bookmark`, ordering sources most-recently-active first and
 * highlights within a source `updated`-descending. Highlights whose `source` ref is unresolved are
 * skipped (they render once the ref hydrates).
 */
export const buildSourceGroups = (highlights: readonly Highlight.Highlight[]): SourceGroup[] => {
  const bySource = new Map<string, { source: Bookmark.Bookmark; highlights: Highlight.Highlight[] }>();
  for (const highlight of highlights) {
    const source = highlight.source.target;
    if (!source) {
      continue;
    }
    const entry = bySource.get(source.id) ?? { source, highlights: [] };
    entry.highlights.push(highlight);
    bySource.set(source.id, entry);
  }
  const groups = [...bySource.values()].map(({ source, highlights: hs }) => ({
    source,
    highlights: [...hs].sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0)),
    latestUpdated: latestUpdated(hs.map((h) => h.updated)),
  }));
  return orderGroups(groups);
};
