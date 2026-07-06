//
// Copyright 2026 DXOS.org
//

import React, { type KeyboardEvent, useCallback } from 'react';

import { useOperationInvoker } from '@dxos/app-framework/ui';
import { LayoutOperation, Paths } from '@dxos/app-toolkit';

import { type Highlight } from '../../types';

export type HighlightCardProps = {
  readonly subject: Highlight.Highlight;
  readonly role?: string;
};

/**
 * One highlight card: passage + source-agnostic content (the source header is rendered by the
 * container). The processing-state dot and the forward affordance are INERT in Inc 1 — reserved
 * placeholders that Inc 2 activates. Clicking (or pressing Enter/Space on) the card opens the
 * highlight's `HighlightDetail` Article surface, matching the `LayoutOperation.Open` convention used
 * by other object cards (e.g. `SpaceHomeRecent`'s `RecentObjectTile`, `CollectionArticle`'s tile).
 */
export const HighlightCard = ({ subject }: HighlightCardProps) => {
  const { invokePromise } = useOperationInvoker();
  // Reserved (Inc 2): the dot will be driven by the future Capture envelope's processing state, not
  // by a field on this Highlight. Static until that state exists.
  const state = 'none';

  const handleOpen = useCallback(() => {
    void invokePromise(LayoutOperation.Open, { subject: [Paths.getObjectPathFromObject(subject)] });
  }, [invokePromise, subject]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleOpen();
      }
    },
    [handleOpen],
  );

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className='grid grid-cols-[20px_1fr] gap-2 items-start rounded border border-neutral-200 dark:border-neutral-700 p-2 mbe-2 cursor-pointer'
    >
      {/* Reserved (Inc 2): processing-state dot. Inert. */}
      <div
        aria-hidden
        data-processing-state={state}
        className='is-3 bs-3 mbs-1 rounded-full border border-dashed border-violet-400'
      />
      <div className='min-is-0'>
        <p className='border-is-2 border-amber-400 pis-2 text-sm'>{subject.text}</p>
        {subject.note && (
          <p className='mlb-1 rounded bg-amber-50 dark:bg-amber-950 px-2 py-1 text-xs text-amber-900 dark:text-amber-200'>
            {subject.note}
          </p>
        )}
        <div className='flex items-center gap-2 flex-wrap mbs-1'>
          {subject.tags.map((tag) => (
            <span key={tag} className='rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 text-xs'>
              #{tag}
            </span>
          ))}
          {/* Reserved (Inc 2): forward link to where the highlight is processed. Inert. */}
          <span aria-hidden className='mis-auto rounded-full border border-dashed border-violet-400 px-2 text-xs text-violet-500'>
            → not yet processed
          </span>
        </div>
      </div>
    </div>
  );
};
