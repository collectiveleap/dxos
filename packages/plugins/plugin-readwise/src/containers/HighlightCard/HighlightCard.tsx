//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Icon, useTranslation } from '@dxos/react-ui';

import { meta } from '#meta';
import { type Highlight } from '../../types';

export type HighlightCardProps = {
  readonly subject: Highlight.Highlight;
  readonly role?: string;
};

/**
 * One highlight card: passage + source-agnostic content (the source header is rendered by the
 * container). Flat — the card presents the highlight inline in the Inbox cluster with no surface
 * chrome of its own (the cluster is the rounded rectangle; captures are separated by a dashed rule).
 * Display-only — it does not navigate. The processing-state dot is INERT in Inc 1 — a reserved
 * placeholder that Inc 2 activates.
 */
export const HighlightCard = ({ subject }: HighlightCardProps) => {
  const { t } = useTranslation(meta.profile.key);
  // Reserved (Inc 2): the dot will be driven by the future Capture envelope's processing state, not
  // by a field on this Highlight. Static until that state exists.
  const state = 'none';

  return (
    <div className='grid grid-cols-[16px_1fr] gap-2.5 items-start'>
      {/* Reserved (Inc 2): processing-state dot. Inert — a neutral solid ring until the Capture
          envelope's processing state exists (Inc 2 drives its fill/colour). */}
      <div
        aria-hidden
        data-processing-state={state}
        className='is-3 bs-3 mbs-1 rounded-full border border-separator'
      />
      <div className='min-is-0'>
        <div className='flex items-center gap-1.5 mbe-1.5 text-[11px] text-description'>
          <span aria-hidden className='is-1.5 bs-1.5 rounded-full bg-amber-500' />
          <span className='font-medium'>{t('source-name.label')}</span>
          {subject.origin && (
            <>
              <span aria-hidden className='opacity-50'>
                ·
              </span>
              <a
                href={subject.origin}
                target='_blank'
                rel='noreferrer'
                className='flex items-center gap-1 hover:text-primary-500'
              >
                {t('open-origin.label')}
                <Icon icon='ph--arrow-square-out--regular' size={3} />
              </a>
            </>
          )}
        </div>
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
        {subject.tags.length > 0 && (
          <div className='flex items-center gap-1.5 flex-wrap mbs-1.5'>
            {subject.tags.map((tag) => (
              <span
                key={tag}
                className='rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] text-description'
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
