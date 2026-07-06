//
// Copyright 2026 DXOS.org
//

import { Paths } from '@dxos/app-toolkit';

/**
 * Well-known local segment names for the Readwise navtree subtree (private — use the helpers below).
 * None contain '/': graph node ids are split on '/', so a segment with a slash throws an invariant.
 */
const Segments = {
  readwise: 'readwise',
  sources: 'sources',
  highlights: 'highlights',
} as const;

/** Canonical segment ID for the Readwise section node. */
export const getReadwiseSectionId = (): string => Segments.readwise;

/** Canonical qualified path to the Readwise section of a space. */
export const getReadwiseSectionPath = (spaceId: string): string => Paths.getSpacePath(spaceId, Segments.readwise);

/** Canonical qualified path to a specific Readwise account within a space. */
export const getReadwiseAccountPath = (spaceId: string, accountId: string): string =>
  `${getReadwiseSectionPath(spaceId)}/${accountId}`;

/** Canonical segment ID for an account's Sources child node. */
export const getSourcesId = (): string => Segments.sources;

/** Canonical segment ID for an account's Highlights child node. */
export const getHighlightsId = (): string => Segments.highlights;
