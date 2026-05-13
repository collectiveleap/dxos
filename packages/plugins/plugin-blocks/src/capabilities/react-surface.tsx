//
// Copyright 2025 DXOS.org
//

import * as Effect from 'effect/Effect';
import React from 'react';

import { Capabilities, Capability } from '@dxos/app-framework';
import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';

import { BlockArticle } from '#containers';
import { Bramble } from '#types';

export default Capability.makeModule(() =>
  Effect.succeed(
    Capability.contributes(Capabilities.ReactSurface, [
      // Top-level Bramble Graph opened via the navigator.
      Surface.create({
        id: 'article',
        filter: AppSurface.object(AppSurface.Article, Bramble.Graph),
        component: ({ data, role }) => (
          <BlockArticle role={role} subject={data.subject} attendableId={data.attendableId} />
        ),
      }),
      // F-Open-Pane: a single Node opened in a new pane via shift-click on
      // a child bullet. Same `BlockArticle` renders the Node as the pane's
      // root (no name auto-sync, no backlinks panel).
      Surface.create({
        id: 'article-block',
        filter: AppSurface.object(AppSurface.Article, Bramble.Node),
        component: ({ data, role }) => (
          <BlockArticle role={role} subject={data.subject} attendableId={data.attendableId} />
        ),
      }),
    ]),
  ),
);
