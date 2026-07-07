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
 * One highlight card: the source-specific content of a capture — a source-tag row (source name +
 * origin link), the passage, its note, and tags. Flat and single-column: the enclosing capture row
 * owns the rounded cluster, the dashed separator, and the processing-state gutter, so this card
 * carries no chrome or left gutter of its own. Display-only — it does not navigate.
 */
export const HighlightCard = ({ subject }: HighlightCardProps) => {
  const { t } = useTranslation(meta.profile.key);

  return (
    <div className='min-is-0'>
      <div data-testid='inbox.srctag' className='flex items-center gap-1.5 mbe-1.5 text-[11px] text-subdued'>
        <span aria-hidden data-testid='inbox.srctag-dot' className='w-[7px] h-[7px] rounded-full bg-[#eab308]' />
        <span className='font-medium'>{t('source-name.label')}</span>
        <span aria-hidden className='text-subdued opacity-60'>
          <Icon icon='ph--flag--regular' size={3} />
        </span>
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
      <p
        data-testid='inbox.passage'
        className='font-serif text-[14px] leading-normal border-s-[3px] border-s-[#f2c94c] ps-2.5 text-base-fg'
      >
        {subject.text}
      </p>
      {subject.note && (
        <p
          data-testid='inbox.note'
          className='flex gap-1.5 mlb-2 rounded-[6px] bg-[#fdf6e3] dark:bg-amber-950/50 px-2 py-1 text-xs text-[#7c5e00] dark:text-amber-200'
        >
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
  );
};
