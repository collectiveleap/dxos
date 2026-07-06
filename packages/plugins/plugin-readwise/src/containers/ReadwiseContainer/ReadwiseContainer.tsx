//
// Copyright 2026 DXOS.org
//

import React, { useEffect, useRef, useState } from 'react';

import { Surface, useOperationInvoker } from '@dxos/app-framework/ui';
import { Filter, Obj, Ref } from '@dxos/echo';
import { ConnectorAuth } from '@dxos/plugin-connector';
import { useObject, useQuery } from '@dxos/react-client/echo';
import { Icon, IconButton, useTranslation } from '@dxos/react-ui';

import { HighlightCard } from '../HighlightCard';
import { buildSourceGroups } from '../../operations/browse-query';
import { meta } from '#meta';
import { READWISE_CONNECTOR_ID } from '../../constants';
import { useReadwiseSyncBinding } from '../../hooks';
import { Highlight, type Readwise, ReadwiseOperation } from '../../types';

export type ReadwiseContainerProps = {
  readonly subject: Readwise.Readwise;
  readonly role?: string;
  readonly attendableId?: string;
};

export const ReadwiseContainer = ({ subject }: ReadwiseContainerProps) => {
  const { t } = useTranslation(meta.profile.key);
  const { invokePromise } = useOperationInvoker();
  const db = Obj.getDatabase(subject);
  const binding = useReadwiseSyncBinding(db, subject);
  const [cursor] = useObject(binding?.cursor);
  const allHighlights = useQuery(db, Filter.type(Highlight.Highlight));
  const highlights = allHighlights.filter((highlight) => highlight.container.target?.id === subject.id);

  const [syncing, setSyncing] = useState(false);
  const sync = async () => {
    if (!binding) {
      return;
    }
    setSyncing(true);
    try {
      await invokePromise(ReadwiseOperation.Sync, { binding: Ref.make(binding) }, { spaceId: db?.spaceId });
    } finally {
      setSyncing(false);
    }
  };

  // Auto-run the first sync once a binding is connected and has never completed a run. Guarded by a
  // ref (keyed on the binding id) so reconnecting a different binding can still auto-sync once, but a
  // re-render for the same binding never re-fires it.
  const autoSyncedBindingId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (binding && cursor && !cursor.lastRunAt && autoSyncedBindingId.current !== binding.id) {
      autoSyncedBindingId.current = binding.id;
      void sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding?.id, cursor?.lastRunAt]);

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
      <div className='flex justify-end mbe-3'>
        <IconButton
          disabled={syncing}
          variant='primary'
          iconClassNames={syncing ? 'animate-spin' : undefined}
          icon={syncing ? 'ph--spinner-gap--regular' : 'ph--arrows-clockwise--regular'}
          label={syncing ? t('sync-syncing.label') : t('sync.label')}
          onClick={sync}
        />
      </div>
      {groups.length === 0 ? (
        <p className='text-sm text-neutral-500 text-center p-8'>{t('no-highlights.message')}</p>
      ) : (
        groups.map((group) => (
          <section key={group.source.id} className='mbe-4'>
            <header className='flex items-center gap-2 pbe-1 mbe-2 border-be border-neutral-200 dark:border-neutral-700 text-sm font-medium'>
              <span>{group.source.title || group.source.url}</span>
              <span className='text-xs text-neutral-500'>· {group.highlights.length}</span>
              {group.source.url && (
                <a
                  href={group.source.url}
                  target='_blank'
                  rel='noreferrer'
                  className='mis-auto flex items-center gap-1 text-xs font-normal text-neutral-500 hover:text-primary-500 underline'
                >
                  <Icon icon='ph--arrow-square-out--regular' size={3} />
                  {t('open-referent.label')}
                </a>
              )}
            </header>
            <div className='pis-4'>
              {group.highlights.map((highlight) => (
                <HighlightCard key={highlight.id} subject={highlight} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
};
