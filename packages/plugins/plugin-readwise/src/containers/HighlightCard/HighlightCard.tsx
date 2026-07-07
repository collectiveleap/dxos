//
// Copyright 2026 DXOS.org
//

import React, { type MouseEvent, useCallback } from 'react';

import { Icon, useTranslation } from '@dxos/react-ui';

import { meta } from '#meta';
import { type Highlight } from '../../types';

export type HighlightCardProps = {
  readonly subject: Highlight.Highlight;
  readonly role?: string;
};

/**
 * One highlight card: passage + source-agnostic content (the source header is rendered by the
 * container). Display-only — the card presents the highlight inline in the Inbox with its triage
 * controls; it does not navigate. The processing-state dot and the forward affordance are INERT in
 * Inc 1 — reserved placeholders that Inc 2 activates.
 */
export const HighlightCard = ({ subject }: HighlightCardProps) => {
  const { t } = useTranslation(meta.profile.key);
  // Reserved (Inc 2): the dot will be driven by the future Capture envelope's processing state, not
  // by a field on this Highlight. Static until that state exists.
  const state = 'none';

  // The origin link opens Readwise; stop the click from bubbling to any enclosing interactive surface.
  const handleOpenOrigin = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  }, []);

  return (
    <div className='dx-card-surface grid grid-cols-[16px_1fr] gap-2.5 items-start rounded-lg border border-subdued-separator p-2.5 mbe-2.5'>
      {/* Reserved (Inc 2): processing-state dot. Inert — a neutral solid ring until the Capture
          envelope's processing state exists (Inc 2 drives its fill/colour). */}
      <div
        aria-hidden
        data-processing-state={state}
        className='is-3 bs-3 mbs-1 rounded-full border border-separator'
      />
      <div className='min-is-0'>
        <p className='font-serif text-[15px] leading-relaxed border-s-[3px] border-s-amber-300 ps-3 text-base-fg'>
          {subject.text}
        </p>
        {subject.note && (
          <p className='flex gap-1.5 mlb-2 rounded-md bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1.5 text-xs text-amber-900 dark:text-amber-200'>
            <span aria-hidden className='opacity-70'>
              ✎
            </span>
            <span>{subject.note}</span>
          </p>
        )}
        <div className='flex items-center gap-1.5 flex-wrap mbs-1.5'>
          {subject.tags.map((tag) => (
            <span
              key={tag}
              className='rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] text-description'
            >
              #{tag}
            </span>
          ))}
          {subject.origin && (
            <a
              href={subject.origin}
              target='_blank'
              rel='noreferrer'
              onClick={handleOpenOrigin}
              className='flex items-center gap-1 text-[11px] text-description hover:text-primary-500'
            >
              <Icon icon='ph--arrow-square-out--regular' size={3} />
              {t('open-origin.label')}
            </a>
          )}
          {/* Reserved (Inc 2): forward link to where the highlight is triaged. Inert. */}
          <span
            aria-hidden
            className='mis-auto rounded-full border border-dashed border-violet-400 px-2 py-0.5 text-[11px] text-violet-500 opacity-85'
          >
            → not yet triaged
          </span>
        </div>
      </div>
    </div>
  );
};
