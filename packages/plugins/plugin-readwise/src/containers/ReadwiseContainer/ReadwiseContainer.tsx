//
// Copyright 2026 DXOS.org
//

import React, { type CSSProperties, useEffect, useRef, useState } from 'react';

import { Surface, useOperationInvoker } from '@dxos/app-framework/ui';
import { Filter, Obj, Ref } from '@dxos/echo';
import { ConnectorAuth } from '@dxos/plugin-connector';
import { useObject, useQuery } from '@dxos/react-client/echo';
import { IconButton, Message, useTranslation } from '@dxos/react-ui';

import { meta } from '#meta';
import { READWISE_CONNECTOR_ID } from '../../constants';
import { useReadwiseSyncBinding } from '../../hooks';
import { Highlight, type Readwise, ReadwiseOperation } from '../../types';

// Extending CSSProperties so the custom-property entries satisfy the style prop type without a cast.
type WarmSurfaceVars = CSSProperties & {
  '--color-base-surface': string;
  '--color-card-surface': string;
  '--color-separator': string;
  '--color-subdued-separator': string;
};

// The Readwise view is an amber-tinted "reading room". The neutral ramp's warmth knobs are inlined at
// build time, so they can't be re-tinted per-subtree; instead override the semantic surface + separator
// tokens (resolved at use-time) with warm values. `.dx-*-surface` classes and their derived hover/current
// states read these via `var()`, so the whole subtree warms and both light/dark follow via `light-dark`.
const warmSurfaces: WarmSurfaceVars = {
  '--color-base-surface': 'light-dark(oklch(0.979 0.016 80), oklch(0.205 0.01 78))',
  '--color-card-surface': 'light-dark(oklch(0.996 0.012 82), oklch(0.242 0.012 78))',
  '--color-separator': 'light-dark(oklch(0.9 0.018 80), oklch(0.32 0.012 78))',
  '--color-subdued-separator': 'light-dark(oklch(0.92 0.016 80), oklch(0.3 0.012 78))',
};

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
        <Message.Root valence='warning'>
          <Message.Title>{t('empty.message')}</Message.Title>
        </Message.Root>
        <Surface.Surface
          type={ConnectorAuth}
          data={{ connectorIds: [READWISE_CONNECTOR_ID], existingTarget: Ref.make(subject) }}
          limit={1}
        />
      </div>
    );
  }

  // The reading + triage now live in the sensemaking Inbox; a connected account shows only its
  // connect/sync/status affordances (highlights flow into the Inbox on sync).
  return (
    <div
      className='dx-base-surface bs-full flex flex-col items-center justify-center gap-4 p-8 text-center'
      style={warmSurfaces}
    >
      <div className='flex flex-col items-center gap-1'>
        <span className='text-sm font-medium text-base-fg'>{t('connected.label')}</span>
        <span className='text-xs text-subdued'>{t('highlights-synced.label', { count: highlights.length })}</span>
      </div>
      <IconButton
        disabled={syncing}
        variant='primary'
        iconClassNames={syncing ? 'animate-spin' : undefined}
        icon={syncing ? 'ph--spinner-gap--regular' : 'ph--arrows-clockwise--regular'}
        label={syncing ? t('sync-syncing.label') : t('sync.label')}
        onClick={sync}
      />
      <span className='text-xs text-description'>{t('open-inbox.label')}</span>
    </div>
  );
};
