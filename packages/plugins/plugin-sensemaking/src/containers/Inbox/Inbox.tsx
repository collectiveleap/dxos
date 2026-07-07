//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';
import { Entity, Filter } from '@dxos/echo';
import { type Space, useQuery } from '@dxos/react-client/echo';
import { Message, useTranslation } from '@dxos/react-ui';

import { meta } from '#meta';
import { Capture } from '#types';

import { clusterByReferent } from '../../operations';

export type InboxProps = {
  readonly space: Space;
};

export const Inbox = ({ space }: InboxProps) => {
  const { t } = useTranslation(meta.profile.key);
  const captures = useQuery(space.db, Filter.type(Capture.Capture));
  const clusters = clusterByReferent(captures);

  if (clusters.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center bs-full gap-3 p-8 text-center'>
        <Message.Root valence='warning'>
          <Message.Title>{t('inbox-empty.message')}</Message.Title>
        </Message.Root>
      </div>
    );
  }

  return (
    <div className='dx-base-surface bs-full overflow-y-auto'>
      <div className='p-4 max-is-[60rem] mli-auto'>
        {clusters.map((cluster) => (
          <section key={cluster.referent?.id ?? 'uncategorized'} className='mbe-4'>
            <header className='flex items-baseline gap-2 pbe-1.5 mbe-2.5 border-be border-separator text-sm font-medium'>
              <span>{cluster.referent ? Entity.getLabel(cluster.referent) : t('uncategorized.label')}</span>
              <span className='font-mono text-xs text-subdued'>{cluster.captures.length}</span>
            </header>
            {cluster.captures.map((capture) => {
              const source = capture.source.target;
              return source ? (
                <Surface.Surface key={capture.id} type={AppSurface.CardContent} data={{ subject: source }} limit={1} />
              ) : null;
            })}
          </section>
        ))}
      </div>
    </div>
  );
};
