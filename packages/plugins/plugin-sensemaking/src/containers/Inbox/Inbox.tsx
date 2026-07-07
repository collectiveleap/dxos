//
// Copyright 2026 DXOS.org
//

import React, { type CSSProperties } from 'react';

import * as Schema from 'effect/Schema';

import { Entity, Filter } from '@dxos/echo';
import { type Space, useQuery } from '@dxos/react-client/echo';
import { Icon, Message, ScrollArea, useTranslation } from '@dxos/react-ui';

import { meta } from '#meta';
import { Capture } from '#types';

import { CaptureRow } from './CaptureRow';
import { clusterByReferent } from '../../operations';

// Extending CSSProperties so the custom-property entries satisfy the style prop type without a cast.
type WarmSurfaceVars = CSSProperties & {
  '--color-base-surface': string;
  '--color-card-surface': string;
  '--color-separator': string;
  '--color-subdued-separator': string;
};

// The Inbox is an amber-tinted "reading room" matching the Readwise reading view. The neutral ramp's
// warmth knobs are inlined at build time, so they can't be re-tinted per-subtree; instead override the
// semantic surface + separator tokens (resolved at use-time) with warm values. `.dx-*-surface` classes
// and their derived states read these via `var()`, so the whole subtree warms and both light/dark
// follow via `light-dark`.
const warmSurfaces: WarmSurfaceVars = {
  '--color-base-surface': 'light-dark(oklch(0.979 0.016 80), oklch(0.205 0.01 78))',
  '--color-card-surface': 'light-dark(oklch(0.996 0.012 82), oklch(0.242 0.012 78))',
  '--color-separator': 'light-dark(oklch(0.9 0.018 80), oklch(0.32 0.012 78))',
  '--color-subdued-separator': 'light-dark(oklch(0.92 0.016 80), oklch(0.3 0.012 78))',
};

// A referent's "open original" link reads a `url` field when present (e.g. a Bookmark). Narrowed
// structurally via `Schema.is` so no cross-plugin type dependency (or cast) is needed.
const HasUrl = Schema.Struct({ url: Schema.String });
const getReferentUrl = (referent: Entity.Unknown): string | undefined =>
  Schema.is(HasUrl)(referent) ? referent.url : undefined;

export type InboxProps = {
  readonly space: Space;
};

export const Inbox = ({ space }: InboxProps) => {
  const { t } = useTranslation(meta.profile.key);
  const captures = useQuery(space.db, Filter.type(Capture.Capture));
  const clusters = clusterByReferent(captures);

  if (clusters.length === 0) {
    return (
      <div className='dx-base-surface flex flex-col items-center justify-center bs-full gap-3 p-8 text-center' style={warmSurfaces}>
        <Message.Root valence='warning'>
          <Message.Title>{t('inbox-empty.message')}</Message.Title>
        </Message.Root>
      </div>
    );
  }

  return (
    <ScrollArea.Root classNames='dx-base-surface' style={warmSurfaces}>
      <ScrollArea.Viewport>
        <div className='p-4 max-is-[60rem] mli-auto'>
          {clusters.map((cluster) => {
            const url = cluster.referent ? getReferentUrl(cluster.referent) : undefined;
            return (
              <section
                key={cluster.referent?.id ?? 'uncategorized'}
                className='dx-card-surface rounded-xl border border-separator overflow-hidden mbe-4'
              >
                <header className='flex items-center gap-2 plb-2 pli-3 bg-base-surface border-be border-separator flex-wrap'>
                  <span className='font-serif font-semibold text-base-fg'>
                    {cluster.referent ? Entity.getLabel(cluster.referent) : t('uncategorized.label')}
                  </span>
                  <span className='font-mono text-xs text-subdued'>{cluster.captures.length}</span>
                  <span className='flex-1' />
                  {url && (
                    <a
                      href={url}
                      target='_blank'
                      rel='noreferrer'
                      className='flex items-center gap-1 rounded-md border border-separator plb-0.5 pli-2 text-xs text-description hover:text-primary-500'
                    >
                      <Icon icon='ph--arrow-square-out--regular' size={3} />
                      {t('open-original.label')}
                    </a>
                  )}
                </header>
                <div className='plb-2 pli-3'>
                  {cluster.captures.map((capture) => (
                    <CaptureRow key={capture.id} capture={capture} space={space} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </ScrollArea.Viewport>
    </ScrollArea.Root>
  );
};
