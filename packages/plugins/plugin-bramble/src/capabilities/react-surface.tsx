//
// Copyright 2025 DXOS.org
//

import * as Effect from 'effect/Effect';
import React from 'react';

import { Capabilities, Capability } from '@dxos/app-framework';
import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';

import { Article } from '#containers';
import { Bramble } from '#types';

export default Capability.makeModule(() =>
  Effect.succeed(
    Capability.contributes(Capabilities.ReactSurface, [
      // F-No-Root: the Bramble's Article surface renders a Bramble.Node
      // (the user always views a specific Node — today's by default,
      // any other Node via F-Bramble-Nav / @-mention / F-Zoom). The
      // Bramble.Graph object itself is NOT directly viewable per
      // F-No-Root.graph-not-directly-viewable.
      Surface.create({
        id: 'article-block',
        filter: AppSurface.object(AppSurface.Article, Bramble.Node),
        component: ({ data, role }) => (
          <Article role={role} subject={data.subject} attendableId={data.attendableId} />
        ),
      }),
    ]),
  ),
);
