//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import React from 'react';

import { Capabilities, Capability } from '@dxos/app-framework';
import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';

import { HighlightCard, HighlightDetail, ReadwiseContainer } from '#containers';
import { Highlight, Readwise } from '../types';

export default Capability.makeModule(() =>
  Effect.succeed(
    Capability.contributes(Capabilities.ReactSurface, [
      Surface.create({
        id: 'readwiseContainer',
        filter: AppSurface.object(AppSurface.Article, Readwise.Readwise),
        component: ({ data, role }) => (
          <ReadwiseContainer role={role} subject={data.subject} attendableId={data.attendableId} />
        ),
      }),
      Surface.create({
        id: 'highlightDetail',
        filter: AppSurface.object(AppSurface.Article, Highlight.Highlight),
        component: ({ data, role }) => (
          <HighlightDetail role={role} subject={data.subject} attendableId={data.attendableId} />
        ),
      }),
      Surface.create({
        id: 'highlightCard',
        filter: AppSurface.object(AppSurface.CardContent, Highlight.Highlight),
        component: ({ data, role }) => <HighlightCard role={role} subject={data.subject} />,
      }),
    ]),
  ),
);
