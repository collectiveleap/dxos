//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Icon, useTranslation } from '@dxos/react-ui';

import { meta } from '#meta';
import { type Highlight } from '../../types';

export type HighlightDetailProps = {
  readonly subject: Highlight.Highlight;
  readonly role?: string;
  readonly attendableId?: string;
};

/** Full detail for one highlight: passage, note, tags, and links to the source document and its
 * Readwise reader view (the referent and the origin, respectively — see `Highlight`'s doc comment). */
export const HighlightDetail = ({ subject }: HighlightDetailProps) => {
  const { t } = useTranslation(meta.profile.key);
  const source = subject.source.target;
  return (
    <div className='p-4 max-is-[60rem] mli-auto'>
      <p className='border-is-2 border-amber-400 pis-3 text-base'>{subject.text}</p>
      {subject.note && <p className='mlb-3 rounded bg-amber-50 dark:bg-amber-950 p-3 text-sm'>{subject.note}</p>}
      <div className='flex items-center gap-2 flex-wrap mbs-3'>
        {subject.tags.map((tag) => (
          <span key={tag} className='rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 text-xs'>
            #{tag}
          </span>
        ))}
      </div>
      <div className='flex items-center gap-4 flex-wrap mbs-4'>
        {source?.url && (
          <a
            href={source.url}
            target='_blank'
            rel='noreferrer'
            className='flex items-center gap-1 text-sm text-primary-500 underline'
          >
            <Icon icon='ph--arrow-square-out--regular' size={3} />
            {t('open-referent.label')}
          </a>
        )}
        {subject.origin && (
          <a
            href={subject.origin}
            target='_blank'
            rel='noreferrer'
            className='flex items-center gap-1 text-sm text-primary-500 underline'
          >
            <Icon icon='ph--arrow-square-out--regular' size={3} />
            {t('open-origin.label')}
          </a>
        )}
      </div>
    </div>
  );
};
