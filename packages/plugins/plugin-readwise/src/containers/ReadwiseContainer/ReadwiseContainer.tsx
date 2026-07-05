//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Surface } from '@dxos/app-framework/ui';
import { Filter, Obj, Ref } from '@dxos/echo';
import { ConnectorAuth } from '@dxos/plugin-connector';
import { useQuery } from '@dxos/react-client/echo';
import { useTranslation } from '@dxos/react-ui';

import { HighlightCard } from '../HighlightCard';
import { buildSourceGroups } from '../../operations/browse-query';
import { meta } from '#meta';
import { READWISE_CONNECTOR_ID } from '../../constants';
import { useReadwiseSyncBinding } from '../../hooks';
import { Highlight, type Readwise } from '../../types';

export type ReadwiseContainerProps = {
  readonly subject: Readwise.Readwise;
  readonly role?: string;
  readonly attendableId?: string;
};

export const ReadwiseContainer = ({ subject }: ReadwiseContainerProps) => {
  const { t } = useTranslation(meta.profile.key);
  const db = Obj.getDatabase(subject);
  const binding = useReadwiseSyncBinding(db, subject);
  const allHighlights = useQuery(db, Filter.type(Highlight.Highlight));
  const highlights = allHighlights.filter((highlight) => highlight.container.target?.id === subject.id);

  if (!binding) {
    return (
      <div className='flex flex-col items-center justify-center bs-full gap-3 p-8 text-center'>
        <p className='text-sm text-neutral-500'>{t('empty.message')}</p>
        <Surface.Surface
          type={ConnectorAuth}
          data={{ connectorIds: [READWISE_CONNECTOR_ID], existingTarget: Ref.make(subject) }}
          limit={1}
        />
      </div>
    );
  }

  const groups = buildSourceGroups(highlights);
  return (
    <div className='p-3 max-is-[60rem] mli-auto'>
      {groups.map((group) => (
        <section key={group.source.id} className='mbe-4'>
          <header className='flex items-center gap-2 pbe-1 mbe-2 border-be border-neutral-200 dark:border-neutral-700 text-sm font-medium'>
            <span>{group.source.title || group.source.url}</span>
            <span className='text-xs text-neutral-500'>· {group.highlights.length}</span>
          </header>
          <div className='pis-4'>
            {group.highlights.map((highlight) => (
              <HighlightCard key={highlight.id} subject={highlight} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
